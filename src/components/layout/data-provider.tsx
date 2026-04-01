"use client";
import { useEffect, useCallback } from "react";
import { useTaskStore } from "@/store/task-store";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
  flushOfflineTaskQueue,
  getOfflineTaskQueue,
  getOldestPendingTaskMutationAt,
  getPendingTaskMutationsCount,
  getOfflineQueueDiagnostics,
  hasPendingTaskMutations,
  isOnline,
} from "@/lib/offline-tasks";

export function DataProvider({ children }: { children: React.ReactNode }) {
  const {
    setTasks,
    setProjects,
    setLabels,
    setRisks,
    setApprovalItems,
    setScopeChanges,
    setDecisionLogs,
    setMeetingNotes,
    setStatusReports,
    setHasOfflineChanges,
    setOfflinePendingCount,
    setOfflineOldestPendingAt,
    setOfflineLastSyncedAt,
    setOfflineSyncInProgress,
    setOfflineFailedCount,
    setOfflineLastError,
  } = useTaskStore();

  const load = useCallback(async () => {
    try {
      const requests = [
        apiFetch("/api/tasks"),
        apiFetch("/api/projects"),
        apiFetch("/api/labels"),
        apiFetch("/api/risks").catch(() => null),
        apiFetch("/api/approvals").catch(() => null),
        apiFetch("/api/scope-changes").catch(() => null),
        apiFetch("/api/decision-logs").catch(() => null),
        apiFetch("/api/meeting-notes").catch(() => null),
        apiFetch("/api/status-reports").catch(() => null),
      ] as const;
      const [tasksRes, projectsRes, labelsRes, risksRes, approvalsRes, scopeRes, decisionsRes, meetingNotesRes, reportsRes] = await Promise.all(requests);
      const [tasks, projects, labels, risks, approvals, scopeChanges, decisions, meetingNotes, reports] = await Promise.all([
        tasksRes.json(),
        projectsRes.json(),
        labelsRes.json(),
        risksRes?.json?.() ?? Promise.resolve([]),
        approvalsRes?.json?.() ?? Promise.resolve([]),
        scopeRes?.json?.() ?? Promise.resolve([]),
        decisionsRes?.json?.() ?? Promise.resolve([]),
        meetingNotesRes?.json?.() ?? Promise.resolve([]),
        reportsRes?.json?.() ?? Promise.resolve([]),
      ]);
      setTasks(Array.isArray(tasks) ? tasks : []);
      setProjects(Array.isArray(projects) ? projects : []);
      setLabels(Array.isArray(labels) ? labels : []);
      setRisks(Array.isArray(risks) ? risks : []);
      setApprovalItems(Array.isArray(approvals) ? approvals : []);
      setScopeChanges(Array.isArray(scopeChanges) ? scopeChanges : []);
      setDecisionLogs(Array.isArray(decisions) ? decisions : []);
      setMeetingNotes(Array.isArray(meetingNotes) ? meetingNotes : []);
      setStatusReports(Array.isArray(reports) ? reports : []);
    } catch {
      toast.error("Failed to load data");
    }
  }, [setTasks, setProjects, setLabels, setRisks, setApprovalItems, setScopeChanges, setDecisionLogs, setMeetingNotes, setStatusReports]);

  const updateOfflineIndicators = useCallback(() => {
    const pendingCount = getPendingTaskMutationsCount();
    setHasOfflineChanges(pendingCount > 0);
    setOfflinePendingCount(pendingCount);
    setOfflineOldestPendingAt(getOldestPendingTaskMutationAt());
  }, [setHasOfflineChanges, setOfflineOldestPendingAt, setOfflinePendingCount]);

  const syncOfflineQueue = useCallback(async (showToast = false) => {
    if (!isOnline() || !hasPendingTaskMutations()) {
      updateOfflineIndicators();
      return;
    }

    setOfflineSyncInProgress(true);
    setOfflineLastError(null);

    const result = await flushOfflineTaskQueue();
    updateOfflineIndicators();

    const diagnostics = getOfflineQueueDiagnostics();
    setOfflineFailedCount(diagnostics.totalFailed);
    setOfflineLastError(diagnostics.lastError);
    setOfflineSyncInProgress(false);

    if (result.syncedCount > 0) {
      setOfflineLastSyncedAt(new Date().toISOString());
      await load();
      if (showToast) {
        toast.success(`Synced ${result.syncedCount} offline change${result.syncedCount === 1 ? "" : "s"}.`);
      }
    }

    if (result.failedCount > 0 && showToast) {
      toast.warning(`${result.failedCount} offline change${result.failedCount === 1 ? " is" : "s are"} still pending.`);
    }
  }, [load, setOfflineLastSyncedAt, setOfflineSyncInProgress, setOfflineFailedCount, setOfflineLastError, updateOfflineIndicators]);

  useEffect(() => {
    updateOfflineIndicators();
    void load();
  }, [load, updateOfflineIndicators]);

  useEffect(() => {
    const onTaskCreated = () => load();
    const onQueued = () => updateOfflineIndicators();
    const onQueueChanged = () => updateOfflineIndicators();
    const onSynced = () => {
      updateOfflineIndicators();
      setOfflineLastSyncedAt(new Date().toISOString());
      void load();
    };
    const onSyncFailed = () => updateOfflineIndicators();
    const onOnline = () => {
      void syncOfflineQueue(true);
    };
    const onManualSync = () => {
      void syncOfflineQueue(true);
    };

    window.addEventListener("friday:task-created", onTaskCreated);
    window.addEventListener("offline-tasks:queued", onQueued);
    window.addEventListener("offline-tasks:queue-changed", onQueueChanged);
    window.addEventListener("offline-tasks:synced", onSynced);
    window.addEventListener("offline-tasks:sync-failed", onSyncFailed);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline-tasks:manual-sync", onManualSync);

    return () => {
      window.removeEventListener("friday:task-created", onTaskCreated);
      window.removeEventListener("offline-tasks:queued", onQueued);
      window.removeEventListener("offline-tasks:queue-changed", onQueueChanged);
      window.removeEventListener("offline-tasks:synced", onSynced);
      window.removeEventListener("offline-tasks:sync-failed", onSyncFailed);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline-tasks:manual-sync", onManualSync);
    };
  }, [load, setOfflineLastSyncedAt, syncOfflineQueue, updateOfflineIndicators]);

  return <>{children}</>;
}
