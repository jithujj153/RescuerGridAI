"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { InputPanel } from "@/components/InputPanel";
import { MapView } from "@/components/MapView";
import { IncidentCard } from "@/components/IncidentCard";
import { ActionChecklist } from "@/components/ActionChecklist";
import { AlertGenerator } from "@/components/AlertGenerator";
import type { IncidentAnalysis, GeoCoordinate } from "@/lib/types/incident";

type AppState = "idle" | "analyzing" | "results" | "error";

export default function DashboardPage() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [incident, setIncident] = useState<IncidentAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<GeoCoordinate | null>(null);

  const handleAnalyze = useCallback(
    async (formData: FormData) => {
      setAppState("analyzing");
      setError(null);

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || "Analysis failed");
        }

        const result: IncidentAnalysis = await response.json();
        setIncident(result);
        setAppState("results");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
        setAppState("error");
      }
    },
    []
  );

  const handleReset = useCallback(() => {
    setAppState("idle");
    setIncident(null);
    setError(null);
  }, []);

  const handleLocationDetected = useCallback((location: GeoCoordinate) => {
    setUserLocation(location);
  }, []);

  return (
    <div className="app-container">
      <Header appState={appState} onReset={handleReset} />

      <main id="main-content" className="main-content" role="main">
        {/* Left column: Input panel */}
        <div className="input-panel">
          <InputPanel
            onAnalyze={handleAnalyze}
            isAnalyzing={appState === "analyzing"}
            onLocationDetected={handleLocationDetected}
            userLocation={userLocation}
          />
        </div>

        {/* Top right: Map */}
        <div className="glass-card glass-card--elevated map-container">
          <MapView
            incident={incident}
            userLocation={userLocation}
          />
        </div>

        {/* Bottom right: Results */}
        <div className="glass-card glass-card--elevated" style={{ overflow: "auto" }}>
          {appState === "idle" && (
            <div className="empty-state">
              <div className="empty-state__icon">🛰️</div>
              <div className="empty-state__title">Ready to Analyze</div>
              <div className="empty-state__subtitle">
                Upload a field report, photo, voice note, or news link to begin crisis analysis
              </div>
            </div>
          )}

          {appState === "analyzing" && (
            <div className="analyzing-overlay" role="alert" aria-live="polite">
              <div className="analyzing-spinner" aria-hidden="true"></div>
              <div className="analyzing-text">Analyzing crisis report...</div>
              <div className="analyzing-subtext">
                Gemini is classifying the incident, verifying facts via Google Search, and finding nearby resources
              </div>
            </div>
          )}

          {appState === "error" && (
            <div className="empty-state">
              <div className="empty-state__icon">⚠️</div>
              <div className="empty-state__title">Analysis Failed</div>
              <div className="empty-state__subtitle">{error}</div>
              <button className="btn btn--primary" onClick={handleReset}>
                Try Again
              </button>
            </div>
          )}

          {appState === "results" && incident && (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
              <IncidentCard incident={incident} />
              <ActionChecklist actions={incident.next_actions} />
              <AlertGenerator incident={incident} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
