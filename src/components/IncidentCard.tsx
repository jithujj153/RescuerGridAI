"use client";

import type { IncidentAnalysis } from "@/lib/types/incident";
import { HAZARD_META, SEVERITY_META } from "@/lib/types/incident";

interface IncidentCardProps {
  incident: IncidentAnalysis;
}

export function IncidentCard({ incident }: IncidentCardProps) {
  const hazardMeta = HAZARD_META[incident.hazard_type];
  const severityMeta = SEVERITY_META[incident.severity];

  return (
    <div className="incident-card" role="region" aria-label="Incident analysis results">
      {/* Header: Type + Severity */}
      <div className="incident-card__header">
        <div className="incident-card__type">
          <span className="incident-card__type-icon" aria-hidden="true">
            {hazardMeta.icon}
          </span>
          <div>
            <div className="incident-card__type-label">{hazardMeta.label}</div>
            <div className="mono" style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
              {incident.incident_id}
            </div>
          </div>
        </div>
        <span
          className={`incident-card__severity-badge incident-card__severity-badge--${incident.severity}`}
          role="status"
          aria-label={`Severity: ${severityMeta.label}`}
        >
          {severityMeta.icon} {severityMeta.label}
        </span>
      </div>

      {/* Urgency Window */}
      <div className="urgency-badge" role="alert">
        ⏱ {incident.urgency_window}
      </div>

      {/* Confidence */}
      <div className="confidence-meter">
        <div className="confidence-meter__label">
          <span>Confidence</span>
          <span className="mono">{Math.round(incident.confidence * 100)}%</span>
        </div>
        <div className="confidence-meter__bar" role="progressbar" aria-valuenow={Math.round(incident.confidence * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="confidence-meter__fill"
            style={{ width: `${incident.confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Summary */}
      <p className="summary-text">{incident.summary}</p>

      {/* Affected Zone */}
      <div className="zone-info">
        <span className="zone-info__icon" aria-hidden="true">📍</span>
        <span>{incident.affected_zone.description} ({incident.affected_zone.radius_km} km radius)</span>
      </div>

      {/* Verified Facts */}
      {incident.verified_facts.length > 0 && (
        <div className="facts-section">
          <div className="facts-section__title">
            <span>✅</span> Verified Facts
          </div>
          {incident.verified_facts.map((fact, i) => (
            <div key={i} className="fact-item fact-item--verified">
              <span className="fact-item__icon" aria-hidden="true">✓</span>
              <span>{fact}</span>
            </div>
          ))}
        </div>
      )}

      {/* Unverified Claims */}
      {incident.unverified_claims.length > 0 && (
        <div className="facts-section">
          <div className="facts-section__title">
            <span>⚠️</span> Unverified Claims
          </div>
          {incident.unverified_claims.map((claim, i) => (
            <div key={i} className="fact-item fact-item--unverified">
              <span className="fact-item__icon" aria-hidden="true">?</span>
              <span>{claim}</span>
            </div>
          ))}
        </div>
      )}

      {/* Related News */}
      {incident.related_news.length > 0 && (
        <div className="facts-section">
          <div className="facts-section__title">
            <span>📰</span> Related News
          </div>
          {incident.related_news.map((news, i) => (
            <a
              key={i}
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="fact-item fact-item--verified"
              style={{ textDecoration: "none", color: "var(--accent-cyan)" }}
            >
              <span className="fact-item__icon" aria-hidden="true">🔗</span>
              <span>
                {news.title}
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  {" "}— {news.source}
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
