// ─────────────────────────────────────────────────────────────
// POST /api/weather — Weather conditions and risk assessment
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWeatherConditions } from "@/lib/maps/clients";

const WeatherRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = WeatherRequestSchema.parse(body);

    const conditions = await getWeatherConditions({
      lat: validated.lat,
      lng: validated.lng,
    });

    if (!conditions) {
      return NextResponse.json(
        { error: "Weather data unavailable" },
        { status: 503 }
      );
    }

    return NextResponse.json(conditions);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Weather API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather" },
      { status: 500 }
    );
  }
}
