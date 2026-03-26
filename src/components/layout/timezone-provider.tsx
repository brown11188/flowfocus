"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

const STORAGE_KEY = "flowfocus_timezone";

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

interface TimezoneCtx {
  timezone: string;
  setTimezone: (tz: string) => void;
}

const TimezoneContext = createContext<TimezoneCtx>({
  timezone: DEFAULT_TIMEZONE,
  setTimezone: () => {},
});

export function useTimezoneCtx() {
  return useContext(TimezoneContext);
}

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  // Initialize immediately from localStorage so there's no UTC flash
  const [timezone, setTimezoneState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) ?? detectBrowserTimezone();
    }
    return DEFAULT_TIMEZONE;
  });

  // Sync with server on mount (server value is authoritative)
  useEffect(() => {
    apiFetch("/api/user/timezone")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.timezone) {
          setTimezoneState(data.timezone);
          localStorage.setItem(STORAGE_KEY, data.timezone);
        }
      })
      .catch(() => {});
  }, []);

  const setTimezone = (tz: string) => {
    setTimezoneState(tz);
    localStorage.setItem(STORAGE_KEY, tz);
  };

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
}
