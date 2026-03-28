// ─────────────────────────────────────────────────────────────
// Function Handlers — Implementations of Gemini function calls
// These are invoked when Gemini decides to call a registered tool
// ─────────────────────────────────────────────────────────────

import type { GeoCoordinate } from "@/lib/types/incident";
import { Type, type FunctionDeclaration } from "@google/genai";
import { logger } from "@/lib/logger";

const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

/**
 * Function declarations for Gemini tool registration.
 * Each declaration describes a callable function the model can invoke.
 */
export const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "search_nearby_hospitals",
    description:
      "Search for nearby hospitals and medical facilities within a given radius of a location. Use when you need to recommend medical facilities for injured persons or as triage points.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        latitude: {
          type: Type.NUMBER,
          description: "Latitude of the search center",
        },
        longitude: {
          type: Type.NUMBER,
          description: "Longitude of the search center",
        },
        radius_km: {
          type: Type.NUMBER,
          description: "Search radius in kilometers (max 50)",
        },
      },
      required: ["latitude", "longitude", "radius_km"],
    },
  },
  {
    name: "search_nearby_shelters",
    description:
      "Search for emergency shelters, community centers, and evacuation points near a location. Use when you need to recommend safe locations for displaced persons.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        latitude: {
          type: Type.NUMBER,
          description: "Latitude of the search center",
        },
        longitude: {
          type: Type.NUMBER,
          description: "Longitude of the search center",
        },
        radius_km: {
          type: Type.NUMBER,
          description: "Search radius in kilometers (max 50)",
        },
      },
      required: ["latitude", "longitude", "radius_km"],
    },
  },
  {
    name: "get_evacuation_route",
    description:
      "Get a traffic-aware evacuation route from an origin to a safe destination, optionally avoiding danger zones.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        origin_lat: { type: Type.NUMBER },
        origin_lng: { type: Type.NUMBER },
        destination_lat: { type: Type.NUMBER },
        destination_lng: { type: Type.NUMBER },
      },
      required: [
        "origin_lat",
        "origin_lng",
        "destination_lat",
        "destination_lng",
      ],
    },
  },
  {
    name: "get_weather_conditions",
    description:
      "Get current weather conditions and alerts for a specific location. Use to assess environmental risk factors.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        latitude: { type: Type.NUMBER },
        longitude: { type: Type.NUMBER },
      },
      required: ["latitude", "longitude"],
    },
  },
];

// ─── Shared Places API helpers ────────────────────────────────

interface PlaceLocation {
  latitude: number;
  longitude: number;
}

interface PlaceResult {
  name: string;
  address: string;
  location: PlaceLocation;
  is_open: boolean | null;
  phone: string | null;
  rating: number | null;
}

/**
 * Search via Places API (New) — `places.googleapis.com/v1/`.
 * Returns null if the API is unavailable (not enabled, auth error, etc.)
 * so the caller can fall through to the legacy API.
 */
async function searchPlacesNewApi(
  placeType: string,
  args: { latitude: number; longitude: number },
  radiusMeters: number
): Promise<PlaceResult[] | null> {
  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": MAPS_API_KEY,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.currentOpeningHours,places.nationalPhoneNumber,places.rating",
        },
        body: JSON.stringify({
          includedTypes: [placeType],
          maxResultCount: 10,
          rankPreference: "DISTANCE",
          locationRestriction: {
            circle: {
              center: { latitude: args.latitude, longitude: args.longitude },
              radius: radiusMeters,
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.warn("Places API (New) failed — will try legacy", {
        status: response.status,
        placeType,
        error: errorBody.slice(0, 300),
      });
      return null;
    }

    const data = await response.json();
    return (data.places || []).map(
      (p: Record<string, unknown>): PlaceResult => {
        const displayName = p.displayName as Record<string, string> | undefined;
        const loc = p.location as PlaceLocation | undefined;
        const hours = p.currentOpeningHours as Record<string, boolean> | undefined;
        return {
          name: displayName?.text || "Unknown",
          address: (p.formattedAddress as string) || "",
          location: {
            latitude: loc?.latitude || 0,
            longitude: loc?.longitude || 0,
          },
          is_open: hours?.openNow ?? null,
          phone: (p.nationalPhoneNumber as string) || null,
          rating: (p.rating as number) || null,
        };
      }
    );
  } catch (err) {
    logger.warn("Places API (New) exception", {
      placeType,
      error: err instanceof Error ? err.message : "Unknown",
    });
    return null;
  }
}

/**
 * Fallback: legacy Nearby Search API — `maps.googleapis.com/maps/api/place/`.
 * This uses the standard "Places API" which is more commonly enabled.
 * Returns null on failure.
 */
async function searchPlacesLegacyApi(
  placeType: string,
  args: { latitude: number; longitude: number },
  radiusMeters: number
): Promise<PlaceResult[] | null> {
  try {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    );
    url.searchParams.set("location", `${args.latitude},${args.longitude}`);
    url.searchParams.set("radius", String(radiusMeters));
    url.searchParams.set("type", placeType.split("|")[0]);
    url.searchParams.set("key", MAPS_API_KEY);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.warn("Legacy Places API HTTP error", {
        status: response.status,
        placeType,
        error: errorBody.slice(0, 300),
      });
      return null;
    }

    const data = await response.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      logger.warn("Legacy Places API returned non-OK status", {
        status: data.status,
        placeType,
        errorMessage: data.error_message || "",
      });
      return null;
    }

    return ((data.results || []) as Record<string, unknown>[]).map(
      (p): PlaceResult => {
        const geo = p.geometry as Record<string, unknown> | undefined;
        const loc = geo?.location as Record<string, number> | undefined;
        const hours = p.opening_hours as Record<string, boolean> | undefined;
        return {
          name: (p.name as string) || "Unknown",
          address: (p.vicinity as string) || "",
          location: {
            latitude: loc?.lat || 0,
            longitude: loc?.lng || 0,
          },
          is_open: hours?.open_now ?? null,
          phone: null,
          rating: (p.rating as number) || null,
        };
      }
    );
  } catch (err) {
    logger.warn("Legacy Places API exception", {
      placeType,
      error: err instanceof Error ? err.message : "Unknown",
    });
    return null;
  }
}

