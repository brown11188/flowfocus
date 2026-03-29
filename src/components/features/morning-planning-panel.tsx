"use client";
import { useState, useEffect, useCallback } from "react";
import { Sun, Calendar, Sparkles, Target, X, ChevronRight, Loader2 } from "lucide-react";
import { useTaskStore } from "@/store/task-store";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isToday, isOverdue } from "@/lib/utils";
import { getTodayStrInTz } from "@/lib/timezone";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";

interface CalendarEvent {
  subject: string;
  startTime: string;
  endTime: string;
}

interface AIPriority {
  taskId: string;
  title: string;
  reason: string;
}

export function MorningPlanningPanel() {
  const { tasks, updateTask } = useTaskStore();
  const { timezone } = useTimezoneCtx();
  const todayStr = getTodayStrInTz(timezone);
  const [dismissed, setDismissed] = useState(false);
  const [intention, setIntention] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [aiPriorities, setAiPriorities] = useState<AIPriority[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentHour = new Date().getHours();
  const todayTasks = tasks.filter(t => !t.isDeleted && t.dueDate && isToday(t.dueDate, timezone) && !t.parentId);
  const overdueTasks = tasks.filter(t => !t.isDeleted && t.dueDate && isOverdue(t.dueDate, timezone) && !t.completed);
  const userName = typeof window !== "undefined" ? "" : "";

  // Check if already dismissed today
  useEffect(() => {
    const key = `morning_plan_${todayStr}`;
    if (localStorage.getItem(key)) setDismissed(true);
  }, [todayStr]);

  // Load calendar events
  useEffect(() => {
    if (dismissed) return;
    setLoadingCalendar(true);
    apiFetch("/api/microsoft/calendar?range=today")
      .then(r => r.ok ? r.json() : [])
      .then(data => setCalendarEvents(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {})
      .finally(() => setLoadingCalendar(false));
  }, [dismissed]);

  // Load AI priorities
  const loadAIPriorities = useCallback(async () => {
    setLoadingAI(true);
    try {
      const res = await apiFetch("/api/ai", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const priorities = (data.priorities || []).slice(0, 3).map((p: { taskId: string; reason: string }) => {
          const task = tasks.find(t => t.id === p.taskId);
          return { taskId: p.taskId, title: task?.title || "Unknown task", reason: p.reason };
        });
        setAiPriorities(priorities);
        setSelectedPriorities(new Set(priorities.map((p: AIPriority) => p.taskId)));
      }
    } catch { /* silent */ }
    finally { setLoadingAI(false); }
  }, [tasks]);

  useEffect(() => {
    if (!dismissed && tasks.length > 0) loadAIPriorities();
  }, [dismissed, tasks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Don't show if: afternoon, or dismissed, or already has tasks scheduled
  if (currentHour >= 12 || dismissed) return null;

  const handleLockIn = async () => {
    setSaving(true);
    try {
      // Save daily log with intention
      await apiFetch("/api/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayStr, intention, morningDone: true }),
      });
      toast.success("Day planned! Let's go 🚀");
      localStorage.setItem(`morning_plan_${todayStr}`, "done");
      setDismissed(true);
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const handleSkip = () => {
    localStorage.setItem(`morning_plan_${todayStr}`, "skipped");
    setDismissed(true);
  };

  const togglePriority = (taskId: string) => {
    setSelectedPriorities(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  return (
    <div className="mb-5 rounded-2xl border border-violet-200 dark:border-violet-800 overflow-hidden shadow-sm">
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5" />
            <h2 className="font-semibold">Good morning! Let&apos;s plan your day ☀️</h2>
          </div>
          <button onClick={handleSkip} className="text-white/70 hover:text-white text-xs">
            Skip for now
          </button>
        </div>
      </div>

      <div className="p-5 bg-white dark:bg-gray-900 space-y-5">
        {/* Calendar today */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-violet-500" /> Your calendar today
          </h3>
          {loadingCalendar ? (
            <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Loading calendar...</div>
          ) : calendarEvents.length > 0 ? (
            <div className="space-y-1.5">
              {calendarEvents.map((ev, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-violet-50 dark:bg-violet-950/30 px-3 py-1.5 rounded-lg">
                  <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">{ev.startTime?.slice(11, 16)}</span>
                  <span className="truncate">{ev.subject}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No calendar events. Connect Microsoft 365 in Settings for calendar sync.</p>
          )}
        </div>

        {/* AI priorities */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-violet-500" /> AI suggests {aiPriorities.length} priorities
          </h3>
          {loadingAI ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
            </div>
          ) : aiPriorities.length > 0 ? (
            <div className="space-y-1.5">
              {aiPriorities.map(p => (
                <label key={p.taskId} className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedPriorities.has(p.taskId)}
                    onChange={() => togglePriority(p.taskId)}
                    className="mt-0.5 accent-violet-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.reason}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No priorities available yet.</p>
          )}
        </div>

        {/* Overdue warning */}
        {overdueTasks.length > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
            ⚠️ {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? "s" : ""} need attention
          </div>
        )}

        {/* Intention */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-violet-500" /> Set your intention
          </h3>
          <input
            value={intention}
            onChange={e => setIntention(e.target.value)}
            placeholder="What's your main goal today?"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-gray-400"
          />
        </div>

        {/* CTA */}
        <button
          onClick={handleLockIn}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Lock in my day <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
