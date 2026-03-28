// ─────────────────────────────────────────────────────────────
// Zod Schemas — Runtime validation for Gemini structured output
// ─────────────────────────────────────────────────────────────

import { z } from "zod";
import { HAZARD_TYPES, SEVERITY_LEVELS } from "@/lib/types/incident";

export const GeoCoordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const AffectedZoneSchema = z.object({
  center: GeoCoordinateSchema,
  radius_km: z.number().min(0).max(500),
  description: z.string().min(1).max(500),
});

export const NewsReferenceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  source: z.string(),
});

export const ActionChecklistSchema = z.object({
  citizens: z.array(z.string()).min(1).max(10),
  responders: z.array(z.string()).min(1).max(10),
  city_ops: z.array(z.string()).min(1).max(10),
});

export const IncidentAnalysisSchema = z.object({
  incident_id: z.string(),
  hazard_type: z.enum(HAZARD_TYPES),
  severity: z.enum(SEVERITY_LEVELS),
  confidence: z.number().min(0).max(1),
  affected_zone: AffectedZoneSchema,
  summary: z.string().min(10).max(2000),
  verified_facts: z.array(z.string()),
  unverified_claims: z.array(z.string()),
  next_actions: ActionChecklistSchema,
  urgency_window: z.string(),
  related_news: z.array(NewsReferenceSchema),
  timestamp: z.string(),
});

/** Validate the analyze endpoint request body */
export const AnalyzeRequestSchema = z
  .object({
    text: z.string().max(5000).optional(),
    imageBase64: z.string().optional(),
    imageMimeType: z
      .enum(["image/jpeg", "image/png", "image/webp", "image/gif"])
      .optional(),
    audioTranscript: z.string().max(5000).optional(),
    newsUrls: z.array(z.string().url()).max(5).optional(),
    location: GeoCoordinateSchema.optional(),
  })
  .refine(
    (data) => data.text || data.imageBase64 || data.audioTranscript,
    { message: "At least one input (text, image, or audio) is required" }
  );

export type ValidatedAnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
