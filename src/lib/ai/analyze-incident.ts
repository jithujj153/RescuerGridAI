// ─────────────────────────────────────────────────────────────
// Analyze Incident — Core Gemini orchestration engine
// Three-phase pipeline: function calling → grounding → structured output
// ─────────────────────────────────────────────────────────────

import { getGeminiClient, MODELS } from "./gemini-client";
import {
  INCIDENT_ANALYSIS_SYSTEM_PROMPT,
  INCIDENT_ANALYSIS_RESPONSE_SCHEMA,
  buildUserPrompt,
} from "./prompts";
import {
  FUNCTION_DECLARATIONS,
  executeFunctionCall,
  handleSearchNearbyHospitals,
  handleSearchNearbyShelters,
  handleSearchNearbyFireStations,
} from "./function-handlers";
import { IncidentAnalysisSchema } from "@/lib/schemas/incident";
import { logger } from "@/lib/logger";
import type { IncidentAnalysis, NearbyResource, EvacuationRoute } from "@/lib/types/incident";
import type { Part, Content, FunctionCall } from "@google/genai";

interface CollectedResources {
  hospitals: NearbyResource[];
  shelters: NearbyResource[];
  fire_stations: NearbyResource[];
  routes: EvacuationRoute[];
}

const MAX_FUNCTION_CALL_ROUNDS = 5;

interface AnalyzeInput {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  audioTranscript?: string;
  newsUrls?: string[];
  locationLat?: number;
  locationLng?: number;
}

/**
 * Analyze a multimodal crisis report using Gemini across three
 * separate phases because the API enforces mutual exclusivity
 * between function calling, Google Search grounding, and
 * structured JSON output (responseMimeType).
 *
 * Phase 1 — Function calling: Agentic loop that invokes spatial
 *   tools (nearby places, routes, weather) to gather real-time data.
 * Phase 2 — Google Search grounding: Verifies facts and discovers
 *   related news using Google Search as a built-in tool.
 * Phase 3 — Structured output: Converts the enriched analysis into
 *   a schema-validated JSON response (with retry on parse failure).
 */
