"use client";
import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, CheckCircle2, AlertTriangle, Flame, Mail, TrendingUp,
  ChevronLeft, ChevronRight, Sparkles, Copy, Loader2, ArrowRight, Trash2, Calendar, Download,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { exportWeeklyReviewToMarkdown } from "@/lib/export";
import { useTaskStore } from "@/store/task-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WeeklyGoals } from "@/components/features/weekly-goals";

interface WeekStats {
  completed: number;
  overdue: number;
  focusMinutes: number;
  emailsResponded: number;
  completionRate: number;
  byDay: { day: string; completedCount: number; focusMinutes: number }[];
  byProject: { name: string; color: string; count: number }[];
  overdueTasks: { id: string; title: string; dueDate: string; projectName?: string }[];
  weekStart: string;
  weekEnd: string;
}

function getWeekString(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

function formatHM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function WeeklyReviewPage() {
  const { updateTask, removeTask } = useTaskStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<{ summary: string; slackFormat: string; emailFormat: string } | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState(true);

  const weekStr = getWeekString(weekOffset);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/weekly-stats?week=${weekStr}`);
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [weekStr]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const generateSummary = async () => {
    if (!stats) return;
    setLoadingAI(true);
    try {
      const res = await apiFetch("/api/ai/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStats: stats }),
      });
      if (res.ok) setAiSummary(await res.json());
    } catch { toast.error("Failed to generate summary"); }
    finally { setLoadingAI(false); }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied as ${label}!`);
  };

  const handleDeferNextWeek = async (id: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    updateTask(id, { dueDate: d.toISOString() });
    await apiFetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: d.toISOString() }),
    });
    toast.info("Deferred to next week");
    loadStats();
  };

  const rateColor = (rate: number) => rate >= 70 ? "text-green-600" : rate >= 40 ? "text-amber-600" : "text-red-600";
  const maxFocus = stats ? Math.max(...stats.byDay.map(d => d.focusMinutes), 1) : 1;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-violet-500" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Weekly Review</h1>
            {stats && (
              <p className="text-sm text-gray-400">
                {new Date(stats.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(stats.weekEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(o => o - 1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 hover:bg-violet-200 transition-colors">
              This week
            </button>
          )}
          <button onClick={() => setWeekOffset(o => o + 1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          {stats && (
            <button
              onClick={() => exportWeeklyReviewToMarkdown(stats, aiSummary?.summary)}
              className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/50 transition-colors"
              title="Export as Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* FEAT-07: Weekly Goals */}
      <div className="mb-6">
        <WeeklyGoals />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { icon: CheckCircle2, label: "Completed", value: stats.completed, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
              { icon: AlertTriangle, label: "Overdue", value: stats.overdue, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
              { icon: Flame, label: "Focus Time", value: formatHM(stats.focusMinutes), color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
              { icon: Mail, label: "Emails", value: stats.emailsResponded, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
              { icon: TrendingUp, label: "Rate", value: `${stats.completionRate}%`, color: rateColor(stats.completionRate), bg: "bg-gray-50 dark:bg-gray-800" },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className={cn("rounded-xl p-4 border border-gray-100 dark:border-gray-800", bg)}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn("w-4 h-4", color)} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                </div>
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-6">
              {/* AI Summary */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-violet-500" /> AI Weekly Summary
                </h3>
                {aiSummary ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">{aiSummary.summary}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleCopy(aiSummary.slackFormat, "Slack")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 hover:bg-purple-200 transition-colors">
                        <Copy className="w-3 h-3" /> Copy as Slack
                      </button>
                      <button onClick={() => handleCopy(aiSummary.emailFormat, "email")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 transition-colors">
                        <Copy className="w-3 h-3" /> Copy as email
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={generateSummary} disabled={loadingAI} className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Summary
                  </button>
                )}
              </div>

              {/* Focus patterns */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Focus Patterns</h3>
                <div className="flex items-end gap-2 h-32">
                  {stats.byDay.map(d => (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-violet-500 dark:bg-violet-600 rounded-t-sm transition-all"
                        style={{ height: `${Math.max((d.focusMinutes / maxFocus) * 100, 2)}%` }}
                      />
                      <span className="text-[10px] text-gray-500">{d.day}</span>
                      <span className="text-[10px] text-gray-400">{d.focusMinutes}m</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Completed by project */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Completed This Week</h3>
                {stats.byProject.length > 0 ? (
                  <div className="space-y-2">
                    {stats.byProject.map(p => (
                      <div key={p.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{p.name}</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{p.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No completed tasks this week.</p>
                )}
              </div>

              {/* Carried over */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Carried Over ({stats.overdueTasks.length})
                </h3>
                {stats.overdueTasks.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {stats.overdueTasks.map(t => (
                      <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{t.title}</span>
                        <button onClick={() => handleDeferNextWeek(t.id)} title="Next week" className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 transition-colors">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">✨ All caught up! No overdue tasks.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-400 py-20">No data available for this week.</p>
      )}
    </div>
  );
}
