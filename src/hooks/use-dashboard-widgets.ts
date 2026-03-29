"use client";
import { useState, useCallback } from "react";

export type WidgetKey =
  | "dailyBriefing"
  | "stats"
  | "activeProjects"
  | "upcoming"
  | "activeSprint"
  | "emailIntelligence"
  | "weeklyGoals";

export interface WidgetConfig {
  key: WidgetKey;
  label: string;
  description: string;
  enabled: boolean;
  section: "top" | "main" | "side";
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { key: "dailyBriefing", label: "Daily Briefing", description: "AI-powered morning advisor", enabled: true, section: "top" },
  { key: "stats", label: "Stats Cards", description: "Today progress, streak, done, overdue", enabled: true, section: "top" },
  { key: "activeProjects", label: "Active Projects", description: "Project progress overview", enabled: true, section: "main" },
  { key: "emailIntelligence", label: "Email Intelligence", description: "Outlook email scan results", enabled: true, section: "main" },
  { key: "upcoming", label: "Upcoming Deadlines", description: "Today, tomorrow, this week", enabled: true, section: "side" },
  { key: "activeSprint", label: "Active Sprint", description: "Sprint progress and days left", enabled: true, section: "side" },
  { key: "weeklyGoals", label: "Weekly Goals", description: "Set and track weekly goals", enabled: false, section: "side" },
];

const STORAGE_KEY = "flowfocus_dashboard_widgets";

function loadWidgets(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_WIDGETS;
    const parsed: Record<string, boolean> = JSON.parse(saved);
    return DEFAULT_WIDGETS.map(w => ({
      ...w,
      enabled: w.key in parsed ? parsed[w.key] : w.enabled,
    }));
  } catch {
    return DEFAULT_WIDGETS;
  }
}

export function useDashboardWidgets() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadWidgets);

  const toggleWidget = useCallback((key: WidgetKey) => {
    setWidgets(prev => {
      const next = prev.map(w => w.key === key ? { ...w, enabled: !w.enabled } : w);
      const map: Record<string, boolean> = {};
      next.forEach(w => map[w.key] = w.enabled);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      return next;
    });
  }, []);

  const isEnabled = useCallback((key: WidgetKey) => {
    return widgets.find(w => w.key === key)?.enabled ?? true;
  }, [widgets]);

  return { widgets, toggleWidget, isEnabled };
}