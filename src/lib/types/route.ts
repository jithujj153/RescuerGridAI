// ─────────────────────────────────────────────────────────────
// Route Types — Evacuation and responder dispatch routes
// ─────────────────────────────────────────────────────────────

import type { GeoCoordinate } from "./incident";

export interface RouteWaypoint {
  location: GeoCoordinate;
  label?: string;
}

export interface RouteSegment {
  polyline: string; // Encoded polyline
  distance_meters: number;
  duration_seconds: number;
  traffic_condition: "normal" | "slow" | "congested" | "blocked";
}

export interface EvacuationRoute {
  origin: RouteWaypoint;
  destination: RouteWaypoint;
  segments: RouteSegment[];
  total_distance_km: number;
  total_duration_minutes: number;
  warnings: string[];
  avoid_zones: GeoCoordinate[];
  polyline: string;
}

export interface RouteRequest {
  origin: GeoCoordinate;
  destination: GeoCoordinate;
  avoidZones?: GeoCoordinate[];
  mode?: "evacuee" | "responder";
}
