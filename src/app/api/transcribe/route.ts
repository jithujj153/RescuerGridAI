import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 };
const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const rl = checkRateLimit(`transcribe:${getRateLimitKey(request)}`, RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: "Audio file too large (max 10MB)" },
        { status: 400 }
      );
    }

    const buffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(buffer).toString("base64");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error("Speech-to-Text API key not configured", { requestId });
      return NextResponse.json(
        { error: "Speech-to-Text not configured" },
        { status: 503 }
      );
    }

    logger.info("Starting speech-to-text transcription", {
      requestId,
      fileSize: audioFile.size,
      mimeType: audioFile.type,
    });

    const sttUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

    const encoding = resolveEncoding(audioFile.type);

    const sttResponse = await fetch(sttUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          encoding,
          sampleRateHertz: 48000,
          languageCode: "en-US",
          alternativeLanguageCodes: ["hi-IN", "es-ES", "fr-FR", "ar-XA"],
          model: "latest_long",
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false,
        },
        audio: { content: audioBase64 },
      }),
    });

    if (!sttResponse.ok) {
      const errorText = await sttResponse.text();
      logger.error("STT API error", { requestId, status: sttResponse.status, error: errorText });
      return NextResponse.json(
        { error: "Speech transcription failed" },
        { status: 502 }
      );
    }

    const sttData = await sttResponse.json();
    const transcript = (sttData.results || [])
      .map((r: { alternatives?: { transcript?: string }[] }) =>
        r.alternatives?.[0]?.transcript || ""
      )
      .join(" ")
      .trim();

    logger.info("Transcription completed", { requestId, transcriptLength: transcript.length });

    return NextResponse.json({
      transcript: transcript || "(No speech detected)",
      confidence: sttData.results?.[0]?.alternatives?.[0]?.confidence ?? 0,
    });
  } catch (error) {
    logger.error("Transcribe API error", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}

function resolveEncoding(mimeType: string): string {
  if (mimeType.includes("webm")) return "WEBM_OPUS";
  if (mimeType.includes("ogg")) return "OGG_OPUS";
  if (mimeType.includes("flac")) return "FLAC";
  if (mimeType.includes("wav")) return "LINEAR16";
  if (mimeType.includes("mp3") || mimeType.includes("mpeg")) return "MP3";
  return "WEBM_OPUS";
}
