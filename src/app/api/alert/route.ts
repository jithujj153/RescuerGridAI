import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const AlertRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  languageCode: z.string().default("en-US"),
  voiceGender: z.enum(["NEUTRAL", "MALE", "FEMALE"]).default("NEUTRAL"),
});

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

const RATE_LIMIT = { maxRequests: 20, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const rl = checkRateLimit(`alert:${getRateLimitKey(request)}`, RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const validated = AlertRequestSchema.parse(body);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error("TTS API key not configured", { requestId });
      return NextResponse.json(
        { error: "TTS service is not configured" },
        { status: 503 }
      );
    }

    const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    logger.info("Generating TTS alert", {
      requestId,
      language: validated.languageCode,
      textLength: validated.text.length,
    });

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
      logger.error("TTS API error", { requestId, status: ttsResponse.status, error: errorText });
      return NextResponse.json(
        { error: "Text-to-speech generation failed" },
        { status: 502 }
      );
    }

    const ttsData = await ttsResponse.json();

    return NextResponse.json({
      audioBase64: ttsData.audioContent,
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

    logger.error("Alert API error", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to generate alert" },
      { status: 500 }
    );
  }
}
