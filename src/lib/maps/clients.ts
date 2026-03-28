// ─────────────────────────────────────────────────────────────
// Maps Clients — Wrappers for Google Maps Platform APIs
// Used both by API routes and by Gemini function handlers
// ─────────────────────────────────────────────────────────────

import type { GeoCoordinate } from "@/lib/types/incident";
import type { NearbyPlace, PlaceCategory } from "@/lib/types/place";
import type { EvacuationRoute } from "@/lib/types/route";
import type { WeatherConditions } from "@/lib/types/weather";
import { logger } from "@/lib/logger";

function getMapsApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");
  return key;
}

// ─── Places API (New) ───────────────────────────────────────

export async function searchNearbyPlaces(
  location: GeoCoordinate,
  radiusKm: number,
  category: PlaceCategory,
  maxResults: number = 10
): Promise<NearbyPlace[]> {
  const key = getMapsApiKey();
  const radiusMeters = Math.min(radiusKm, 50) * 1000;

  const isTextSearch = category === "shelter";
  const url = isTextSearch
    ? "https://places.googleapis.com/v1/places:searchText"
    : "https://places.googleapis.com/v1/places:searchNearby";

  const body = isTextSearch
    ? {
        textQuery: "emergency shelter evacuation center relief camp",
        maxResultCount: maxResults,
        locationBias: {
          circle: {
            center: { latitude: location.lat, longitude: location.lng },
            radius: radiusMeters,
          },
        },
      }
    : {
        includedTypes: [category === "hospital" ? "hospital" : category],
        maxResultCount: maxResults,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: location.lat, longitude: location.lng },
            radius: radiusMeters,
          },
        },
      };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.currentOpeningHours,places.nationalPhoneNumber,places.rating",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    logger.error("Places API error", { status: response.status, body: await response.text() });
    return [];
  }

  const data = await response.json();
  return (data.places || []).map(
    (p: Record<string, unknown>): NearbyPlace => {
      const displayName = p.displayName as Record<string, string> | undefined;
      const location = p.location as Record<string, number> | undefined;
      const hours = p.currentOpeningHours as Record<string, boolean> | undefined;
      return {
        place_id: (p.id as string) || "",
        name: displayName?.text || "Unknown",
        address: (p.formattedAddress as string) || "",
        location: {
          lat: location?.latitude || 0,
          lng: location?.longitude || 0,
        },
        distance_km: 0,
        category,
        is_open: hours?.openNow ?? null,
        phone: (p.nationalPhoneNumber as string) || undefined,
        rating: (p.rating as number) || undefined,
      };
    }
  );
}

// ─── Routes API ─────────────────────────────────────────────

export async function computeRoute(
  origin: GeoCoordinate,
  destination: GeoCoordinate,
  mode: "evacuee" | "responder" = "evacuee"
): Promise<EvacuationRoute | null> {
  const key = getMapsApiKey();
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.warnings,routes.legs.steps.navigationInstruction",
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: { latitude: origin.lat, longitude: origin.lng },
        },
      },
      destination: {
        location: {
          latLng: { latitude: destination.lat, longitude: destination.lng },
        },
      },
      travelMode: "DRIVE",
      routingPreference:
        mode === "responder" ? "TRAFFIC_AWARE_OPTIMAL" : "TRAFFIC_AWARE",
      computeAlternativeRoutes: mode === "evacuee",
    }),
  });

  if (!response.ok) {
    logger.error("Routes API error", { status: response.status });
    return null;
  }

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) return null;

  return {
    origin: { location: origin },
    destination: { location: destination },
    segments: [],
    total_distance_km: (route.distanceMeters || 0) / 1000,
    total_duration_minutes:
      parseInt(route.duration?.replace("s", "") || "0") / 60,
    warnings: route.warnings || [],
    avoid_zones: [],
    polyline: route.polyline?.encodedPolyline || "",
  };
}

// ─── Weather API ────────────────────────────────────────────

export async function getWeatherConditions(
  location: GeoCoordinate
): Promise<WeatherConditions | null> {
  const key = getMapsApiKey();
  const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${key}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: { latitude: location.lat, longitude: location.lng },
      }),
    });

    if (!response.ok) {
      logger.error("Weather API error", { status: response.status });
      return null;
    }

    const data = await response.json();
    return {
      location,
      temperature_c: data.temperature?.degrees ?? 0,
      feels_like_c: data.feelsLikeTemperature?.degrees ?? 0,
      humidity_percent: data.relativeHumidity ?? 0,
      wind_speed_kmh: data.wind?.speed?.value ?? 0,
      wind_direction: data.wind?.direction?.cardinal || "N/A",
      description: data.weatherCondition?.description?.text || "Unknown",
      icon_url: data.weatherCondition?.iconBaseUri || "",
      uv_index: data.uvIndex ?? 0,
      visibility_km: (data.visibility?.distance?.value ?? 0) / 1000,
      alerts: [],
    };
  } catch (error) {
    logger.error("Weather API exception", { error: error instanceof Error ? error.message : "Unknown" });
    return null;
  }
}
