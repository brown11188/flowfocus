"use client";

import { useState, useCallback, useEffect } from "react";
import { Bell, BellOff, ShieldCheck, ShieldAlert, Send } from "lucide-react";
import { toast } from "sonner";
import { SettingsSwitchRow } from "@/components/composed/settings-switch-row";
import { StatusPill } from "@/components/composed/status-pill";
import {
  getNotificationPreferences,
  setNotificationPreferences,
  getPermissionStatus,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import {
  requestNotificationPermission,
  showLocalNotification,
} from "@/lib/local-notifications";

export function PWANotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(getNotificationPreferences);
  const [permission, setPermission] = useState<string>("default");

  useEffect(() => {
    setPermission(getPermissionStatus());
  }, []);

  const update = useCallback((partial: Partial<NotificationPreferences>) => {
    const next = setNotificationPreferences(partial);
    setPrefs(next);
  }, []);

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      toast.success("Notifications enabled!");
    } else if (result === "denied") {
      toast.error("Notifications blocked by browser. Check your browser settings.");
    }
  };

  const handleTestNotification = () => {
    const ok = showLocalNotification({
      title: "FlowFocus Test 🔔",
      body: "Notifications are working!",
      tag: "test",
    });
    if (!ok) toast.error("Could not show notification. Check permission.");
  };

  const permissionBadge = (() => {
    switch (permission) {
      case "granted":
        return { label: "Granted", variant: "green" as const };
      case "denied":
        return { label: "Blocked", variant: "red" as const };
      case "unsupported":
        return { label: "Unsupported", variant: "gray" as const };
      default:
        return { label: "Not set", variant: "amber" as const };
    }
  })();

  const masterDisabled = permission !== "granted";
  const featureDisabled = masterDisabled || !prefs.enabled;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-violet-500" />
        <h2 className="font-semibold text-gray-900 dark:text-white">Notifications</h2>
        <StatusPill label={permissionBadge.label} variant={permissionBadge.variant} dot />
      </div>

      {/* Permission card */}
      {permission !== "granted" && (
        <div className="rounded-xl border p-4 space-y-2 border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20">
          {permission === "denied" ? (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                <ShieldAlert className="w-4 h-4" />
                Notifications are blocked
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Open your browser settings and allow notifications for this site,
                then reload the page.
              </p>
            </>
          ) : permission === "unsupported" ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This browser does not support notifications.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                <ShieldCheck className="w-4 h-4" />
                Enable notifications to get reminders
              </div>
              <button
                onClick={handleRequestPermission}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors"
              >
                <Bell className="w-3 h-3" />
                Allow Notifications
              </button>
            </>
          )}
        </div>
      )}

      {/* Master toggle */}
      <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
        <SettingsSwitchRow
          title="Enable all notifications"
          description="Master switch for every notification type below"
          enabled={prefs.enabled}
          onChange={(v) => update({ enabled: v })}
          disabled={masterDisabled}
        />
      </div>

      {/* Per-feature toggles */}
      <div className="space-y-1">
        <SettingsSwitchRow
          title="Focus timer complete"
          description="Alert when a focus session finishes"
          enabled={prefs.focusTimer}
          onChange={(v) => update({ focusTimer: v })}
          disabled={featureDisabled}
        />
        <SettingsSwitchRow
          title="Daily briefing ready"
          description="Notify when your daily briefing loads"
          enabled={prefs.dailyBriefing}
          onChange={(v) => update({ dailyBriefing: v })}
          disabled={featureDisabled}
        />
        <SettingsSwitchRow
          title="Due task reminders"
          description="Remind you about overdue and due-today tasks"
          enabled={prefs.dueTasks}
          onChange={(v) => update({ dueTasks: v })}
          disabled={featureDisabled}
        />
        <SettingsSwitchRow
          title="Email follow-up reminders"
          description="Remind you about pending email follow-ups"
          enabled={prefs.emailFollowUps}
          onChange={(v) => update({ emailFollowUps: v })}
          disabled={featureDisabled}
        />
        <SettingsSwitchRow
          title="App badge updates"
          description="Show pending count on the app icon"
          enabled={prefs.badges}
          onChange={(v) => update({ badges: v })}
          disabled={masterDisabled}
        />
      </div>

      {/* Test notification */}
      {permission === "granted" && (
        <button
          onClick={handleTestNotification}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Send className="w-3 h-3" />
          Send test notification
        </button>
      )}
    </div>
  );
}
