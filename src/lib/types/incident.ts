// ─────────────────────────────────────────────────────────────
// Incident Types — Core domain model for RescueGrid AI
// ─────────────────────────────────────────────────────────────

export const HAZARD_TYPES = [
  "flood",
  "wildfire",
  "earthquake",
  "road_accident",
  "heatwave",
  "missing_person",
  "storm",
  "industrial",
  "landslide",
  "other",
] as const;

export type HazardType = (typeof HAZARD_TYPES)[number];

export const SEVERITY_LEVELS = ["critical", "high", "medium", "low"] as const;

export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface AffectedZone {
  center: GeoCoordinate;
  radius_km: number;
  description: string;
}

export interface ActionChecklist {
  citizens: string[];
  responders: string[];
  city_ops: string[];
}

export interface NewsReference {
  title: string;
  url: string;
  source: string;
}

export interface NearbyResource {
  name: string;
  address: string;
  location: { latitude: number; longitude: number };
  is_open?: boolean | null;
  phone?: string | null;
  rating?: number | null;
  type: "hospital" | "shelter" | "fire_station";
}

export interface EvacuationRoute {
  distance_km: number;
  duration_minutes: number;
  polyline: string;
  warnings: string[];
}

export interface IncidentAnalysis {
  incident_id: string;
  hazard_type: HazardType;
  severity: SeverityLevel;
  confidence: number;
  affected_zone: AffectedZone;
  summary: string;
  verified_facts: string[];
  unverified_claims: string[];
  next_actions: ActionChecklist;
  urgency_window: string;
  related_news: NewsReference[];
  timestamp: string;
  nearby_hospitals?: NearbyResource[];
  nearby_shelters?: NearbyResource[];
  nearby_fire_stations?: NearbyResource[];
  evacuation_routes?: EvacuationRoute[];
}

/** Shape of data sent from the client to the /api/analyze endpoint */
export interface AnalyzeRequest {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  audioTranscript?: string;
  newsUrls?: string[];
  location?: GeoCoordinate;
}

/** Severity metadata for UI rendering */
export const SEVERITY_META: Record<
  SeverityLevel,
  { label: string; color: string; icon: string }
> = {
  critical: { label: "Critical", color: "#ef4444", icon: "🔴" },
  high: { label: "High", color: "#f97316", icon: "🟠" },
  medium: { label: "Medium", color: "#eab308", icon: "🟡" },
  low: { label: "Low", color: "#22c55e", icon: "🟢" },
};

/** Hazard type metadata for UI rendering */
export const HAZARD_META: Record<
  HazardType,
  { label: string; icon: string; mapColor: string }
> = {
  flood: { label: "Flood", icon: "🌊", mapColor: "#3b82f6" },
  wildfire: { label: "Wildfire", icon: "🔥", mapColor: "#ef4444" },
  earthquake: { label: "Earthquake", icon: "🌍", mapColor: "#a855f7" },
  road_accident: { label: "Road Accident", icon: "🚗", mapColor: "#f97316" },
  heatwave: { label: "Heatwave", icon: "☀️", mapColor: "#eab308" },
  missing_person: { label: "Missing Person", icon: "🔍", mapColor: "#8b5cf6" },
  storm: { label: "Storm", icon: "⛈️", mapColor: "#6366f1" },
  industrial: { label: "Industrial", icon: "🏭", mapColor: "#64748b" },
  landslide: { label: "Landslide", icon: "⛰️", mapColor: "#92400e" },
  other: { label: "Other", icon: "⚠️", mapColor: "#6b7280" },
};
