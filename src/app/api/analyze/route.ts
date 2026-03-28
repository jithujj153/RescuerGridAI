import { NextRequest, NextResponse } from "next/server";
import { analyzeIncident } from "@/lib/ai/analyze-incident";
import { AnalyzeRequestSchema } from "@/lib/schemas/incident";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export const maxDuration = 60;

const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const rl = checkRateLimit(
      `analyze:${getRateLimitKey(request)}`,
      RATE_LIMIT
    );
    if (!rl.allowed) {
      logger.warn("Rate limit exceeded", { requestId, endpoint: "/api/analyze" });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let body: Record<string, unknown>;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = {};

      const text = formData.get("text");
      if (text) body.text = text.toString();

      const audioTranscript = formData.get("audioTranscript");
      if (audioTranscript) body.audioTranscript = audioTranscript.toString();

      const newsUrls = formData.get("newsUrls");
      if (newsUrls) {
        try {
          body.newsUrls = JSON.parse(newsUrls.toString());
        } catch {
          body.newsUrls = [];
        }
      }

      const locationLat = formData.get("locationLat");
      const locationLng = formData.get("locationLng");
      if (locationLat && locationLng) {
        body.location = {
          lat: parseFloat(locationLat.toString()),
          lng: parseFloat(locationLng.toString()),
        };
      }

      const image = formData.get("image") as File | null;
      if (image) {
        const buffer = await image.arrayBuffer();
        body.imageBase64 = Buffer.from(buffer).toString("base64");
        body.imageMimeType = image.type;
      }
    } else {
      body = await request.json();
    }

    const validated = AnalyzeRequestSchema.parse(body);

    logger.info("Starting incident analysis", {
      requestId,
      hasText: !!validated.text,
      hasImage: !!validated.imageBase64,
      hasAudio: !!validated.audioTranscript,
      newsUrlCount: validated.newsUrls?.length ?? 0,
    });

    const result = await analyzeIncident({
      text: validated.text,
      imageBase64: validated.imageBase64,
      imageMimeType: validated.imageMimeType,
      audioTranscript: validated.audioTranscript,
      newsUrls: validated.newsUrls,
      locationLat: validated.location?.lat,
      locationLng: validated.location?.lng,
    });

    logger.info("Analysis completed", {
      requestId,
      hazard_type: result.hazard_type,
      severity: result.severity,
      confidence: result.confidence,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    logger.error("Analysis failed", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const isProduction = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        error: "Analysis failed",
        message: isProduction
          ? "An unexpected error occurred. Please try again."
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
