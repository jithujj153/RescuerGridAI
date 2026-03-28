// ─────────────────────────────────────────────────────────────
// Weather Types — Weather conditions and risk assessment
// ─────────────────────────────────────────────────────────────

import type { GeoCoordinate } from "./incident";

export interface WeatherConditions {
  location: GeoCoordinate;
  temperature_c: number;
  feels_like_c: number;
  humidity_percent: number;
  wind_speed_kmh: number;
  wind_direction: string;
  description: string;
  icon_url: string;
  uv_index: number;
  visibility_km: number;
  alerts: WeatherAlert[];
}

export interface WeatherAlert {
  event: string;
  severity: "extreme" | "severe" | "moderate" | "minor";
  description: string;
  start_time: string;
  end_time: string;
}

export interface WeatherRequest {
  location: GeoCoordinate;
}

export interface HourlyForecast {
  time: string;
  temperature_c: number;
  precipitation_probability: number;
  wind_speed_kmh: number;
  description: string;
}
