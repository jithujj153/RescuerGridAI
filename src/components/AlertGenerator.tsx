"use client";

import { useState, useCallback, useRef } from "react";
import type { IncidentAnalysis } from "@/lib/types/incident";

interface AlertGeneratorProps {
  incident: IncidentAnalysis;
}

const LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "en-IN", name: "English (India)" },
  { code: "hi-IN", name: "Hindi" },
  { code: "es-ES", name: "Spanish" },
  { code: "fr-FR", name: "French" },
  { code: "ar-XA", name: "Arabic" },
  { code: "pt-BR", name: "Portuguese" },
  { code: "ta-IN", name: "Tamil" },
  { code: "te-IN", name: "Telugu" },
  { code: "ml-IN", name: "Malayalam" },
  { code: "kn-IN", name: "Kannada" },
  { code: "de-DE", name: "German" },
  { code: "ja-JP", name: "Japanese" },
  { code: "zh-CN", name: "Chinese" },
];

export function AlertGenerator({ incident }: AlertGeneratorProps) {
  const [language, setLanguage] = useState("en-US");
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const alertText = generateAlertText(incident);

  const handleGenerateAudio = useCallback(async () => {
    setIsGenerating(true);
    setAudioSrc(null);

    try {
      const response = await fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: alertText,
          languageCode: language,
        }),
      });

      if (!response.ok) throw new Error("TTS failed");

      const data = await response.json();
      const audioUrl = `data:audio/mp3;base64,${data.audioBase64}`;
      setAudioSrc(audioUrl);
    } catch (err) {
      console.error("Alert generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [alertText, language]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(alertText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const textarea = document.createElement("textarea");
      textarea.value = alertText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [alertText]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `⚠️ ${incident.hazard_type.toUpperCase()} Alert`,
          text: alertText,
        });
      } catch {
        // User cancelled share
      }
    }
  }, [alertText, incident.hazard_type]);

  return (
    <div className="alert-generator" role="region" aria-label="Alert generator">
      <div className="section-title">📢 Alert Generator</div>

      {/* Alert preview */}
      <div style={{
        padding: "var(--space-md)",
        background: "var(--bg-secondary)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
        fontSize: "0.82rem",
        lineHeight: "1.6",
        color: "var(--text-secondary)",
        maxHeight: "100px",
        overflow: "auto",
      }}>
        {alertText}
      </div>

      {/* Controls */}
      <div className="alert-generator__controls">
        <label htmlFor="language-select" className="sr-only">
          Select language
        </label>
        <select
          id="language-select"
          className="select-input"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Alert language"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>

        <button
          className="btn btn--primary btn--sm"
          onClick={handleGenerateAudio}
          disabled={isGenerating}
          aria-label="Generate audio alert"
        >
          {isGenerating ? "Generating..." : "🔊 Generate Audio"}
        </button>

        <button
          className="btn btn--ghost btn--sm"
          onClick={handleCopy}
          aria-label="Copy alert text"
        >
          {copied ? "✓ Copied" : "📋 Copy"}
        </button>

        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleShare}
            aria-label="Share alert"
          >
            📤 Share
          </button>
        )}
      </div>

      {/* Audio player */}
      {audioSrc && (
        <audio
          ref={audioRef}
          controls
          src={audioSrc}
          className="audio-player"
          aria-label="Generated audio alert"
          style={{ width: "100%", height: "40px" }}
        />
      )}
    </div>
  );
}

/** Generate human-readable alert text from incident analysis */
function generateAlertText(incident: IncidentAnalysis): string {
  const lines = [
    `⚠️ EMERGENCY ALERT: ${incident.hazard_type.replace("_", " ").toUpperCase()}`,
    `Severity: ${incident.severity.toUpperCase()}`,
    "",
    incident.summary,
    "",
    `Affected Area: ${incident.affected_zone.description}`,
    `Time: ${incident.urgency_window}`,
    "",
    "IMMEDIATE ACTIONS:",
    ...incident.next_actions.citizens.map((a, i) => `${i + 1}. ${a}`),
    "",
    "Stay safe. Follow official guidance.",
  ];

  return lines.join("\n");
}
