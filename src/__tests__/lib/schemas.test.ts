import {
  IncidentAnalysisSchema,
  AnalyzeRequestSchema,
  GeoCoordinateSchema,
  AffectedZoneSchema,
} from "@/lib/schemas/incident";

describe("GeoCoordinateSchema", () => {
  it("accepts valid coordinates", () => {
    const result = GeoCoordinateSchema.parse({ lat: 37.7749, lng: -122.4194 });
    expect(result.lat).toBe(37.7749);
    expect(result.lng).toBe(-122.4194);
  });

  it("rejects latitude out of range", () => {
    expect(() => GeoCoordinateSchema.parse({ lat: 91, lng: 0 })).toThrow();
  });

  it("rejects longitude out of range", () => {
    expect(() => GeoCoordinateSchema.parse({ lat: 0, lng: 181 })).toThrow();
  });

  it("rejects non-numeric values", () => {
    expect(() => GeoCoordinateSchema.parse({ lat: "abc", lng: 0 })).toThrow();
  });
});

describe("AffectedZoneSchema", () => {
  it("accepts valid zone data", () => {
    const zone = {
      center: { lat: 12.97, lng: 77.59 },
      radius_km: 5,
      description: "Central business district",
    };
    expect(AffectedZoneSchema.parse(zone)).toEqual(zone);
  });

  it("rejects radius above 500 km", () => {
    expect(() =>
      AffectedZoneSchema.parse({
        center: { lat: 0, lng: 0 },
        radius_km: 501,
        description: "Too large",
      })
    ).toThrow();
  });

  it("rejects empty description", () => {
    expect(() =>
      AffectedZoneSchema.parse({
        center: { lat: 0, lng: 0 },
        radius_km: 1,
        description: "",
      })
    ).toThrow();
  });
});

describe("AnalyzeRequestSchema", () => {
  it("accepts request with text only", () => {
    const result = AnalyzeRequestSchema.parse({ text: "Fire in downtown" });
    expect(result.text).toBe("Fire in downtown");
  });

  it("accepts request with image only", () => {
    const result = AnalyzeRequestSchema.parse({
      imageBase64: "base64data",
      imageMimeType: "image/jpeg",
    });
    expect(result.imageBase64).toBe("base64data");
  });

  it("accepts request with audio transcript only", () => {
    const result = AnalyzeRequestSchema.parse({
      audioTranscript: "Help! There's flooding here.",
    });
    expect(result.audioTranscript).toBe("Help! There's flooding here.");
  });

  it("rejects request with no input", () => {
    expect(() => AnalyzeRequestSchema.parse({})).toThrow();
  });

  it("accepts request with all inputs and location", () => {
    const result = AnalyzeRequestSchema.parse({
      text: "Report text",
      imageBase64: "base64",
      imageMimeType: "image/png",
      audioTranscript: "transcript",
      newsUrls: ["https://news.example.com/article"],
      location: { lat: 40.7, lng: -74.0 },
    });
    expect(result.newsUrls).toHaveLength(1);
    expect(result.location?.lat).toBe(40.7);
  });

  it("rejects invalid image mime type", () => {
    expect(() =>
      AnalyzeRequestSchema.parse({
        imageBase64: "data",
        imageMimeType: "image/bmp",
      })
    ).toThrow();
  });

  it("rejects more than 5 news URLs", () => {
    expect(() =>
      AnalyzeRequestSchema.parse({
        text: "test",
        newsUrls: Array(6).fill("https://example.com"),
      })
    ).toThrow();
  });

  it("rejects text exceeding 5000 characters", () => {
    expect(() =>
      AnalyzeRequestSchema.parse({ text: "a".repeat(5001) })
    ).toThrow();
  });
});

describe("IncidentAnalysisSchema", () => {
  const validIncident = {
    incident_id: "INC-20260328-120000",
    hazard_type: "wildfire",
    severity: "critical",
    confidence: 0.85,
    affected_zone: {
      center: { lat: 34.05, lng: -118.25 },
      radius_km: 3,
      description: "Downtown Los Angeles near Griffith Park",
    },
    summary:
      "Active wildfire detected near Griffith Park with smoke visible across the downtown area. Multiple evacuations in progress.",
    verified_facts: [
      "Active fire confirmed by LAFD",
      "Evacuations ordered for Hollywood Hills",
    ],
    unverified_claims: ["Power outage reported in Silver Lake"],
    next_actions: {
      citizens: ["Evacuate immediately via I-5 South", "Monitor LAFD Twitter"],
      responders: ["Deploy additional units to Griffith Park"],
      city_ops: ["Activate emergency operations center"],
    },
    urgency_window: "Immediate — next 2 hours",
    related_news: [
      {
        title: "Wildfire erupts near Griffith Park",
        url: "https://latimes.com/article",
        source: "LA Times",
      },
    ],
    timestamp: "2026-03-28T12:00:00.000Z",
  };

  it("accepts a valid incident analysis", () => {
    const result = IncidentAnalysisSchema.parse(validIncident);
    expect(result.hazard_type).toBe("wildfire");
    expect(result.severity).toBe("critical");
  });

  it("rejects invalid hazard type", () => {
    expect(() =>
      IncidentAnalysisSchema.parse({
        ...validIncident,
        hazard_type: "alien_invasion",
      })
    ).toThrow();
  });

  it("rejects confidence out of range", () => {
    expect(() =>
      IncidentAnalysisSchema.parse({ ...validIncident, confidence: 1.5 })
    ).toThrow();
  });

  it("rejects empty next_actions arrays", () => {
    expect(() =>
      IncidentAnalysisSchema.parse({
        ...validIncident,
        next_actions: { citizens: [], responders: ["a"], city_ops: ["a"] },
      })
    ).toThrow();
  });
});
