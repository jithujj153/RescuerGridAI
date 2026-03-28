import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeRoute } from "@/lib/maps/clients";
import { logger } from "@/lib/logger";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const RouteRequestSchema = z.object({
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  mode: z.enum(["evacuee", "responder"]).default("evacuee"),
});

const RATE_LIMIT = { maxRequests: 20, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const rl = checkRateLimit(`route:${getRateLimitKey(request)}`, RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const validated = RouteRequestSchema.parse(body);

    const route = await computeRoute(
      validated.origin,
      validated.destination,
      validated.mode
    );

    if (!route) {
      return NextResponse.json(
        { error: "No route found" },
        { status: 404 }
      );
    }

    return NextResponse.json(route);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Route API error", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to compute route" },
      { status: 500 }
    );
  }
}
