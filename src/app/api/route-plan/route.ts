// ─────────────────────────────────────────────────────────────
// POST /api/route-plan — Traffic-aware evacuation routing
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeRoute } from "@/lib/maps/clients";

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

export async function POST(request: NextRequest) {
  try {
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

    console.error("Route API error:", error);
    return NextResponse.json(
      { error: "Failed to compute route" },
      { status: 500 }
    );
  }
}
