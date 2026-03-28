// ─────────────────────────────────────────────────────────────
// Analyze Incident — Core Gemini orchestration engine
// Handles multimodal input → structured incident output
// with function calling loop and Google Search grounding
// ─────────────────────────────────────────────────────────────

import { getGeminiClient, MODELS } from "./gemini-client";
import {
  INCIDENT_ANALYSIS_SYSTEM_PROMPT,
  INCIDENT_ANALYSIS_RESPONSE_SCHEMA,
  buildUserPrompt,
} from "./prompts";
import { FUNCTION_DECLARATIONS, executeFunctionCall } from "./function-handlers";
import { IncidentAnalysisSchema } from "@/lib/schemas/incident";
import type { IncidentAnalysis } from "@/lib/types/incident";
import type { Part, Content, FunctionCall } from "@google/genai";

/** Maximum number of function-call round-trips to prevent runaway loops */
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
 * Analyze a multimodal crisis report using Gemini with:
 * - Structured JSON output
 * - Google Search grounding for fact verification
 * - Function calling for real-time spatial data
 *
 * Implements an agentic loop: Gemini may call functions multiple
 * times before producing the final structured response.
 */
export async function analyzeIncident(
  input: AnalyzeInput
): Promise<IncidentAnalysis> {
  const client = getGeminiClient();

  // ─── Build multimodal content parts ─────────────────────
  const userParts: Part[] = [];

  // Text content
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

  // Image content (inline base64)
  if (input.imageBase64 && input.imageMimeType) {
    userParts.push({
      inlineData: {
        mimeType: input.imageMimeType,
        data: input.imageBase64,
      },
    });
  }

  // ─── Conversation history for function calling loop ─────
  const contents: Content[] = [
    { role: "user", parts: userParts },
  ];

  // ─── Agentic function-calling loop ──────────────────────
  for (let round = 0; round < MAX_FUNCTION_CALL_ROUNDS; round++) {
    const response = await client.models.generateContent({
      model: MODELS.FLASH,
      contents,
      config: {
        systemInstruction: INCIDENT_ANALYSIS_SYSTEM_PROMPT,
        tools: [
          { functionDeclarations: FUNCTION_DECLARATIONS },
          { googleSearch: {} },
        ],
        responseMimeType: "application/json",
        responseSchema: INCIDENT_ANALYSIS_RESPONSE_SCHEMA,
        temperature: 0.2, // Low temperature for factual accuracy
        maxOutputTokens: 4096,
      },
    });

    // Check if model wants to call functions
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      // Add the model's response (with function calls) to history
      contents.push({
        role: "model",
        parts: functionCalls.map((fc: FunctionCall) => ({ functionCall: fc })),
      });

      // Execute each function call and collect results
      const functionResponses: Part[] = await Promise.all(
        functionCalls.map(async (fc: FunctionCall) => {
          const result = await executeFunctionCall(
            fc.name!,
            (fc.args as Record<string, unknown>) || {}
          );
          return {
            functionResponse: {
              name: fc.name!,
              response: result,
            },
          } as Part;
        })
      );

      // Add function results to history and loop
      contents.push({ role: "user", parts: functionResponses });
      continue;
    }

    // ─── No more function calls → parse the final response ──
    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    // Parse and validate with Zod
    const parsed = JSON.parse(text);
    const validated = IncidentAnalysisSchema.parse(parsed);
    return validated;
  }

  throw new Error(
    `Exceeded maximum function call rounds (${MAX_FUNCTION_CALL_ROUNDS})`
  );
}
