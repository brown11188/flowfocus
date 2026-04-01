"use client";
import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface DeadlineSuggestion {
  suggestedDate: string; // YYYY-MM-DD
  reasoning: string;
  confidence: "high" | "medium" | "low";
}

/**
 * FEAT-03: Smart Deadline Prediction
 * Calls AI to suggest a realistic due date based on task title,
 * current workload, and historical completion patterns.
 */
export function useSmartDeadline() {
  const [suggestion, setSuggestion] = useState<DeadlineSuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  const predict = useCallback(async (taskTitle: string, projectId?: string) => {
    if (!taskTitle.trim() || taskTitle.length < 3) {
      setSuggestion(null);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/ai/predict-deadline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle, projectId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestion(data);
      } else {
        setSuggestion(null);
      }
    } catch {
      setSuggestion(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setSuggestion(null), []);

  return { suggestion, loading, predict, clear };
}
