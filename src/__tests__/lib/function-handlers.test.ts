import { executeFunctionCall, haversineDistance } from "@/lib/ai/function-handlers";

describe("executeFunctionCall", () => {
  it("returns error for unknown function names", async () => {
    const result = await executeFunctionCall("unknown_function", {});
    expect(result).toEqual({ error: "Unknown function: unknown_function" });
  });

  it("routes search_nearby_hospitals to handler", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });

    const result = await executeFunctionCall("search_nearby_hospitals", {
      latitude: 37.77,
      longitude: -122.41,
      radius_km: 10,
    });

    expect(result).toHaveProperty("hospitals");
    expect(result).toHaveProperty("count");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("routes search_nearby_shelters to handler", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });

    const result = await executeFunctionCall("search_nearby_shelters", {
      latitude: 37.77,
      longitude: -122.41,
      radius_km: 5,
    });

    expect(result).toHaveProperty("shelters");
  });

  it("routes get_weather_conditions to handler", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        temperature: { degrees: 25 },
        wind: { speed: { value: 15 } },
      }),
    });

    const result = await executeFunctionCall("get_weather_conditions", {
      latitude: 37.77,
      longitude: -122.41,
    });

    expect(result).toHaveProperty("conditions");
  });

  it("handles API errors gracefully for hospitals", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await executeFunctionCall("search_nearby_hospitals", {
      latitude: 0,
      longitude: 0,
      radius_km: 10,
    });

    expect(result).toHaveProperty("error");
    expect(result.hospitals).toEqual([]);
  });

  it("handles network errors gracefully", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network failure"));

    const result = await executeFunctionCall("get_weather_conditions", {
      latitude: 0,
      longitude: 0,
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toContain("Network failure");
  });
});

describe("haversineDistance", () => {
  it("returns 0 for same coordinates", () => {
    const point = { lat: 37.7749, lng: -122.4194 };
    expect(haversineDistance(point, point)).toBe(0);
  });

  it("calculates distance between SF and LA correctly (approx 559 km)", () => {
    const sf = { lat: 37.7749, lng: -122.4194 };
    const la = { lat: 34.0522, lng: -118.2437 };
    const distance = haversineDistance(sf, la);
    expect(distance).toBeGreaterThan(540);
    expect(distance).toBeLessThan(580);
  });

  it("calculates distance between New York and London", () => {
    const ny = { lat: 40.7128, lng: -74.006 };
    const london = { lat: 51.5074, lng: -0.1278 };
    const distance = haversineDistance(ny, london);
    expect(distance).toBeGreaterThan(5500);
    expect(distance).toBeLessThan(5700);
  });
});
