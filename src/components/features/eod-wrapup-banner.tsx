"use client";
import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Check, ArrowRight, Trash2, Loader2, Moon } from "lucide-react";
import { useTaskStore } from "@/store/task-store";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isToday, isOverdue } from "@/lib/utils";
import { getTodayStrInTz } from "@/lib/timezone";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";
import { Task } from "@/types";

export function EODWrapupBanner() {
  const { tasks, updateTask, removeTask } = useTaskStore();
  const { timezone } = useTimezoneCtx();
  const todayStr = getTodayStrInTz(timezone);
  const [expanded, setExpanded] = useState(false);
  const [eodNote, setEodNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== "undefined") return !!localStorage.getItem(`eod_${todayStr}`);
    return false;
  });

  const currentHour = new Date().getHours();

  const todayTasks = useMemo(() =>
    tasks.filter(t => !t.isDeleted && t.dueDate && isToday(t.dueDate, timezone) && !t.parentId),
    [tasks, timezone]
  );
  const completedToday = todayTasks.filter(t => t.completed);
  const openToday = todayTasks.filter(t => !t.completed);
  const tomorrowTasks = useMemo(() => {
    const tmrStr = getTodayStrInTz(timezone, 1);
    return tasks.filter(t => !t.isDeleted && !t.completed && t.dueDate?.startsWith(tmrStr));
  }, [tasks, timezone]);

  if (currentHour < 16 || dismissed) return null;

  const handleComplete = async (id: string) => {
    updateTask(id, { completed: true, completedAt: new Date().toISOString() });
    await apiFetch("/api/tasks/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
  };

  const handleDeferTomorrow = async (id: string) => {
    const tmrDate = new Date();
    tmrDate.setDate(tmrDate.getDate() + 1);
    const tmrISO = tmrDate.toISOString();
    updateTask(id, { dueDate: tmrISO });
    await apiFetch("/api/tasks/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: tmrISO }),
    });
    toast.info("Deferred to tomorrow");
  };

  const handleDeferNextWeek = async (id: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    updateTask(id, { dueDate: d.toISOString() });
    await apiFetch("/api/tasks/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: d.toISOString() }),
    });
    toast.info("Deferred to next week");
  };

  const handleCancel = async (id: string) => {
    removeTask(id);
    await apiFetch("/api/tasks/" + id, { method: "DELETE" });
    toast.success("Task cancelled");
  };

  const handleCloseOut = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          eodNote,
          completedCount: completedToday.length,
          deferredCount: openToday.length,
          eodDone: true,
        }),
      });
      toast.success("Day closed out! Good job 🌟");
      localStorage.setItem(`eod_${todayStr}`, "done");
      setDismissed(true);
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 dark:border-amber-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            End of day wrap-up — {completedToday.length} done, {openToday.length} open
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
      </button>

      {expanded && (
        <div className="p-5 bg-white dark:bg-gray-900 space-y-4">
          {/* Completed */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Completed today: {completedToday.length} tasks ✅
            </p>
          </div>

          {/* Still open */}
          {openToday.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Still open: {openToday.length} tasks
              </p>
              <div className="space-y-1.5">
                {openToday.map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{task.title}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleComplete(task.id)} title="Done" className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900 text-green-600 transition-colors">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeferTomorrow(task.id)} title="Tomorrow" className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 transition-colors text-xs">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleCancel(task.id)} title="Cancel" className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tomorrow preview */}
          {tomorrowTasks.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Tomorrow&apos;s preview: {tomorrowTasks.length} tasks
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tomorrowTasks.slice(0, 5).map(t => (
                  <span key={t.id} className="text-xs px-2 py-1 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 rounded-md truncate max-w-[200px]">
                    {t.title}
                  </span>
                ))}
                {tomorrowTasks.length > 5 && (
                  <span className="text-xs text-gray-400">+{tomorrowTasks.length - 5} more</span>
                )}
              </div>
            </div>
          )}

          {/* Quick note */}
          <div>
            <textarea
              value={eodNote}
              onChange={e => setEodNote(e.target.value)}
              placeholder="Quick note about today..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400 resize-none"
            />
          </div>

          <button
            onClick={handleCloseOut}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Close out my day 🌙
          </button>
        </div>
      )}
    </div>
  );
}
