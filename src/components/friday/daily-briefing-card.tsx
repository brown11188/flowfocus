"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, RefreshCw, ChevronDown, ChevronUp,
  Calendar, Mail, Zap, AlertTriangle, CheckCircle2,
  Clock, Target, TrendingUp, ExternalLink, MessageSquare,
  Loader2, Check, SkipForward, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { DailyBriefing, DailyBriefingTask } from "@/types/daily-briefing";

const PRIORITY_LABELS: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: "P1", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-800" },
  2: { label: "P2", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800" },
  3: { label: "P3", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800" },
  4: { label: "P4", color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-900", border: "border-gray-200 dark:border-gray-700" },
};

interface Props {
  onAskFriday?: (prompt: string) => void;
  onTaskComplete?: (taskId: string) => void;
  onTaskReschedule?: (taskId: string) => void;
}

// ─── Section collapse wrapper ─────────────────────────────────────────────────────
function Section({
  icon,
  title,
  badge,
  badgeColor,
  children,
  defaultOpen = true,
  accentClass,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentClass?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-xl border overflow-hidden", accentClass ?? "border-gray-100 dark:border-gray-800")}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors text-left"
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-1">{title}</span>
        {badge && (
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", badgeColor ?? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300")}>
            {badge}
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 dark:border-gray-800">{children}</div>}
    </div>
  );
}

// ─── Priority Task Row ─────────────────────────────────────────────────────────────
function PriorityTaskRow({
  task,
  onComplete,
  onReschedule,
  onAsk,
}: {
  task: DailyBriefingTask;
  onComplete: (id: string) => void;
  onReschedule: (id: string) => void;
  onAsk: (prompt: string) => void;
}) {
  const pc = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS[4];
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <div className={cn("flex items-start gap-3 px-4 py-3 border-b last:border-b-0 border-gray-50 dark:border-gray-800/50 group", pc.bg)}>
      <div className={cn("flex-shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border", pc.color, pc.border)}>
        {pc.label}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-violet-400" />
            {task.reason}
          </span>
          {task.projectName && (
            <span className="text-gray-300">·</span>
          )}
          {task.projectName && (
            <span className="text-gray-400">{task.projectName}</span>
          )}
          {task.estimatedHours && (
            <>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.estimatedHours}h</span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => { setDone(true); onComplete(task.taskId); }}
          className="p-1.5 rounded-lg bg-green-100 dark:bg-green-950/50 text-green-600 hover:bg-green-200 dark:hover:bg-green-900 transition-colors"
          title="Mark complete"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onReschedule(task.taskId)}
          className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Reschedule to tomorrow"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onAsk(`Tell me more about the task "${task.title}"`)}
          className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-950/50 text-violet-500 hover:bg-violet-200 dark:hover:bg-violet-900 transition-colors"
          title="Ask Friday about this task"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Build a compact one-line summary from briefing data ─────────────────────
function buildSummaryLine(briefing: DailyBriefing): string {
  const parts: string[] = [];

  // Top priority tasks (max 2)
  const topTasks = briefing.priorityTasks.slice(0, 2);
  if (topTasks.length > 0) {
    const titles = topTasks.map(t => t.title.length > 32 ? t.title.slice(0, 32) + "…" : t.title);
    parts.push(`Focus on: ${titles.join(" · ")}`);
  }

  // Overdue nudge
  const overdue = briefing.overdueAlert?.count ?? 0;
  if (overdue > 0) {
    parts.push(`${overdue} overdue task${overdue > 1 ? "s" : ""} need attention`);
  }

  // Next calendar event (if any)
  const nextEvent = briefing.calendarSection?.events?.find(e => !e.isNow) ?? briefing.calendarSection?.events?.[0];
  if (nextEvent) {
    const subj = nextEvent.subject.length > 28 ? nextEvent.subject.slice(0, 28) + "…" : nextEvent.subject;
    parts.push(`Next: ${subj} @ ${nextEvent.startTime}`);
  }

  // Fallback to coaching message trimmed
  if (parts.length === 0 && briefing.coachingMessage) {
    const msg = briefing.coachingMessage;
    return msg.length > 80 ? msg.slice(0, 80) + "…" : msg;
  }

  return parts.join("  ·  ");
}

// ─── Compact summary bar ──────────────────────────────────────────────────────
function BriefingBar({
  briefing,
  loading,
  onExpand,
  onRefresh,
  refreshing,
}: {
  briefing: DailyBriefing | null;
  loading: boolean;
  onExpand: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-violet-100 dark:border-violet-900/50 animate-pulse">
        <div className="w-8 h-8 rounded-lg bg-violet-200 dark:bg-violet-800 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-violet-100 dark:bg-violet-900 rounded w-36" />
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-64" />
        </div>
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-20" />
      </div>
    );
  }

  const overdueCount = briefing?.overdueAlert?.count ?? 0;
  const eventsCount = briefing?.calendarSection?.events?.length ?? 0;
  const tasksCount = briefing?.priorityTasks?.length ?? 0;
  const summaryLine = briefing ? buildSummaryLine(briefing) : null;
  const generatedTime = briefing
    ? new Date(briefing.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <button
      onClick={onExpand}
      className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-violet-100 dark:border-violet-900/50 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/40 dark:hover:bg-violet-950/20 transition-all group text-left"
    >
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Sparkles className="w-4 h-4 text-white" />
      </div>

      {/* Title + summary */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">Daily Briefing</span>
          {generatedTime && (
            <span className="text-[10px] text-gray-400 font-normal">{generatedTime}</span>
          )}
          {briefing?.metadata?.isFromCache && (() => {
            const cacheAge = briefing?.generatedAt ? (Date.now() - new Date(briefing.generatedAt).getTime()) / 60000 : 0;
            const isStale = cacheAge > 30;
            const isVeryStale = cacheAge > 120;
            return (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  isVeryStale
                    ? "bg-red-100 dark:bg-red-900/50 text-red-500"
                    : isStale
                      ? "bg-amber-100 dark:bg-amber-900/50 text-amber-600"
                      : "bg-violet-100 dark:bg-violet-900/50 text-violet-500"
                )}
                title={isVeryStale ? "Data may be very outdated — click refresh" : isStale ? "Data may be outdated — click refresh to update" : "Showing cached data"}
              >
                {isVeryStale ? "stale" : isStale ? "outdated" : "cached"}
              </span>
            );
          })()}
        </div>
        {summaryLine ? (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate leading-snug">
            {summaryLine}
          </p>
        ) : (
          <p className="text-[12px] text-gray-400 italic">Click to view your daily briefing</p>
        )}
      </div>

      {/* Pill badges */}
      <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3 h-3" />{overdueCount}
          </span>
        )}
        {eventsCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Calendar className="w-3 h-3" />{eventsCount}
          </span>
        )}
        {tasksCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
            <Target className="w-3 h-3" />{tasksCount}
          </span>
        )}
      </div>

      {/* Refresh + expand arrow */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onRefresh(); } }}
          className={cn(
            "p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors",
            refreshing && "opacity-50 pointer-events-none"
          )}
          title="Refresh briefing"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-violet-500 transition-colors" />
      </div>
    </button>
  );
}

