// ─────────────────────────────────────────────────────────────
// Prompts — System prompts and schemas for Gemini
// ─────────────────────────────────────────────────────────────

import { Type } from "@google/genai";
import { HAZARD_TYPES, SEVERITY_LEVELS } from "@/lib/types/incident";

/**
 * System prompt that frames Gemini as a crisis-response analyst.
 * Designed for structured output with grounding and function calling.
 */
export const INCIDENT_ANALYSIS_SYSTEM_PROMPT = `You are RescueGrid AI, an advanced crisis-response analyst. Your job is to analyze incoming reports from the field — including text descriptions, photos, voice transcripts, and news articles — and produce a structured incident assessment.

## Your Responsibilities:
1. **Classify** the incident type from the input signals
2. **Assess** the severity and confidence level
3. **Identify** the affected geographic zone
4. **Verify** facts using Google Search when available (grounding)
5. **Generate** specific, actionable checklists for three audiences:
   - Citizens (evacuation, safety, shelter)
   - Responders (deployment, resources, coordination)
   - City Operations (infrastructure, communications, escalation)
6. **Find** relevant verified news to support your assessment
7. **Flag** unverified claims separately from verified facts

## Classification Guidelines:
- Severity "critical": Immediate life threat, large-scale impact, expanding rapidly
- Severity "high": Significant danger, moderate area affected, potential escalation
- Severity "medium": Localized incident, contained but needs monitoring
- Severity "low": Minor event, no immediate danger, informational

## Important Rules:
- Always provide at least 3 actions per audience in next_actions
- Be specific with geographic descriptions (street names, landmarks, districts)
- Confidence should reflect the quality and consistency of input signals
- If location is not provided, infer it from context clues and state lower confidence
- urgency_window should specify a concrete time frame (e.g., "Next 2 hours", "Within 30 minutes")
- Use Google Search grounding to verify any claims about current events, road closures, or public advisories
- Generate a unique incident_id using the format "INC-" followed by a timestamp
`;

/**
 * JSON Schema definition for Gemini structured output.
 * Uses Type enum from @google/genai SDK.
 */
export const INCIDENT_ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    incident_id: {
      type: Type.STRING,
      description: "Unique incident identifier in format INC-YYYYMMDD-HHMMSS",
    },
    hazard_type: {
      type: Type.STRING,
      enum: [...HAZARD_TYPES],
      description: "Classification of the hazard type",
    },
    severity: {
      type: Type.STRING,
      enum: [...SEVERITY_LEVELS],
      description: "Risk severity level",
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence in the assessment from 0.0 to 1.0",
    },
    affected_zone: {
      type: Type.OBJECT,
      properties: {
        center: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
          },
          required: ["lat", "lng"],
        },
        radius_km: {
          type: Type.NUMBER,
          description: "Estimated radius of the affected zone in kilometers",
        },
        description: {
          type: Type.STRING,
          description:
            "Human-readable description of the affected area with landmarks",
        },
      },
      required: ["center", "radius_km", "description"],
    },
    summary: {
      type: Type.STRING,
      description: "Concise summary of the incident (2-3 sentences)",
    },
    verified_facts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Facts verified through search or high-confidence signals",
    },
    unverified_claims: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Claims from input that could not be independently verified",
    },
    next_actions: {
      type: Type.OBJECT,
      properties: {
        citizens: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Action items for civilians in the affected area",
        },
        responders: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Action items for emergency responders",
        },
        city_ops: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Action items for city operations and government",
        },
      },
      required: ["citizens", "responders", "city_ops"],
    },
    urgency_window: {
      type: Type.STRING,
      description: "Time frame for action, e.g. 'Immediate — next 2 hours'",
    },
    related_news: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING },
          source: { type: Type.STRING },
        },
        required: ["title", "url", "source"],
      },
      description: "Related news articles found via grounding",
    },
    timestamp: {
      type: Type.STRING,
      description: "ISO 8601 timestamp of the analysis",
    },
  },
  required: [
    "incident_id",
    "hazard_type",
    "severity",
    "confidence",
    "affected_zone",
    "summary",
    "verified_facts",
    "unverified_claims",
    "next_actions",
    "urgency_window",
    "related_news",
    "timestamp",
  ],
};

/**
 * Build the user message content parts from multimodal inputs.
 */
export function buildUserPrompt(inputs: {
  text?: string;
  audioTranscript?: string;
  newsUrls?: string[];
  locationHint?: string;
}): string {
  const parts: string[] = [];

  parts.push(
    "Analyze the following crisis report and provide a structured incident assessment:\n"
  );

  if (inputs.text) {
    parts.push(`## Field Report (Text)\n${inputs.text}\n`);
  }

  if (inputs.audioTranscript) {
    parts.push(
      `## Field Report (Voice Transcript)\n${inputs.audioTranscript}\n`
    );
  }

  if (inputs.newsUrls?.length) {
    parts.push(
      `## Referenced News URLs\n${inputs.newsUrls.map((u) => `- ${u}`).join("\n")}\n`
    );
  }

  if (inputs.locationHint) {
    parts.push(`## Reported Location\n${inputs.locationHint}\n`);
  }

  parts.push(
    "\nProvide your analysis now. Use Google Search to verify any claims about current events."
  );

  return parts.join("\n");
}