// ─── Handler Implementations ────────────────────────────────

export async function handleSearchNearbyHospitals(args: {
  latitude: number;
  longitude: number;
  radius_km: number;
}): Promise<Record<string, unknown>> {
  const radiusMeters = Math.min(args.radius_km, 50) * 1000;

  // Try Places API (New) first, fall back to legacy
  const hospitals = await searchPlacesNewApi("hospital", args, radiusMeters)
    ?? await searchPlacesLegacyApi("hospital", args, radiusMeters);

  return { hospitals: hospitals || [], count: (hospitals || []).length };
}

export async function handleSearchNearbyShelters(args: {
  latitude: number;
  longitude: number;
  radius_km: number;
}): Promise<Record<string, unknown>> {
  const radiusMeters = Math.min(args.radius_km, 50) * 1000;

  const shelters = await searchPlacesNewApi("community_center", args, radiusMeters)
    ?? await searchPlacesLegacyApi("community_center|city_hall|local_government_office", args, radiusMeters);

  return { shelters: shelters || [], count: (shelters || []).length };
}

export async function handleGetEvacuationRoute(args: {
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
}): Promise<Record<string, unknown>> {
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_API_KEY,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline,routes.legs,routes.warnings",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: { latitude: args.origin_lat, longitude: args.origin_lng },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: args.destination_lat,
              longitude: args.destination_lng,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: true,
      }),
    });

    if (!response.ok) {
      return { error: `Routes API error: ${response.status}`, routes: [] };
    }

    const data = await response.json();
    const routes = (data.routes || []).map(
      (r: Record<string, unknown>) => ({
        distance_km: ((r.distanceMeters as number) || 0) / 1000,
        duration_minutes: parseInt((r.duration as string) || "0") / 60,
        polyline: (r.polyline as Record<string, string>)?.encodedPolyline || "",
        warnings: r.warnings || [],
      })
    );

    return { routes, count: routes.length };
  } catch (error) {
    return {
      error: `Failed to get route: ${error instanceof Error ? error.message : "Unknown error"}`,
      routes: [],
    };
  }
}

export async function handleGetWeatherConditions(args: {
  latitude: number;
  longitude: number;
}): Promise<Record<string, unknown>> {
  const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${MAPS_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: { latitude: args.latitude, longitude: args.longitude },
      }),
    });

    if (!response.ok) {
      return {
        error: `Weather API error: ${response.status}`,
        conditions: null,
      };
    }

    const data = await response.json();
    return { conditions: data, source: "Google Weather API" };
  } catch (error) {
    return {
      error: `Failed to get weather: ${error instanceof Error ? error.message : "Unknown error"}`,
      conditions: null,
    };
  }
}

export async function handleSearchNearbyFireStations(args: {
  latitude: number;
  longitude: number;
  radius_km: number;
}): Promise<Record<string, unknown>> {
  const radiusMeters = Math.min(args.radius_km, 50) * 1000;

  const fire_stations = await searchPlacesNewApi("fire_station", args, radiusMeters)
    ?? await searchPlacesLegacyApi("fire_station", args, radiusMeters);

  return { fire_stations: fire_stations || [], count: (fire_stations || []).length };
}

/**
 * Route a function call from Gemini to the correct handler.
 */
export async function executeFunctionCall(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (name) {
    case "search_nearby_hospitals":
      return handleSearchNearbyHospitals(
        args as { latitude: number; longitude: number; radius_km: number }
      );
    case "search_nearby_shelters":
      return handleSearchNearbyShelters(
        args as { latitude: number; longitude: number; radius_km: number }
      );
    case "get_evacuation_route":
      return handleGetEvacuationRoute(
        args as {
          origin_lat: number;
          origin_lng: number;
          destination_lat: number;
          destination_lng: number;
        }
      );
    case "get_weather_conditions":
      return handleGetWeatherConditions(
        args as { latitude: number; longitude: number }
      );
    default:
      return { error: `Unknown function: ${name}` };
  }
}

/** Utility to calculate distance between two coordinates (Haversine) */
export function haversineDistance(
  a: GeoCoordinate,
  b: GeoCoordinate
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
