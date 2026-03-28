// ─────────────────────────────────────────────────────────────
// POST /api/places — Search for hospitals, shelters, etc.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchNearbyPlaces } from "@/lib/maps/clients";
import type { PlaceCategory } from "@/lib/types/place";

const PlacesRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_km: z.number().min(0.1).max(50).default(10),
  category: z.enum(["hospital", "shelter", "fire_station", "police"]),
  max_results: z.number().min(1).max(20).default(10),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = PlacesRequestSchema.parse(body);

    const places = await searchNearbyPlaces(
      { lat: validated.lat, lng: validated.lng },
      validated.radius_km,
      validated.category as PlaceCategory,
      validated.max_results
    );

    return NextResponse.json({
      places,
      query: {
        location: { lat: validated.lat, lng: validated.lng },
        radius_km: validated.radius_km,
        category: validated.category,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Places API error:", error);
    return NextResponse.json(
      { error: "Failed to search places" },
      { status: 500 }
    );
  }
}
