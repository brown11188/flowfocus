"use client";
import { useEffect, useCallback } from "react";
import { useTaskStore } from "@/store/task-store";
import { toast } from "sonner";
import { Task } from "@/types";
import { apiFetch } from "@/lib/api";

export function useTasks() {
  const { tasks, projects, labels, isLoading, setTasks, setProjects, setLabels, setIsLoading, addTask, updateTask, removeTask, setRisks, setApprovalItems, setScopeChanges, setDecisionLogs, setMeetingNotes, setStatusReports } = useTaskStore();

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tasksRes, projectsRes, labelsRes, risksRes, approvalsRes, scopeRes, decisionsRes, meetingNotesRes, reportsRes] = await Promise.all([
        apiFetch("/api/tasks"),
        apiFetch("/api/projects"),
        apiFetch("/api/labels"),
        apiFetch("/api/risks").catch(() => null),
        apiFetch("/api/approvals").catch(() => null),
        apiFetch("/api/scope-changes").catch(() => null),
        apiFetch("/api/decision-logs").catch(() => null),
        apiFetch("/api/meeting-notes").catch(() => null),
        apiFetch("/api/status-reports").catch(() => null),
      ]);
      const [tasksData, projectsData, labelsData, risksData, approvalsData, scopeData, decisionsData, meetingNotesData, reportsData] = await Promise.all([
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
      setTasks(tasksData);
      setProjects(projectsData);
      setLabels(labelsData);
      setRisks(risksData);
      setApprovalItems(approvalsData);
      setScopeChanges(scopeData);
      setDecisionLogs(decisionsData);
      setMeetingNotes(meetingNotesData);
      setStatusReports(reportsData);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [setTasks, setProjects, setLabels, setIsLoading, setRisks, setApprovalItems, setScopeChanges, setDecisionLogs, setMeetingNotes, setStatusReports]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createTask = async (data: Partial<Task>) => {
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const task = await res.json();
      addTask(task);
      return task;
    } catch {
      toast.error("Failed to create task");
    }
  };

  const completeTask = async (id: string, completed: boolean) => {
    updateTask(id, { completed, completedAt: completed ? new Date().toISOString() : null });
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed, completedAt: completed ? new Date().toISOString() : null }),
      });
    } catch {
      updateTask(id, { completed: !completed });
      toast.error("Failed to update task");
    }
  };

  const editTask = async (id: string, data: Partial<Task>) => {
    updateTask(id, data);
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      toast.error("Failed to update task");
      fetchAll();
    }
  };

  const deleteTask = async (id: string) => {
    removeTask(id);
    try {
      await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
      fetchAll();
    }
  };

  return { tasks, projects, labels, isLoading, fetchAll, createTask, completeTask, editTask, deleteTask };
}
