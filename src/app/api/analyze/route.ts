// ─────────────────────────────────────────────────────────────
// POST /api/analyze — Multimodal incident analysis endpoint
// Accepts text, images, audio transcripts, and news URLs
// Returns structured IncidentAnalysis JSON
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { analyzeIncident } from "@/lib/ai/analyze-incident";
import { AnalyzeRequestSchema } from "@/lib/schemas/incident";
import { ZodError } from "zod";

export const maxDuration = 60; // Allow up to 60s for complex analysis

export async function POST(request: NextRequest) {
  try {
    // ─── Parse request ──────────────────────────────────
    const contentType = request.headers.get("content-type") || "";
    let body: Record<string, unknown>;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = {};

      // Extract text fields
      const text = formData.get("text");
      if (text) body.text = text.toString();

      const audioTranscript = formData.get("audioTranscript");
      if (audioTranscript) body.audioTranscript = audioTranscript.toString();

      const newsUrls = formData.get("newsUrls");
      if (newsUrls) body.newsUrls = JSON.parse(newsUrls.toString());

      const locationLat = formData.get("locationLat");
      const locationLng = formData.get("locationLng");
      if (locationLat && locationLng) {
        body.location = {
          lat: parseFloat(locationLat.toString()),
          lng: parseFloat(locationLng.toString()),
        };
      }

      // Extract image file
      const image = formData.get("image") as File | null;
      if (image) {
        const buffer = await image.arrayBuffer();
        body.imageBase64 = Buffer.from(buffer).toString("base64");
        body.imageMimeType = image.type;
      }
    } else {
      body = await request.json();
    }

    // ─── Validate ───────────────────────────────────────
    const validated = AnalyzeRequestSchema.parse(body);

    // ─── Analyze with Gemini ────────────────────────────
    const result = await analyzeIncident({
      text: validated.text,
      imageBase64: validated.imageBase64,
      imageMimeType: validated.imageMimeType,
      audioTranscript: validated.audioTranscript,
      newsUrls: validated.newsUrls,
      locationLat: validated.location?.lat,
      locationLng: validated.location?.lng,
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

    console.error("Analysis error:", error);
    return NextResponse.json(
      {
        error: "Analysis failed",
        message:
          error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
