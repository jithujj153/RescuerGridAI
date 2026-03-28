// ─────────────────────────────────────────────────────────────
// Place Types — Hospitals, shelters, and emergency resources
// ─────────────────────────────────────────────────────────────

import type { GeoCoordinate } from "./incident";

export type PlaceCategory = "hospital" | "shelter" | "fire_station" | "police";

export interface NearbyPlace {
  place_id: string;
  name: string;
  address: string;
  location: GeoCoordinate;
  distance_km: number;
  category: PlaceCategory;
  is_open: boolean | null;
  phone?: string;
  rating?: number;
}

export interface PlacesRequest {
  location: GeoCoordinate;
  radius_km: number;
  category: PlaceCategory;
  max_results?: number;
}

export interface PlacesResponse {
  places: NearbyPlace[];
  query_location: GeoCoordinate;
  radius_km: number;
}
