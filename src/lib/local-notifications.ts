/**
 * Thin wrapper around the Notification API.
 * Every public function guards on canNotify() + permission.
 */
import { canNotify, getPermissionStatus } from "@/lib/notification-preferences";
import { withBase } from "@/lib/pwa";

/* ------------------------------------------------------------------ */
/*  Core helpers                                                       */
/* ------------------------------------------------------------------ */

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.requestPermission();
}

export interface LocalNotificationOpts {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  icon?: string;
}

export function showLocalNotification(opts: LocalNotificationOpts): boolean {
  const perm = getPermissionStatus();
  if (perm !== "granted") return false;

  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      icon: opts.icon ?? withBase("/icon.svg"),
      data: { url: opts.url },
    });

    if (opts.url) {
      n.onclick = () => {
        window.focus();
        window.location.href = opts.url!;
      };
    }
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Feature-specific convenience helpers                               */
/* ------------------------------------------------------------------ */

export function notifyFocusComplete(taskLabel: string, durationMins: number): void {
  if (!canNotify("focusTimer")) return;
  showLocalNotification({
    title: "Focus session complete! 🌟",
    body: `${durationMins} min on "${taskLabel}". Take a break! ☕`,
    tag: "focus-complete",
    url: withBase("/today"),
  });
}

export function notifyDailyBriefingReady(summary?: string): void {
  if (!canNotify("dailyBriefing")) return;
  showLocalNotification({
    title: "Your daily briefing is ready ☀️",
    body: summary ?? "Check your dashboard for today's plan.",
    tag: "daily-briefing",
    url: withBase("/dashboard"),
  });
}

const DUE_TAG_PREFIX = "due-tasks-";

export function notifyDueTasksSummary(count: number, topTasks: string[]): void {
  if (!canNotify("dueTasks")) return;
  const todayKey = new Date().toISOString().slice(0, 10);
  showLocalNotification({
    title: `${count} task${count === 1 ? "" : "s"} need attention 📋`,
    body: topTasks.slice(0, 3).join(", "),
    tag: `${DUE_TAG_PREFIX}${todayKey}`,
    url: withBase("/today"),
  });
}
