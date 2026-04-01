"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTaskStore } from "@/store/task-store";
import { APP_BASE, APP_ROOT, withBase } from "@/lib/pwa";
import { setAppBadge, clearAppBadge } from "@/lib/app-badge";
import { getNotificationPreferences } from "@/lib/notification-preferences";

const SW_URL = withBase("/sw.js");
const SW_SCOPE = APP_ROOT;

export function PWAProvider() {
  const {
    hasOfflineChanges,
    offlinePendingCount,
    offlineOldestPendingAt,
    offlineLastSyncedAt,
  } = useTaskStore();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let mounted = true;
    const updatePromptShown = { current: false };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_URL, {
          scope: SW_SCOPE,
        });

        const promptForUpdate = (worker: ServiceWorker | null) => {
          if (!worker || !mounted || updatePromptShown.current) {
            return;
          }

          updatePromptShown.current = true;

          toast.info("A new version of FlowFocus is ready.", {
            action: {
              label: "Refresh",
              onClick: () => worker.postMessage({ type: "SKIP_WAITING" }),
            },
            duration: 12000,
          });
        };

        if (registration.waiting) {
          promptForUpdate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }

          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptForUpdate(registration.waiting);
            }
          });
        });
      } catch (error) {
        console.error("Failed to register service worker", error);
      }
    };

    const onControllerChange = () => {
      // Clear stale runtime caches before reload to avoid serving old content
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys.filter((k) => k.includes("runtime")).map((k) => caches.delete(k)),
            ),
          )
          .finally(() => window.location.reload());
        return;
      }
      window.location.reload();
    };

    const onOffline = () => {
      toast.warning("You are offline. FlowFocus will use cached pages when possible.");
    };

    const onOnline = () => {
      toast.success("Back online.");
    };

    void register();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    const APPLE_STANDALONE_KEY = "apple-mobile-web-app-capable";

    const ensureMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    ensureMeta(APPLE_STANDALONE_KEY, "yes");
    ensureMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    ensureMeta("apple-mobile-web-app-title", "FlowFocus");

    let link = document.querySelector('link[rel="apple-touch-icon"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "apple-touch-icon");
      document.head.appendChild(link);
    }
    link.setAttribute("href", `${APP_BASE}/icon.svg` || "/icon.svg");
  }, []);

  useEffect(() => {
    if (!hasOfflineChanges || offlinePendingCount <= 0) {
      return;
    }

    const oldestLabel = offlineOldestPendingAt
      ? new Date(offlineOldestPendingAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    toast.info(
      oldestLabel
        ? `${offlinePendingCount} offline change${offlinePendingCount === 1 ? "" : "s"} waiting since ${oldestLabel}.`
        : `You have ${offlinePendingCount} offline change${offlinePendingCount === 1 ? "" : "s"} waiting to sync.`,
      {
        id: "offline-sync-pending",
        duration: 5000,
      },
    );
  }, [hasOfflineChanges, offlineOldestPendingAt, offlinePendingCount]);

  useEffect(() => {
    if (!offlineLastSyncedAt) {
      return;
    }

    const syncedAt = new Date(offlineLastSyncedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    toast.success(`Offline changes synced at ${syncedAt}.`, {
      id: "offline-sync-success",
      duration: 4000,
    });
  }, [offlineLastSyncedAt]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const prefs = getNotificationPreferences();

    if (!prefs.badges) {
      clearAppBadge();
      return;
    }

    if (hasOfflineChanges && offlinePendingCount > 0) {
      setAppBadge(offlinePendingCount);
    } else {
      clearAppBadge();
    }
  }, [hasOfflineChanges, offlinePendingCount]);

  return null;
}