// ─── Expanded full modal/drawer ───────────────────────────────────────────────
function BriefingExpanded({
  briefing,
  loading,
  error,
  refreshing,
  onClose,
  onRefresh,
  onTaskComplete,
  onTaskReschedule,
  onAskFriday,
}: {
  briefing: DailyBriefing | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onTaskComplete: (id: string) => void;
  onTaskReschedule: (id: string) => void;
  onAskFriday: (prompt: string) => void;
}) {
  const generatedTime = briefing
    ? new Date(briefing.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-black/20 dark:bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mt-2"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-100 dark:border-violet-900/50 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles className="w-[18px] h-[18px] text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-violet-900 dark:text-violet-100">Friday Daily Briefing</h2>
              {briefing?.metadata?.isFromCache && (
                <span className="text-[10px] bg-violet-100 dark:bg-violet-900/50 text-violet-500 px-1.5 py-0.5 rounded-full">
                  cached
                </span>
              )}
            </div>
            {generatedTime && (
              <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">
                Generated at {generatedTime} · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50"
              title="Refresh briefing"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Preparing your briefing…</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Briefing unavailable</p>
              </div>
              <p className="text-xs text-red-500 mb-3">{error}</p>
              <button onClick={onRefresh} className="text-xs text-red-600 hover:text-red-800 underline">
                Try again
              </button>
            </div>
          )}

          {briefing && !loading && (
            <>
              {/* Greeting */}
              <div className="px-5 py-3 bg-violet-50/60 dark:bg-violet-950/20 border-b border-violet-100 dark:border-violet-900/50">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{briefing.greeting}</p>
              </div>

              {/* Sections */}
              <div className="p-3 space-y-2">
                {/* Overdue Alert */}
                {briefing.overdueAlert && (
                  <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                        {briefing.overdueAlert.count} overdue task{briefing.overdueAlert.count !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-red-500 mt-0.5">{briefing.overdueAlert.message}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {briefing.overdueAlert.topItems.map(item => (
                          <span key={item.taskId} className="text-[11px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                            {item.title.slice(0, 30)}{item.title.length > 30 ? "…" : ""}
                            <span className="opacity-70 ml-1">·{item.daysOverdue}d overdue</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Calendar Section */}
                {briefing.calendarSection && (
                  <Section
                    icon={<Calendar className="w-4 h-4 text-blue-500" />}
                    title="Today's Calendar"
                    badge={String(briefing.calendarSection.events.length)}
                    badgeColor="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                    accentClass="border-blue-100 dark:border-blue-900/50"
                  >
                    <div className="bg-white dark:bg-gray-900 divide-y divide-gray-50 dark:divide-gray-800/50">
                      {briefing.calendarSection.events.map(evt => (
                        <div key={evt.id} className={cn(
                          "flex items-center gap-3 px-4 py-2.5 group",
                          evt.isNow && "bg-blue-50 dark:bg-blue-950/20"
                        )}>
                          <div className="flex-shrink-0 text-center">
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{evt.startTime}</p>
                            <p className="text-[10px] text-gray-400">{evt.endTime}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{evt.subject}</p>
                            {evt.location && (
                              <p className="text-[11px] text-gray-400 truncate">{evt.location}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {evt.isNow && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-semibold animate-pulse">
                                LIVE
                              </span>
                            )}
                            {evt.webLink && (
                              <a
                                href={evt.webLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-lg text-gray-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Priority Tasks */}
                {briefing.priorityTasks.length > 0 && (
                  <Section
                    icon={<Target className="w-4 h-4 text-violet-500" />}
                    title="Priority Tasks"
                    badge={String(briefing.priorityTasks.length)}
                  >
                    <div className="bg-white dark:bg-gray-900">
                      {briefing.priorityTasks.map(task => (
                        <PriorityTaskRow
                          key={task.taskId}
                          task={task}
                          onComplete={onTaskComplete}
                          onReschedule={onTaskReschedule}
                          onAsk={onAskFriday}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                {/* Email Actions */}
                {briefing.emailActions && briefing.emailActions.urgentCount > 0 && (
                  <Section
                    icon={<Mail className="w-4 h-4 text-amber-500" />}
                    title="Email Actions"
                    badge={String(briefing.emailActions.urgentCount)}
                    badgeColor="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                    accentClass="border-amber-100 dark:border-amber-900/50"
                    defaultOpen={false}
                  >
                    <div className="bg-white dark:bg-gray-900 divide-y divide-gray-50 dark:divide-gray-800/50">
                      {briefing.emailActions.items.map(email => (
                        <div key={email.id} className="flex items-start gap-3 px-4 py-2.5 group">
                          <div className={cn(
                            "flex-shrink-0 mt-0.5 w-2 h-2 rounded-full mt-2",
                            email.urgency === "high" ? "bg-red-500" : "bg-amber-400"
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{email.subject}</p>
                            <p className="text-[11px] text-gray-400">
                              {email.fromName}
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600">
                                {email.category === "missed" ? "Missed reply" : "Needs reply"}
                              </span>
                            </p>
                          </div>
                          {email.webLink && (
                            <a
                              href={email.webLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-gray-300 hover:text-amber-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                      <div className="px-4 py-2.5">
                        <button
                          onClick={() => onAskFriday("What emails need my attention today?")}
                          className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                        >
                          Ask Friday about your emails →
                        </button>
                      </div>
                    </div>
                  </Section>
                )}

                {/* Sprint Pulse */}
                {briefing.sprintStatus && (
                  <Section
                    icon={<Zap className="w-4 h-4 text-amber-500" />}
                    title="Sprint Pulse"
                    badge={`${briefing.sprintStatus.progressPct}%`}
                    badgeColor="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                    accentClass="border-amber-100 dark:border-amber-900/50"
                    defaultOpen={false}
                  >
                    <div className="bg-white dark:bg-gray-900 px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{briefing.sprintStatus.sprintName}</p>
                          {briefing.sprintStatus.goal && (
                            <p className="text-xs text-gray-400 italic mt-0.5">&quot;{briefing.sprintStatus.goal}&quot;</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn(
                            "text-sm font-bold",
                            briefing.sprintStatus.daysLeft <= 2 ? "text-red-500" :
                            briefing.sprintStatus.daysLeft <= 5 ? "text-amber-500" : "text-gray-700 dark:text-gray-300"
                          )}>
                            {briefing.sprintStatus.daysLeft}d left
                          </p>
                          <p className="text-xs text-gray-400">
                            {briefing.sprintStatus.doneTasks}/{briefing.sprintStatus.totalTasks} tasks
                          </p>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-2">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            briefing.sprintStatus.isOnTrack ? "bg-green-500" : "bg-amber-500"
                          )}
                          style={{ width: briefing.sprintStatus.progressPct + "%" }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">{briefing.sprintStatus.message}</p>
                    </div>
                  </Section>
                )}

                {/* Day Plan */}
                {briefing.dayPlan && briefing.dayPlan.length > 0 && (
                  <Section
                    icon={<Clock className="w-4 h-4 text-teal-500" />}
                    title="Suggested Day Plan"
                    badgeColor="bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300"
                    accentClass="border-teal-100 dark:border-teal-900/50"
                    defaultOpen={false}
                  >
                    <div className="bg-white dark:bg-gray-900 divide-y divide-gray-50 dark:divide-gray-800/50">
                      {briefing.dayPlan.map((slot, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="flex-shrink-0 w-24">
                            <p className="text-xs font-mono text-teal-600 dark:text-teal-400">{slot.timeSlot}</p>
                          </div>
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0",
                              slot.type === "meeting" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600" :
                              slot.type === "task" ? "bg-violet-100 dark:bg-violet-900/40 text-violet-600" :
                              slot.type === "break" ? "bg-green-100 dark:bg-green-900/40 text-green-600" :
                              "bg-gray-100 dark:bg-gray-800 text-gray-500"
                            )}>
                              {slot.type}
                            </span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{slot.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </div>

              {/* Coaching + CTA */}
              <div className="px-5 py-4 border-t border-violet-100 dark:border-violet-900/50 bg-violet-50/60 dark:bg-gray-900/40">
                <div className="flex items-start gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed italic">{briefing.coachingMessage}</p>
                </div>
                <button
                  onClick={() => {
                    onAskFriday("Based on my daily briefing, what should I focus on right now?");
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-semibold transition-all shadow-sm hover:shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ask Friday a follow-up question
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────────────

export function DailyBriefingCard({ onAskFriday, onTaskComplete, onTaskReschedule }: Props) {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const url = forceRefresh ? "/api/friday/daily-briefing?refresh=1" : "/api/friday/daily-briefing";
      const res = await apiFetch(url);
      if (res.status === 429) {
        toast.error("Too many refreshes — please wait a moment");
        return;
      }
      if (!res.ok) throw new Error("Failed to load briefing");
      const data = await res.json() as { briefing: DailyBriefing };
      setBriefing(data.briefing);
      if (forceRefresh) toast.success("Briefing refreshed!");
    } catch {
      setError("Could not load your daily briefing. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (taskId: string) => {
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, completedAt: new Date().toISOString() }),
      });
      onTaskComplete?.(taskId);
      toast.success("Task completed! ✅");
      window.dispatchEvent(new CustomEvent("friday:task-created"));
    } catch {
      toast.error("Failed to complete task");
    }
  };

  const handleReschedule = async (taskId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: tomorrow.toISOString() }),
      });
      onTaskReschedule?.(taskId);
      toast.success("Task moved to tomorrow");
    } catch {
      toast.error("Failed to reschedule task");
    }
  };

  const handleAskFriday = (prompt: string) => {
    onAskFriday?.(prompt);
    window.dispatchEvent(new CustomEvent("friday:open", { detail: { prompt } }));
  };

  return (
    <>
      {/* Compact bar — always visible */}
      <BriefingBar
        briefing={briefing}
        loading={loading}
        onExpand={() => setExpanded(true)}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      {/* Expanded overlay panel */}
      {expanded && (
        <BriefingExpanded
          briefing={briefing}
          loading={loading}
          error={error}
          refreshing={refreshing}
          onClose={() => setExpanded(false)}
          onRefresh={() => load(true)}
          onTaskComplete={handleComplete}
          onTaskReschedule={handleReschedule}
          onAskFriday={(prompt) => {
            handleAskFriday(prompt);
            setExpanded(false);
          }}
        />
      )}
    </>
  );
}
