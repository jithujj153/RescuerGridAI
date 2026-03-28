import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  const config = { maxRequests: 3, windowMs: 10_000 };

  it("allows first request", () => {
    const result = checkRateLimit("test-first", config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("allows requests up to the limit", () => {
    const key = `test-limit-${Date.now()}`;
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const result = checkRateLimit(key, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    const key = `test-block-${Date.now()}`;
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const result = checkRateLimit(key, config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("uses separate counters for different keys", () => {
    const key1 = `test-sep-a-${Date.now()}`;
    const key2 = `test-sep-b-${Date.now()}`;

    checkRateLimit(key1, config);
    checkRateLimit(key1, config);
    checkRateLimit(key1, config);

    const result = checkRateLimit(key2, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("provides a resetAt timestamp in the future", () => {
    const key = `test-reset-${Date.now()}`;
    const result = checkRateLimit(key, config);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});
