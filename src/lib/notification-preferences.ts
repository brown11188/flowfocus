/**
 * Notification preferences — localStorage-backed, no server round-trip.
 */

const STORAGE_KEY = "flowfocus:notification-prefs:v1";

export interface NotificationPreferences {
  /** Master switch — all notifications gated behind this */
  enabled: boolean;
  /** Notify when a focus session completes */
  focusTimer: boolean;
  /** Notify when the daily briefing is ready */
  dailyBriefing: boolean;
  /** Notify for due / overdue tasks */
  dueTasks: boolean;
  /** Notify for email follow-up reminders */
  emailFollowUps: boolean;
  /** Update app badge with counts */
  badges: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  focusTimer: true,
  dailyBriefing: true,
  dueTasks: true,
  emailFollowUps: true,
  badges: true,
};

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<NotificationPreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function setNotificationPreferences(
  partial: Partial<NotificationPreferences>,
): NotificationPreferences {
  const current = getNotificationPreferences();
  const next = { ...current, ...partial };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* quota */ }
  return next;
}

type NotifiableFeature = "focusTimer" | "dailyBriefing" | "dueTasks" | "emailFollowUps";

/** Returns true when we should show a notification for a given feature. */
export function canNotify(type: NotifiableFeature): boolean {
  if (typeof window === "undefined") return false;
  const prefs = getNotificationPreferences();
  return prefs.enabled && prefs[type] && getPermissionStatus() === "granted";
}

export function getPermissionStatus(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
}
