// ─────────────────────────────────────────────────────────────
// POST /api/alert — Multilingual TTS alert generation
// Uses Google Cloud Text-to-Speech API
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const AlertRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  languageCode: z.string().default("en-US"),
  voiceGender: z.enum(["NEUTRAL", "MALE", "FEMALE"]).default("NEUTRAL"),
});

/** Supported languages with display names */
export const SUPPORTED_LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "en-IN", name: "English (India)" },
  { code: "hi-IN", name: "Hindi" },
  { code: "es-ES", name: "Spanish" },
  { code: "fr-FR", name: "French" },
  { code: "ar-XA", name: "Arabic" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "de-DE", name: "German" },
  { code: "ja-JP", name: "Japanese" },
  { code: "zh-CN", name: "Chinese (Mandarin)" },
  { code: "ta-IN", name: "Tamil" },
  { code: "te-IN", name: "Telugu" },
  { code: "ml-IN", name: "Malayalam" },
  { code: "kn-IN", name: "Kannada" },
] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = AlertRequestSchema.parse(body);

    // Use Google Cloud TTS REST API directly
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "TTS API not configured" },
        { status: 503 }
      );
    }

    const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const ttsResponse = await fetch(ttsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: validated.text },
        voice: {
          languageCode: validated.languageCode,
          ssmlGender: validated.voiceGender,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 0.9,
          pitch: 0,
        },
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("TTS API error:", errorText);
      return NextResponse.json(
        { error: "Text-to-speech failed" },
        { status: 502 }
      );
    }

    const ttsData = await ttsResponse.json();
    const audioContent = ttsData.audioContent; // Base64 encoded MP3

    return NextResponse.json({
      audioBase64: audioContent,
      mimeType: "audio/mp3",
      language: validated.languageCode,
      text: validated.text,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Alert API error:", error);
    return NextResponse.json(
      { error: "Failed to generate alert" },
      { status: 500 }
    );
  }
}
