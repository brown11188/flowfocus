"use client";
import { useEffect, useState, useCallback } from "react";
import { useTaskStore } from "@/store/task-store";
import { Task, Stats } from "@/types";
import { cn, isToday, isOverdue } from "@/lib/utils";
import {
  Flame, Target, CheckCircle2, AlertTriangle,
  Calendar, Zap, Hash, Settings2,
} from "lucide-react";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { EmailIntelligenceWidget } from "@/components/microsoft/email-intelligence-widget";
import { DailyBriefingCard } from "@/components/friday/daily-briefing-card";
import { NotificationCenter } from "@/components/features/notification-center";
import { DashboardCustomize } from "@/components/features/dashboard-customize";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";
import { getTodayStrInTz } from "@/lib/timezone";
import { useDashboardWidgets } from "@/hooks/use-dashboard-widgets";
import { WeeklyGoals } from "@/components/features/weekly-goals";

interface Sprint {
  id: string; name: string; goal?: string;
  startDate: string; endDate: string;
  isActive: boolean; isCompleted?: boolean;
  projectId: string;
  _count?: { tasks: number };
}

export default function DashboardPage() {
  const { tasks, projects, updateTask, removeTask } = useTaskStore();
  const { timezone } = useTimezoneCtx();
  const { widgets, toggleWidget, isEnabled } = useDashboardWidgets();
  const [showCustomize, setShowCustomize] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
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
    loadStats();
  }, [loadStats]);

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

  // ── Derived data ─────────────────────────────────────────────────────
  const todayTotal = tasks.filter(t => t.dueDate && isToday(t.dueDate, timezone) && !t.isDeleted).length;
  const todayDone = tasks.filter(t => t.dueDate && isToday(t.dueDate, timezone) && t.completed && !t.isDeleted).length;
  const completionPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
  const overdueCount = tasks.filter(t => !t.isDeleted && !t.completed && t.dueDate && isOverdue(t.dueDate, timezone)).length;

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

  const now = new Date();
  const todayStr = getTodayStrInTz(timezone);
  const tomorrowStr = getTodayStrInTz(timezone, 1);
  const weekStr = getTodayStrInTz(timezone, 7);

  const upcoming = tasks.filter(t => !t.isDeleted && !t.completed && t.dueDate);
  const todayCount = upcoming.filter(t => t.dueDate!.startsWith(todayStr)).length;
  const tomorrowCount = upcoming.filter(t => t.dueDate!.startsWith(tomorrowStr)).length;
  const thisWeekCount = upcoming.filter(t => {
    const d = t.dueDate!.split("T")[0];
    return d > tomorrowStr && d <= weekStr;
  }).length;

  const sprintTotalCount = activeSprint?._count?.tasks
    ?? tasks.filter(t => activeSprint && t.sprintId === activeSprint.id && !t.isDeleted).length;
  const sprintPct = sprintTotalCount > 0 ? Math.round((sprintDone / sprintTotalCount) * 100) : 0;
  const sprintDaysLeft = activeSprint
    ? Math.max(0, Math.ceil((new Date(activeSprint.endDate).getTime() - now.getTime()) / 86400000))
    : 0;
  const sprintProject = activeSprint ? projects.find(p => p.id === activeSprint.projectId) : null;

  const greetingHour = new Date(now.toLocaleString("en-US", { timeZone: timezone })).getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
            {`${greeting} 👋`}
          </h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: timezone })}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowCustomize(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/50 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <NotificationCenter />
        </div>
      </div>

      {/* ═══ DAILY BRIEFING BAR ═══ */}
      {isEnabled("dailyBriefing") && (
        <div className="mb-3">
          <DailyBriefingCard
            onTaskComplete={(taskId) => handleComplete(taskId, true)}
            onTaskReschedule={async (taskId) => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              tomorrow.setHours(12, 0, 0, 0);
              await handleEdit(taskId, { dueDate: tomorrow.toISOString() });
              toast.success("Task moved to tomorrow");
            }}
          />
        </div>
      )}

      {/* ═══ STATS ROW — 4 compact cards ═══ */}
      {isEnabled("stats") && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatCard
            icon={<Target className="w-3.5 h-3.5 text-violet-500" />}
            label="Today"
            value={`${completionPct}%`}
            detail={`${todayDone}/${todayTotal}`}
            progress={completionPct}
            progressColor="bg-violet-500"
          />
          <StatCard
            icon={<Flame className="w-3.5 h-3.5 text-orange-500" />}
            label="Streak"
            value={String(stats?.streak ?? 0)}
            detail="weekdays"
          />
          <StatCard
            icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            label="Done"
            value={String(stats?.completedToday ?? 0)}
            detail="today"
          />
          <StatCard
            icon={<AlertTriangle className={cn("w-3.5 h-3.5", overdueCount > 0 ? "text-red-500" : "text-gray-400")} />}
            label="Overdue"
            value={String(overdueCount)}
            detail={overdueCount > 0 ? "attention" : "clear"}
            className={overdueCount > 0 ? "!border-red-200 dark:!border-red-800/50 !bg-red-50/50 dark:!bg-red-950/20" : ""}
            valueColor={overdueCount > 0 ? "text-red-600 dark:text-red-400" : undefined}
          />
        </div>
      )}

      {/* ═══ MAIN CONTENT — 2 columns ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* ── LEFT COLUMN (3/5) ── */}
        <div className="lg:col-span-3 space-y-3">

          {/* Active Projects */}
          {isEnabled("activeProjects") && activeProjects.length > 0 && (
            <Card>
              <CardHeader
                icon={<Hash className="w-4 h-4 text-violet-500" />}
                title="Projects"
                link={{ href: "/projects", label: "All" }}
              />
              <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {activeProjects.map(p => (
                  <Link
                    key={p.id}
                    href={"/projects/" + p.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0">{p.done}/{p.total}</span>
                    <div className="w-14 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className={cn("h-full rounded-full", p.pct === 100 ? "bg-green-500" : "bg-violet-500")}
                        style={{ width: p.pct + "%" }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Email Intelligence */}
          {isEnabled("emailIntelligence") && (
            <EmailIntelligenceWidget />
          )}
        </div>

        {/* ── RIGHT COLUMN (2/5) ── */}
        <div className="lg:col-span-2 space-y-3">

          {/* Upcoming Deadlines */}
          {isEnabled("upcoming") && (
            <Card>
              <CardHeader
                icon={<Calendar className="w-4 h-4 text-violet-500" />}
                title="Upcoming"
                link={{ href: "/upcoming", label: "View" }}
              />
              <div className="px-3 py-2 space-y-1.5">
                <DeadlineRow
                  href="/today"
                  color={todayCount > 0 ? "bg-red-500" : "bg-gray-300"}
                  label="Today"
                  count={todayCount}
                  bold={todayCount > 0}
                />
                <DeadlineRow
                  href="/upcoming"
                  color="bg-amber-400"
                  label="Tomorrow"
                  count={tomorrowCount}
                />
                <DeadlineRow
                  href="/upcoming"
                  color="bg-violet-400"
                  label="This week"
                  count={thisWeekCount}
                />
              </div>
            </Card>
          )}

          {/* Active Sprint */}
          {isEnabled("activeSprint") && activeSprint && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800/50 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-800/50">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex-1">Sprint</span>
                <Link href="/sprints" className="text-[10px] text-amber-600 hover:text-amber-800 dark:text-amber-400">View →</Link>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-xs truncate">{activeSprint.name}</p>
                    {sprintProject && (
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sprintProject.color }} />
                        <span className="truncate">{sprintProject.name}</span>
                      </p>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-bold flex-shrink-0",
                    sprintDaysLeft <= 2 ? "text-red-500" : sprintDaysLeft <= 5 ? "text-amber-500" : "text-gray-600 dark:text-gray-400"
                  )}>
                    {sprintDaysLeft}d
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-1">
                  <span>{sprintDone}/{sprintTotalCount} tasks</span>
                  <span className="ml-auto font-semibold text-gray-700 dark:text-gray-300">{sprintPct}%</span>
                </div>
                <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", sprintPct === 100 ? "bg-green-500" : "bg-amber-500")}
                    style={{ width: sprintPct + "%" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Weekly Goals */}
          {isEnabled("weeklyGoals") && (
            <WeeklyGoals />
          )}
        </div>
      </div>

      {/* ═══ PANELS ═══ */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onComplete={handleComplete}
        />
      )}

      <DashboardCustomize
        open={showCustomize}
        onClose={() => setShowCustomize(false)}
        widgets={widgets}
        onToggle={toggleWidget}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Shared sub-components
   ═══════════════════════════════════════════════════════════════ */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden",
      className
    )}>
      {children}
    </div>
  );
}

function CardHeader({
  icon, title, gradient, action, link,
}: {
  icon: React.ReactNode;
  title: string;
  gradient?: boolean;
  action?: React.ReactNode;
  link?: { href: string; label: string };
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800",
      gradient && "bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/50 dark:to-indigo-950/50"
    )}>
      {icon}
      <span className={cn(
        "text-xs font-semibold flex-1",
        gradient ? "text-violet-700 dark:text-violet-300" : "text-gray-700 dark:text-gray-300"
      )}>
        {title}
      </span>
      {action}
      {link && (
        <Link href={link.href} className="text-[10px] text-violet-500 hover:text-violet-700 transition-colors">
          {link.label} →
        </Link>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, detail, progress, progressColor, className, valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  progress?: number;
  progressColor?: string;
  className?: string;
  valueColor?: string;
}) {
  return (
    <div className={cn(
      "bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-2.5",
      className
    )}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-lg font-bold text-gray-900 dark:text-white leading-none", valueColor)}>{value}</span>
        <span className="text-[10px] text-gray-400">{detail}</span>
      </div>
      {progress !== undefined && (
        <div className="mt-1.5 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", progressColor)} style={{ width: progress + "%" }} />
        </div>
      )}
    </div>
  );
}

function DeadlineRow({
  href, color, label, count, bold,
}: {
  href: string;
  color: string;
  label: string;
  count: number;
  bold?: boolean;
}) {
  return (
    <Link href={href} className="flex items-center gap-2 group py-0.5">
      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", color)} />
      <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-violet-600 transition-colors flex-1">{label}</span>
      <span className={cn(
        "text-xs tabular-nums",
        bold ? "font-bold text-red-500" : "font-semibold text-gray-700 dark:text-gray-300"
      )}>{count}</span>
    </Link>
  );
}
