"use client";
import { useEffect, useState, useCallback } from "react";
import { useTaskStore } from "@/store/task-store";
import { Task, AIFocusResult, Stats } from "@/types";
import { cn, PRIORITY_CONFIG, formatDate, isToday, isOverdue } from "@/lib/utils";
import {
  Sparkles, RefreshCw, Check, BellOff, ChevronRight,
  Flame, Target, TrendingUp, CheckCircle2, AlertTriangle,
  Calendar, Zap, Clock, Hash, FolderOpen,
} from "lucide-react";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { EmailIntelligenceWidget } from "@/components/microsoft/email-intelligence-widget";

interface Sprint {
  id: string; name: string; goal?: string;
  startDate: string; endDate: string;
  isActive: boolean; isCompleted?: boolean;
  projectId: string;
  _count?: { tasks: number };
}

export default function DashboardPage() {
  const { tasks, projects, updateTask, removeTask } = useTaskStore();
  const [aiResult, setAiResult] = useState<AIFocusResult | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [sprintDone, setSprintDone] = useState(0);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch { /* silent */ }
  }, []);

  const loadAI = useCallback(async () => {
    setIsLoadingAI(true);
    try {
      const res = await apiFetch("/api/ai", { method: "POST" });
      if (!res.ok) { const e = await res.json(); toast.error(e.error || "AI unavailable"); return; }
      const data = await res.json();
      setAiResult(data);
    } catch { toast.error("Failed to load AI analysis"); }
    finally { setIsLoadingAI(false); }
  }, []);

  // Load active sprint from all non-inbox projects
  const loadActiveSprint = useCallback(async () => {
    const nonInbox = projects.filter(p => !p.isInbox);
    if (nonInbox.length === 0) return;
    try {
      const results = await Promise.all(
        nonInbox.map(p => apiFetch("/api/sprints?projectId=" + p.id).then(r => r.json()))
      );
      const allSprints: Sprint[] = results.flat();
      const active = allSprints
        .filter(s => s.isActive)
        .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())[0] ?? null;
      setActiveSprint(active);
      if (active) {
        const sprintTasks = tasks.filter(t => t.sprintId === active.id && !t.isDeleted);
        setSprintDone(sprintTasks.filter(t => t.completed).length);
      }
    } catch { /* silent */ }
  }, [projects, tasks]);

  useEffect(() => {
    loadAI();
    loadStats();
  }, [loadAI, loadStats]);

  useEffect(() => {
    if (projects.length > 0) loadActiveSprint();
  }, [projects.length]); // eslint-disable-line

  const handleComplete = async (id: string, completed: boolean) => {
    updateTask(id, { completed, completedAt: completed ? new Date().toISOString() : null });
    await apiFetch("/api/tasks/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed }) });
    if (completed) loadStats();
  };

  const handleEdit = async (id: string, data: Partial<Task>) => {
    updateTask(id, data);
    await apiFetch("/api/tasks/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  };

  const handleDelete = async (id: string) => {
    removeTask(id);
    await apiFetch("/api/tasks/" + id, { method: "DELETE" });
    toast.success("Task deleted");
  };

  // ── Derived stats ────────────────────────────────────────────────────────
  const todayTotal = tasks.filter(t => t.dueDate && isToday(t.dueDate) && !t.isDeleted).length;
  const todayDone = tasks.filter(t => t.dueDate && isToday(t.dueDate) && t.completed && !t.isDeleted).length;
  const completionPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
  const overdueCount = tasks.filter(t => !t.isDeleted && !t.completed && t.dueDate && isOverdue(t.dueDate)).length;

  const focusTasks = aiResult?.priorities
    ?.filter(p => !snoozed.has(p.taskId))
    .map(p => ({ ...p, task: tasks.find(t => t.id === p.taskId) }))
    .filter(p => p.task && !p.task.completed)
    .slice(0, 3) || [];

  // Active Projects widget
  const activeProjects = projects
    .filter(p => !p.isInbox)
    .map(p => {
      const pt = tasks.filter(t => t.projectId === p.id && !t.isDeleted);
      const total = pt.length;
      const done = pt.filter(t => t.completed).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return { ...p, total, done, pct };
    })
    .filter(p => p.total > 0)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  // Upcoming deadlines widget
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split("T")[0];
  const weekStr = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];

  const upcoming = tasks.filter(t => !t.isDeleted && !t.completed && t.dueDate);
  const todayCount = upcoming.filter(t => t.dueDate!.startsWith(todayStr)).length;
  const tomorrowCount = upcoming.filter(t => t.dueDate!.startsWith(tomorrowStr)).length;
  const thisWeekCount = upcoming.filter(t => {
    const d = t.dueDate!.split("T")[0];
    return d > tomorrowStr && d <= weekStr;
  }).length;

  // Sprint data
  const sprintTotalCount = activeSprint?._count?.tasks
    ?? tasks.filter(t => activeSprint && t.sprintId === activeSprint.id && !t.isDeleted).length;
  const sprintPct = sprintTotalCount > 0 ? Math.round((sprintDone / sprintTotalCount) * 100) : 0;
  const sprintDaysLeft = activeSprint
    ? Math.max(0, Math.ceil((new Date(activeSprint.endDate).getTime() - now.getTime()) / 86400000))
    : 0;
  const sprintProject = activeSprint ? projects.find(p => p.id === activeSprint.projectId) : null;

  const greetingHour = now.getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {aiResult?.greeting || `${greeting} 👋`}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 sm:gap-6">

        {/* ─── LEFT COLUMN ─────────────────────────────────────── */}
        <div className="space-y-5 min-w-0">

          {/* Stats row — 4 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* Today Progress */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-violet-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Today</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{completionPct}%</div>
              <div className="text-xs text-gray-400 mt-0.5">{todayDone}/{todayTotal} tasks</div>
              <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: completionPct + "%" }} />
              </div>
            </div>
            {/* Streak */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Streak</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.streak ?? 0}</div>
              <div className="text-xs text-gray-400 mt-0.5">day{stats?.streak !== 1 ? "s" : ""} in a row</div>
            </div>
            {/* Completed Today */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Done Today</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.completedToday ?? 0}</div>
              <div className="text-xs text-gray-400 mt-0.5">tasks done</div>
            </div>
            {/* Overdue */}
            <div className={cn(
              "rounded-xl p-4 border",
              overdueCount > 0
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={cn("w-4 h-4", overdueCount > 0 ? "text-red-500" : "text-gray-400")} />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Overdue</span>
              </div>
              <div className={cn("text-2xl font-bold", overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white")}>
                {overdueCount}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{overdueCount > 0 ? "needs attention" : "all clear"}</div>
            </div>
          </div>

          {/* Weekly chart */}
          {stats?.weeklyData && (
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">This Week</span>
                <span className="text-xs text-gray-400 ml-auto">Tasks completed</span>
              </div>
              <div className="flex items-end gap-2 h-20">
                {stats.weeklyData.map((d, i) => {
                  const maxCount = Math.max(...stats.weeklyData.map(w => w.count), 1);
                  const pct = (d.count / maxCount) * 100;
                  const isCurrentDay = i === stats.weeklyData.length - 1;
                  const date = new Date();
                  date.setDate(date.getDate() - (stats.weeklyData.length - 1 - i));
                  const dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {/* Tooltip */}
                      {d.count > 0 && (
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {d.count} task{d.count !== 1 ? "s" : ""} · {dateLabel}
                        </div>
                      )}
                      <div className="w-full flex items-end justify-center" style={{ height: "64px" }}>
                        <div
                          className={cn(
                            "w-full rounded-t-sm transition-all",
                            isCurrentDay ? "bg-violet-500" : "bg-violet-200 dark:bg-violet-900"
                          )}
                          style={{ height: Math.max(pct, 4) + "%", minHeight: d.count > 0 ? "4px" : "0" }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Projects widget */}
          {activeProjects.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Projects</span>
                </div>
                <Link href="/projects" className="text-xs text-violet-500 hover:text-violet-700 transition-colors">
                  View all
                </Link>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {activeProjects.map(p => (
                  <Link
                    key={p.id}
                    href={"/projects/" + p.id}
                    className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {p.name}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{p.done}/{p.total}</span>
                    <div className="hidden sm:block w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className={cn("h-full rounded-full transition-all", p.pct === 100 ? "bg-green-500" : "bg-violet-500")}
                        style={{ width: p.pct + "%" }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-9 text-right flex-shrink-0">{p.pct}%</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN ────────────────────────────────────── */}
        <div className="space-y-5">

          {/* AI Focus — compact */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/50 dark:to-indigo-950/50 border-b border-gray-100 dark:border-gray-800">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-semibold text-violet-700 dark:text-violet-300 flex-1">AI Focus</span>
              <button
                onClick={loadAI} disabled={isLoadingAI}
                className="p-1 rounded-lg text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors disabled:opacity-50"
                title="Refresh AI"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoadingAI && "animate-spin")} />
              </button>
            </div>
            {isLoadingAI ? (
              <div className="p-6 text-center">
                <div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-400">Analyzing…</p>
              </div>
            ) : aiResult ? (
              <div className="p-3 space-y-2">
                {aiResult.summary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic border-l-2 border-violet-300 pl-2.5 py-0.5 mb-2">
                    {aiResult.summary}
                  </p>
                )}
                {focusTasks.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-1.5" />
                    <p className="text-xs font-medium text-gray-500">All caught up! 🎉</p>
                  </div>
                ) : (
                  focusTasks.map(({ task, reason, rank }) => {
                    if (!task) return null;
                    const pc = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
                    return (
                      <div key={task.id} className={cn("rounded-xl border p-2.5", pc.border, pc.bg)}>
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-3 flex-shrink-0">#{rank}</span>
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => setSelectedTask(task)}
                              className="text-xs font-medium text-gray-900 dark:text-white text-left hover:text-violet-600 transition-colors leading-snug"
                            >
                              {task.title}
                            </button>
                            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-violet-400 flex-shrink-0" />
                              <span className="truncate">{reason}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => handleComplete(task.id, true)}
                              className="p-1 rounded-lg bg-green-100 dark:bg-green-950 text-green-600 hover:bg-green-200 dark:hover:bg-green-900 transition-colors"
                              title="Mark done"
                            ><Check className="w-3 h-3" /></button>
                            <button
                              onClick={() => setSnoozed(prev => new Set([...prev, task.id]))}
                              className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                              title="Snooze"
                            ><BellOff className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="p-6 text-center">
                <Sparkles className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Click ↺ to analyze your tasks</p>
              </div>
            )}
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <Calendar className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">Upcoming</span>
              <Link href="/upcoming" className="text-xs text-violet-500 hover:text-violet-700 transition-colors">View →</Link>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
              <Link href="/today" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", todayCount > 0 ? "bg-red-500" : "bg-gray-300")} />
                  <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Today</span>
                </div>
                <span className={cn("text-sm font-semibold", todayCount > 0 ? "text-red-500" : "text-gray-400")}>{todayCount}</span>
              </Link>
              <Link href="/upcoming" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Tomorrow</span>
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{tomorrowCount}</span>
              </Link>
              <Link href="/upcoming" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-violet-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">This week</span>
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{thisWeekCount}</span>
              </Link>
            </div>
          </div>

          {/* Active Sprint widget */}
          {activeSprint && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-800/50">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400 flex-1">Active Sprint</span>
                <Link href="/sprints" className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 transition-colors">View →</Link>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{activeSprint.name}</p>
                    {sprintProject && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sprintProject.color }} />
                        {sprintProject.name}
                      </p>
                    )}
                    {activeSprint.goal && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">"{activeSprint.goal}"</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn("text-sm font-bold", sprintDaysLeft <= 2 ? "text-red-500" : sprintDaysLeft <= 5 ? "text-amber-500" : "text-gray-700 dark:text-gray-300")}>
                      {sprintDaysLeft}d left
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(activeSprint.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500">{sprintDone}/{sprintTotalCount} tasks</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-auto">{sprintPct}%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", sprintPct === 100 ? "bg-green-500" : "bg-amber-500")}
                    style={{ width: sprintPct + "%" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Email Intelligence Widget */}
          <EmailIntelligenceWidget />

        </div>
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
