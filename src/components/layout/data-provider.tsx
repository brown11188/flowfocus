"use client";
import { useEffect, useCallback } from "react";
import { useTaskStore } from "@/store/task-store";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { setTasks, setProjects, setLabels } = useTaskStore();

  const load = useCallback(async () => {
    try {
      const [tasksRes, projectsRes, labelsRes] = await Promise.all([
        apiFetch("/api/tasks"),
        apiFetch("/api/projects"),
        apiFetch("/api/labels"),
      ]);
      const [tasks, projects, labels] = await Promise.all([
        tasksRes.json(), projectsRes.json(), labelsRes.json()
      ]);
      setTasks(Array.isArray(tasks) ? tasks : []);
      setProjects(Array.isArray(projects) ? projects : []);
      setLabels(Array.isArray(labels) ? labels : []);
    } catch {
      toast.error("Failed to load data");
    }
  }, [setTasks, setProjects, setLabels]);

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
