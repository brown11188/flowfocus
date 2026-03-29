"use client";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "flowfocus_pm_mode";

export function usePMMode() {
  const [pmMode, setPmModeState] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(pmMode));
  }, [pmMode]);

  const togglePMMode = useCallback(() => {
    setPmModeState(v => !v);
  }, []);

  return { pmMode, togglePMMode };
}