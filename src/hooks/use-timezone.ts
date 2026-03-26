"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { isToday, isOverdue, formatDateInTz, getTodayStrInTz } from "@/lib/timezone";
import { formatDayLabel } from "@/lib/utils";

const STORAGE_KEY = "flowfocus_timezone";

/** Best-guess browser timezone */
function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Hook that provides the user's timezone and timezone-aware date utilities.
 * - Loads timezone from API on mount (persists to DB)
 * - Falls back to localStorage → browser detection
 */
export function useTimezone() {
  const [timezone, setTimezoneState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) ?? detectBrowserTimezone();
    }
    return "UTC";
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load from server on mount
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/user/timezone")
      .then(r => r.json())
      .then((d: { timezone: string }) => {
        if (!cancelled && d.timezone) {
          setTimezoneState(d.timezone);
          localStorage.setItem(STORAGE_KEY, d.timezone);
        }
      })
      .catch(() => { /* use local fallback */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const saveTimezone = useCallback(async (tz: string) => {
    setTimezoneState(tz);
    localStorage.setItem(STORAGE_KEY, tz);
    await apiFetch("/api/user/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    });
  }, []);

  // Timezone-aware utilities
  const isTodayTz   = useCallback((date: string) => isToday(date, timezone), [timezone]);
  const isOverdueTz = useCallback((date: string) => isOverdue(date, timezone), [timezone]);
  const todayStrTz  = useCallback(() => getTodayStrInTz(timezone), [timezone]);
  const dayLabelTz  = useCallback((date: Date) => formatDayLabel(date, timezone), [timezone]);
  const formatDateTz = useCallback(
    (date: string | Date, opts?: Intl.DateTimeFormatOptions) => formatDateInTz(date, timezone, opts),
    [timezone]
  );

  return { timezone, setTimezone: saveTimezone, isLoading, isTodayTz, isOverdueTz, todayStrTz, dayLabelTz, formatDateTz };
}

