"use client";

import { useEffect, useRef } from "react";
import { useTaskStore } from "@/store/task-store";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";
import { canNotify } from "@/lib/notification-preferences";
import {
  getDueReminderCandidates,
  filterAlreadyNotified,
  markNotified,
  clearOldNotificationRecords,
} from "@/lib/task-reminder-engine";

/**
 * Lightweight component that checks for due/overdue tasks once per session
 * (and again when the tab becomes visible) and dispatches a reminder event.
 *
 * Must be mounted inside TimezoneProvider + DataProvider scope.
 */
export function DueTaskReminderCheck() {
  const { tasks } = useTaskStore();
  const { timezone } = useTimezoneCtx();
  const checkedRef = useRef(false);

  useEffect(() => {
    // Run once per app session after tasks load
    if (checkedRef.current || tasks.length === 0) return;
    if (!canNotify("dueTasks")) return;

    checkedRef.current = true;
    clearOldNotificationRecords();

    const candidates = getDueReminderCandidates(tasks, timezone);
    const fresh = filterAlreadyNotified(candidates);
    if (fresh.length === 0) return;

    markNotified(fresh.map((c) => c.taskId));

    window.dispatchEvent(
      new CustomEvent("pwa:due-tasks-reminder", {
        detail: {
          count: fresh.length,
          topTasks: fresh.slice(0, 3).map((c) => c.title),
        },
      }),
    );
  }, [tasks, timezone]);

  // Re-check when tab becomes visible again
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        checkedRef.current = false;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return null;
}
