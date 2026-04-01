/**
 * Pure-logic helpers for due-task reminder candidates.
 * All state lives in localStorage — no server interaction.
 */
import type { Task } from "@/types";
import { getTodayStrInTz } from "@/lib/timezone";

const STORAGE_PREFIX = "flowfocus:task-reminders:";

export interface ReminderCandidate {
  taskId: string;
  title: string;
  dueDate: string;
  priority: 1 | 2 | 3 | 4;
  isOverdue: boolean;
}

/**
 * Returns tasks that are due today or overdue, sorted by priority.
 */
export function getDueReminderCandidates(
  tasks: Task[],
  timezone: string,
): ReminderCandidate[] {
  const todayStr = getTodayStrInTz(timezone);

  return tasks
    .filter((t) => !t.completed && !t.isDeleted && t.dueDate)
    .map((t) => {
      const dateStr = t.dueDate!.split("T")[0];
      return {
        taskId: t.id,
        title: t.title,
        dueDate: dateStr,
        priority: t.priority,
        isOverdue: dateStr < todayStr,
      };
    })
    .filter((c) => c.dueDate <= todayStr)
    .sort((a, b) => {
      // Overdue first, then by priority asc
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return a.priority - b.priority;
    })
    .slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getNotifiedSet(): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${todayKey()}`);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveNotifiedSet(ids: Set<string>): void {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${todayKey()}`,
      JSON.stringify([...ids]),
    );
  } catch { /* quota */ }
}

/**
 * Filter out candidates whose notifications were already sent today.
 */
export function filterAlreadyNotified(
  candidates: ReminderCandidate[],
): ReminderCandidate[] {
  const sent = getNotifiedSet();
  return candidates.filter((c) => !sent.has(c.taskId));
}

/**
 * Record that these task IDs have been notified today.
 */
export function markNotified(taskIds: string[]): void {
  const sent = getNotifiedSet();
  for (const id of taskIds) sent.add(id);
  saveNotifiedSet(sent);
}

/**
 * Clean up localStorage keys older than 3 days.
 */
export function clearOldNotificationRecords(): void {
  if (typeof window === "undefined") return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    const dateStr = key.slice(STORAGE_PREFIX.length);
    if (dateStr < cutoffStr) {
      window.localStorage.removeItem(key);
    }
  }
}
