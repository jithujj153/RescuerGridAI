"use client";

import { useState, useCallback } from "react";
import type { ActionChecklist as ActionChecklistType } from "@/lib/types/incident";

interface ActionChecklistProps {
  actions: ActionChecklistType;
}

type TabKey = "citizens" | "responders" | "city_ops";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "citizens", label: "Citizens", icon: "👤" },
  { key: "responders", label: "Responders", icon: "🚒" },
  { key: "city_ops", label: "City Ops", icon: "🏛️" },
];

export function ActionChecklist({ actions }: ActionChecklistProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("citizens");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggleCheck = useCallback((key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const currentActions = actions[activeTab];
  const completedCount = currentActions.filter(
    (_, i) => checked[`${activeTab}-${i}`]
  ).length;

  return (
    <div className="action-checklist" role="region" aria-label="Action checklist">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="section-title" style={{ borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
          Action Checklist
        </div>
        <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          {completedCount}/{currentActions.length} done
        </span>
      </div>

      {/* Tabs */}
      <div className="action-checklist__tabs" role="tablist" aria-label="Action audience">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`panel-${tab.key}`}
            className={`action-checklist__tab ${activeTab === tab.key ? "action-checklist__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Action items */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-label={`${activeTab} actions`}
      >
        {currentActions.map((action, i) => {
          const key = `${activeTab}-${i}`;
          const isChecked = checked[key] || false;

          return (
            <div
              key={key}
              className="action-item"
              onClick={() => toggleCheck(key)}
              role="checkbox"
              aria-checked={isChecked}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleCheck(key);
                }
              }}
            >
              <div
                className={`action-item__checkbox ${isChecked ? "action-item__checkbox--checked" : ""}`}
                aria-hidden="true"
              />
              <span
                className={`action-item__text ${isChecked ? "action-item__text--completed" : ""}`}
              >
                {action}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
