"use client";
import { useEffect, useCallback } from "react";
import { useTaskStore } from "@/store/task-store";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { setTasks, setProjects, setLabels, setRisks, setApprovalItems, setScopeChanges, setDecisionLogs, setMeetingNotes, setStatusReports } = useTaskStore();

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

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when Friday creates a task
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("friday:task-created", handler);
    return () => window.removeEventListener("friday:task-created", handler);
  }, [load]);

  return <>{children}</>;
}
