"use client";

import { WifiOff, RefreshCw, CheckCircle2, Clock3, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/task-store";

function formatTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OfflineStatusBar() {
  const {
    hasOfflineChanges,
    offlinePendingCount,
    offlineOldestPendingAt,
    offlineLastSyncedAt,
    offlineSyncInProgress,
    offlineFailedCount,
    offlineLastError,
  } = useTaskStore();

  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  if (online && !hasOfflineChanges && !offlineLastSyncedAt) {
    return null;
  }

  const syncedAt = formatTime(offlineLastSyncedAt);
  const oldestPendingAt = formatTime(offlineOldestPendingAt);

  const handleSyncNow = () => {
    window.dispatchEvent(new CustomEvent("offline-tasks:manual-sync"));
  };

  return (
    <div
      className={cn(
        "sticky top-0 z-30 border-b px-4 py-2 text-xs sm:px-6",
        online
          ? hasOfflineChanges
            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!online ? (
          <>
            <WifiOff className="h-3.5 w-3.5" />
            <span className="font-medium">Offline mode</span>
            <span className="opacity-80">You can keep working. Changes will sync when the connection returns.</span>
          </>
        ) : offlineSyncInProgress ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span className="font-medium">Syncing changes…</span>
          </>
        ) : hasOfflineChanges ? (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="font-medium">Sync pending</span>
            <span>
              {offlinePendingCount} change{offlinePendingCount === 1 ? "" : "s"} waiting
              {oldestPendingAt ? ` since ${oldestPendingAt}` : ""}
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-medium">All offline changes synced</span>
            {syncedAt ? <span>Last sync at {syncedAt}</span> : null}
          </>
        )}

        {/* Error indicator */}
        {offlineFailedCount > 0 && offlineLastError && online && !offlineSyncInProgress && (
          <span
            className="inline-flex items-center gap-1 truncate max-w-[220px] text-red-600 dark:text-red-400"
            title={offlineLastError}
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {offlineLastError.length > 40
              ? `${offlineLastError.slice(0, 40)}…`
              : offlineLastError}
          </span>
        )}

        {/* Pending badge + Sync Now */}
        {hasOfflineChanges && online && !offlineSyncInProgress && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="inline-flex items-center rounded-full border border-current/20 px-2 py-0.5 font-medium">
              <Clock3 className="mr-1 h-3 w-3" />
              {offlinePendingCount} pending
            </span>
            <button
              onClick={handleSyncNow}
              className="inline-flex items-center gap-1 rounded-full border border-current/20 px-2.5 py-0.5 font-medium hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Sync now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
