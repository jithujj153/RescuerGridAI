import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWeatherConditions } from "@/lib/maps/clients";
import { logger } from "@/lib/logger";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const WeatherRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const rl = checkRateLimit(`weather:${getRateLimitKey(request)}`, RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

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

    logger.error("Weather API error", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to fetch weather" },
      { status: 500 }
    );
  }
}
