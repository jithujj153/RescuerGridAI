import { NextResponse } from "next/server";

const startTime = Date.now();

export async function GET() {
  const uptimeMs = Date.now() - startTime;

  const checks: Record<string, boolean> = {
    gemini_key: !!process.env.GEMINI_API_KEY,
    maps_key: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    project_id: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
  };

  const healthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      version: process.env.npm_package_version || "1.0.0",
      uptime_ms: uptimeMs,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
