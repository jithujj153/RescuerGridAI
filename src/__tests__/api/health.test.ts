import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns healthy when all keys are configured", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";
    process.env.GOOGLE_CLOUD_PROJECT_ID = "test-project";

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.gemini_key).toBe(true);
    expect(body.checks.maps_key).toBe(true);
    expect(body.checks.project_id).toBe(true);
    expect(body.timestamp).toBeDefined();
    expect(body.uptime_ms).toBeGreaterThanOrEqual(0);
  });

  it("returns degraded when keys are missing", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
  });

  it("includes version in the response", async () => {
    process.env.GEMINI_API_KEY = "key";
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "key";
    process.env.GOOGLE_CLOUD_PROJECT_ID = "proj";

    const response = await GET();
    const body = await response.json();

    expect(body.version).toBeDefined();
  });
});
