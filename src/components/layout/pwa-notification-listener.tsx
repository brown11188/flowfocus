"use client";

import { useEffect } from "react";
import {
  notifyFocusComplete,
  notifyDailyBriefingReady,
  notifyDueTasksSummary,
} from "@/lib/local-notifications";

/**
 * Global listener that converts custom DOM events into local notifications.
 * Mount once at the app layout level.
 */
export function PWANotificationListener() {
  useEffect(() => {
    const onFocusComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        taskLabel: string;
        durationMins: number;
      };
      notifyFocusComplete(detail.taskLabel, detail.durationMins);
    };

    const onBriefingReady = (e: Event) => {
      const detail = (e as CustomEvent).detail as { summary?: string } | undefined;
      notifyDailyBriefingReady(detail?.summary);
    };

    const onDueTasks = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        count: number;
        topTasks: string[];
      };
      notifyDueTasksSummary(detail.count, detail.topTasks);
    };

    window.addEventListener("pwa:focus-complete", onFocusComplete);
    window.addEventListener("pwa:daily-briefing-ready", onBriefingReady);
    window.addEventListener("pwa:due-tasks-reminder", onDueTasks);

    return () => {
      window.removeEventListener("pwa:focus-complete", onFocusComplete);
      window.removeEventListener("pwa:daily-briefing-ready", onBriefingReady);
      window.removeEventListener("pwa:due-tasks-reminder", onDueTasks);
    };
  }, []);

  return null;
}