export async function analyzeIncident(
  input: AnalyzeInput
): Promise<IncidentAnalysis> {
  const client = getGeminiClient();

  // ─── Build multimodal content parts ─────────────────────
  const userParts: Part[] = [];

  const textPrompt = buildUserPrompt({
    text: input.text,
    audioTranscript: input.audioTranscript,
    newsUrls: input.newsUrls,
    locationHint:
      input.locationLat && input.locationLng
        ? `${input.locationLat}, ${input.locationLng}`
        : undefined,
  });
  userParts.push({ text: textPrompt });

  if (input.imageBase64 && input.imageMimeType) {
    userParts.push({
      inlineData: {
        mimeType: input.imageMimeType,
        data: input.imageBase64,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 1 — Function calling: gather real-time spatial data
  //   Side-channel collects raw results for map rendering.
  // ═══════════════════════════════════════════════════════════
  const fcContents: Content[] = [
    { role: "user", parts: userParts },
  ];

  const collected: CollectedResources = {
    hospitals: [],
    shelters: [],
    fire_stations: [],
    routes: [],
  };

  let functionCallingText = "";

  for (let round = 0; round < MAX_FUNCTION_CALL_ROUNDS; round++) {
    const response = await client.models.generateContent({
      model: MODELS.FLASH,
      contents: fcContents,
      config: {
        systemInstruction: INCIDENT_ANALYSIS_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
        temperature: 0.2,
        maxOutputTokens: 16384,
      },
    });

    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      fcContents.push({
        role: "model",
        parts: functionCalls.map((fc: FunctionCall) => ({ functionCall: fc })),
      });

      const functionResponses: Part[] = await Promise.all(
        functionCalls.map(async (fc: FunctionCall) => {
          const name = fc.name!;
          const args = (fc.args as Record<string, unknown>) || {};
          const result = await executeFunctionCall(name, args);

          collectResources(name, result, collected);

          return {
            functionResponse: { name, response: result },
          } as Part;
        })
      );

      fcContents.push({ role: "user", parts: functionResponses });
      continue;
    }

    functionCallingText = response.text || "";
    break;
  }

  if (!functionCallingText) {
    throw new Error("Gemini returned empty analysis after function-calling phase");
  }

  logger.info("Phase 1 complete (function calling)", {
    textLength: functionCallingText.length,
    hospitals: collected.hospitals.length,
    shelters: collected.shelters.length,
    routes: collected.routes.length,
  });

  // ═══════════════════════════════════════════════════════════
  // PHASE 2 — Google Search grounding: verify facts & find news
  // ═══════════════════════════════════════════════════════════
  let groundedText = functionCallingText;
  try {
    const groundingResponse = await client.models.generateContent({
      model: MODELS.FLASH,
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Using Google Search, verify the key facts in the following crisis analysis. " +
                "Add any relevant verified news articles, public advisories, or official reports you find. " +
                "Correct any inaccuracies and clearly separate verified facts from unverified claims.\n\n" +
                functionCallingText,
            },
          ],
        },
      ],
      config: {
        systemInstruction: INCIDENT_ANALYSIS_SYSTEM_PROMPT,
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        maxOutputTokens: 16384,
      },
    });

    groundedText = groundingResponse.text || functionCallingText;
    logger.info("Phase 2 complete (grounding)", {
      textLength: groundedText.length,
    });
  } catch (groundingError) {
    logger.warn("Phase 2 grounding failed, continuing with ungrounded analysis", {
      error: groundingError instanceof Error ? groundingError.message : "Unknown",
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 3 — Structured output: convert to validated JSON
  //   Retries once on parse/validation failure with feedback.
  // ═══════════════════════════════════════════════════════════
  const MAX_STRUCTURE_ATTEMPTS = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_STRUCTURE_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 0
        ? "Convert the following crisis analysis into the required JSON structure. " +
          "Preserve all facts, actions, locations, and assessments exactly.\n\n" +
          groundedText
        : "Your previous JSON output had errors. " +
          `Error: ${lastError?.message}. ` +
          "Please fix the JSON and try again. Output ONLY valid JSON matching the schema.\n\n" +
          groundedText;

    const structureResponse = await client.models.generateContent({
      model: MODELS.FLASH,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: INCIDENT_ANALYSIS_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: INCIDENT_ANALYSIS_RESPONSE_SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 16384,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const rawText = structureResponse.text || "";

    if (!rawText) {
      lastError = new Error("Gemini returned empty structured response");
      logger.warn("Phase 3 attempt returned empty text", { attempt });
      continue;
    }

    try {
      const sanitized = sanitizeJsonString(rawText);
      const parsed = JSON.parse(sanitized);
      const validated = IncidentAnalysisSchema.parse(parsed);

      // Attach resources from Phase 1 function calling
      if (collected.hospitals.length > 0) validated.nearby_hospitals = collected.hospitals;
      if (collected.shelters.length > 0) validated.nearby_shelters = collected.shelters;
      if (collected.fire_stations.length > 0) validated.nearby_fire_stations = collected.fire_stations;
      if (collected.routes.length > 0) validated.evacuation_routes = collected.routes;

      // Fallback: if Gemini didn't call spatial functions, fetch directly
      await fetchMissingResources(validated, collected);

      logger.info("Phase 3 complete (structured output)", {
        attempt,
        hospitals: validated.nearby_hospitals?.length ?? 0,
        shelters: validated.nearby_shelters?.length ?? 0,
        fireStations: validated.nearby_fire_stations?.length ?? 0,
        routes: validated.evacuation_routes?.length ?? 0,
      });
      return validated;
    } catch (parseError) {
      lastError =
        parseError instanceof Error
          ? parseError
          : new Error(String(parseError));

      logger.warn("Phase 3 parse/validation failed", {
        attempt,
        error: lastError.message,
        rawTextLength: rawText.length,
        rawTextSnippet: rawText.slice(0, 200),
      });
    }
  }

  throw new Error(
    `Structured output failed after ${MAX_STRUCTURE_ATTEMPTS} attempts: ${lastError?.message}`
  );
}

/**
 * Sanitize a possibly-malformed JSON string from Gemini.
 * Handles markdown fences, trailing commas, and BOM characters.
 */
function sanitizeJsonString(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  s = s.replace(/^\uFEFF/, "");
  s = s.replace(/,\s*([\]}])/g, "$1");
  return s.trim();
}

/**
 * If Phase 1 didn't call spatial functions (the model chose not to),
 * fetch hospitals and shelters directly using the incident's
 * affected_zone center. This ensures the map always shows resources.
 */
async function fetchMissingResources(
  analysis: IncidentAnalysis,
  collected: CollectedResources
): Promise<void> {
  const { lat, lng } = analysis.affected_zone.center;
  const radiusKm = Math.max(analysis.affected_zone.radius_km * 2, 10);

  const tasks: Promise<void>[] = [];

  if (!collected.hospitals.length) {
    tasks.push(
      handleSearchNearbyHospitals({ latitude: lat, longitude: lng, radius_km: radiusKm })
        .then((result) => {
          collectResources("search_nearby_hospitals", result, collected);
          if (collected.hospitals.length > 0) {
            analysis.nearby_hospitals = collected.hospitals;
          }
        })
        .catch(() => {
          logger.warn("Fallback hospital fetch failed");
        })
    );
  }

  if (!collected.shelters.length) {
    tasks.push(
      handleSearchNearbyShelters({ latitude: lat, longitude: lng, radius_km: radiusKm })
        .then((result) => {
          collectResources("search_nearby_shelters", result, collected);
          if (collected.shelters.length > 0) {
            analysis.nearby_shelters = collected.shelters;
          }
        })
        .catch(() => {
          logger.warn("Fallback shelter fetch failed");
        })
    );
  }

  if (!collected.fire_stations.length) {
    tasks.push(
      handleSearchNearbyFireStations({ latitude: lat, longitude: lng, radius_km: radiusKm })
        .then((result) => {
          collectResources("search_nearby_fire_stations", result, collected);
          if (collected.fire_stations.length > 0) {
            analysis.nearby_fire_stations = collected.fire_stations;
          }
        })
        .catch(() => {
          logger.warn("Fallback fire station fetch failed");
        })
    );
  }

  if (tasks.length > 0) {
    logger.info("Fetching nearby resources from Maps APIs", {
      lat, lng, radiusKm,
      needHospitals: !collected.hospitals.length,
      needShelters: !collected.shelters.length,
      needFireStations: !collected.fire_stations.length,
    });
    await Promise.all(tasks);
  }
}

/**
 * Extract spatial data from function call results into the
 * side-channel so it can be attached to the final response
 * for map rendering on the frontend.
 */
function collectResources(
  fnName: string,
  result: Record<string, unknown>,
  collected: CollectedResources
): void {
  try {
    if (fnName === "search_nearby_hospitals" && Array.isArray(result.hospitals)) {
      for (const h of result.hospitals as Record<string, unknown>[]) {
        const loc = h.location as Record<string, number> | undefined;
        if (!loc?.latitude || !loc?.longitude) continue;
        collected.hospitals.push({
          name: (h.name as string) || "Hospital",
          address: (h.address as string) || "",
          location: { latitude: loc.latitude, longitude: loc.longitude },
          is_open: (h.is_open as boolean | null) ?? null,
          phone: (h.phone as string | null) ?? null,
          rating: (h.rating as number | null) ?? null,
          type: "hospital",
        });
      }
    }

    if (fnName === "search_nearby_shelters" && Array.isArray(result.shelters)) {
      for (const s of result.shelters as Record<string, unknown>[]) {
        const loc = s.location as Record<string, number> | undefined;
        if (!loc?.latitude || !loc?.longitude) continue;
        collected.shelters.push({
          name: (s.name as string) || "Shelter",
          address: (s.address as string) || "",
          location: { latitude: loc.latitude, longitude: loc.longitude },
          is_open: (s.is_open as boolean | null) ?? null,
          type: "shelter",
        });
      }
    }

    if (fnName === "search_nearby_fire_stations" && Array.isArray(result.fire_stations)) {
      for (const f of result.fire_stations as Record<string, unknown>[]) {
        const loc = f.location as Record<string, number> | undefined;
        if (!loc?.latitude || !loc?.longitude) continue;
        collected.fire_stations.push({
          name: (f.name as string) || "Fire Station",
          address: (f.address as string) || "",
          location: { latitude: loc.latitude, longitude: loc.longitude },
          is_open: (f.is_open as boolean | null) ?? null,
          phone: (f.phone as string | null) ?? null,
          type: "fire_station",
        });
      }
    }

    if (fnName === "get_evacuation_route" && Array.isArray(result.routes)) {
      for (const r of result.routes as Record<string, unknown>[]) {
        if (!(r.polyline as string)) continue;
        collected.routes.push({
          distance_km: (r.distance_km as number) || 0,
          duration_minutes: (r.duration_minutes as number) || 0,
          polyline: (r.polyline as string) || "",
          warnings: (r.warnings as string[]) || [],
        });
      }
    }
  } catch {
    logger.warn("Failed to collect resources from function call", { fnName });
  }
}
