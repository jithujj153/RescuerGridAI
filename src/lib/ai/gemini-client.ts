// ─────────────────────────────────────────────────────────────
// Gemini Client — Singleton client for Google Gen AI SDK
// ─────────────────────────────────────────────────────────────

import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

/**
 * Returns a singleton GoogleGenAI client.
 * Uses GEMINI_API_KEY from environment variables.
 * Throws eagerly if the key is missing to fail fast at startup.
 */
export function getGeminiClient(): GoogleGenAI {
  if (_client) return _client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env.local file or Secret Manager."
    );
  }

  _client = new GoogleGenAI({ apiKey });
  return _client;
}

/** Model identifiers — centralized for easy version management */
export const MODELS = {
  FLASH: "gemini-2.5-flash",
  LIVE: "gemini-2.5-flash-native-audio-preview-12-2025",
} as const;
