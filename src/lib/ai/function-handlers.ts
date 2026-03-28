// ─────────────────────────────────────────────────────────────
// Function Handlers — Implementations of Gemini function calls
// These are invoked when Gemini decides to call a registered tool
// ─────────────────────────────────────────────────────────────

import type { GeoCoordinate } from "@/lib/types/incident";
import { Type, type FunctionDeclaration } from "@google/genai";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

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

// ─── Handler Implementations ────────────────────────────────

export async function handleSearchNearbyHospitals(args: {
  latitude: number;
  longitude: number;
  radius_km: number;
}): Promise<Record<string, unknown>> {
  const radiusMeters = Math.min(args.radius_km, 50) * 1000;
  const url = "https://places.googleapis.com/v1/places:searchNearby";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_API_KEY,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.currentOpeningHours,places.nationalPhoneNumber,places.rating",
      },
      body: JSON.stringify({
        includedTypes: ["hospital"],
        maxResultCount: 10,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: args.latitude, longitude: args.longitude },
            radius: radiusMeters,
          },
        },
      }),
    });

    if (!response.ok) {
      return { error: `Places API error: ${response.status}`, hospitals: [] };
    }

    const data = await response.json();
    const hospitals = (data.places || []).map(
      (p: Record<string, unknown>) => ({
        name: (p.displayName as Record<string, string>)?.text || "Unknown",
        address: p.formattedAddress || "",
        location: p.location || {},
        is_open: (p.currentOpeningHours as Record<string, boolean>)?.openNow ?? null,
        phone: p.nationalPhoneNumber || null,
        rating: p.rating || null,
      })
    );

    return { hospitals, count: hospitals.length };
  } catch (error) {
    return {
      error: `Failed to search hospitals: ${error instanceof Error ? error.message : "Unknown error"}`,
      hospitals: [],
    };
  }
}

export async function handleSearchNearbyShelters(args: {
  latitude: number;
  longitude: number;
  radius_km: number;
}): Promise<Record<string, unknown>> {
  const radiusMeters = Math.min(args.radius_km, 50) * 1000;
  const url = "https://places.googleapis.com/v1/places:searchText";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_API_KEY,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.currentOpeningHours",
      },
      body: JSON.stringify({
        textQuery: "emergency shelter evacuation center community center",
        maxResultCount: 10,
        locationBias: {
          circle: {
            center: { latitude: args.latitude, longitude: args.longitude },
            radius: radiusMeters,
          },
        },
      }),
    });

    if (!response.ok) {
      return { error: `Places API error: ${response.status}`, shelters: [] };
    }

    const data = await response.json();
    const shelters = (data.places || []).map(
      (p: Record<string, unknown>) => ({
        name: (p.displayName as Record<string, string>)?.text || "Unknown",
        address: p.formattedAddress || "",
        location: p.location || {},
        is_open: (p.currentOpeningHours as Record<string, boolean>)?.openNow ?? null,
      })
    );

    return { shelters, count: shelters.length };
  } catch (error) {
    return {
      error: `Failed to search shelters: ${error instanceof Error ? error.message : "Unknown error"}`,
      shelters: [],
    };
  }
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
