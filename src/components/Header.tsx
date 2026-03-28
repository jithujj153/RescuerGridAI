"use client";

interface HeaderProps {
  appState: string;
  onReset: () => void;
}

export function Header({ appState, onReset }: HeaderProps) {
  return (
    <header className="header" role="banner">
      <div className="header__brand">
        <span className="header__logo" aria-label="RescueGrid AI">
          ⚡ RescueGrid AI
        </span>
        <div className="header__status" aria-label="System status: online">
          <span className="header__status-dot" aria-hidden="true" />
          <span>Live</span>
        </div>
      </div>

      <div className="header__actions">
        {appState === "results" && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={onReset}
            aria-label="Start new analysis"
          >
            + New Report
          </button>
        )}
        <span
          className="mono"
          style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
        >
          v1.0
        </span>
      </div>
    </header>
  );
}
