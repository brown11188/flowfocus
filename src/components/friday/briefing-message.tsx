"use client";
import {
  Sparkles, Calendar, Mail, Zap, AlertTriangle,
  Target, Clock, TrendingUp, ExternalLink, Check, SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyBriefing } from "@/types/daily-briefing";

const PRIORITY_LABELS: Record<number, string> = { 1: "P1", 2: "P2", 3: "P3", 4: "P4" };
const PRIORITY_COLORS: Record<number, string> = {
  1: "text-red-600 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
  2: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800",
  3: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
  4: "text-gray-500 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700",
};

interface BriefingMessageProps {
  briefing: DailyBriefing;
  onComplete?: (taskId: string) => void;
  onReschedule?: (taskId: string) => void;
  onAsk?: (prompt: string) => void;
}

export function BriefingMessage({ briefing, onComplete, onReschedule, onAsk }: BriefingMessageProps) {
  return (
    <div className="space-y-3 max-w-full">
      {/* Greeting */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-xl border border-violet-100 dark:border-violet-900/40 px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0" />
          <span className="text-xs font-bold text-violet-700 dark:text-violet-300">Daily Briefing</span>
          <span className="text-[10px] text-violet-400 ml-auto">
            {new Date(briefing.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{briefing.greeting}</p>
      </div>

      {/* Overdue alert */}
      {briefing.overdueAlert && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">
              {briefing.overdueAlert.count} overdue task{briefing.overdueAlert.count !== 1 ? "s" : ""}
            </p>
            <p className="text-[11px] text-red-500 mt-0.5">{briefing.overdueAlert.message}</p>
          </div>
        </div>
      )}

      {/* Calendar */}
      {briefing.calendarSection && (
        <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/20">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{briefing.calendarSection.summary}</span>
          </div>
          <div className="bg-white dark:bg-gray-900 divide-y divide-gray-50 dark:divide-gray-800">
            {briefing.calendarSection.events.slice(0, 3).map(evt => (
              <div key={evt.id} className={cn("flex items-center gap-2 px-3 py-2", evt.isNow && "bg-blue-50 dark:bg-blue-950/20")}>
                <div className="flex-shrink-0 w-12 text-center">
                  <p className="text-[11px] font-bold text-blue-600">{evt.startTime}</p>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{evt.subject}</p>
                {evt.isNow && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">NOW</span>}
                {evt.webLink && (
                  <a href={evt.webLink} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-400 flex-shrink-0">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority tasks */}
      {briefing.priorityTasks.length > 0 && (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50">
            <Target className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Top Priorities</span>
          </div>
          <div className="bg-white dark:bg-gray-900 divide-y divide-gray-50 dark:divide-gray-800">
            {briefing.priorityTasks.map(task => (
              <div key={task.taskId} className="flex items-center gap-2 px-3 py-2.5 group">
                <span className={cn(
                  "flex-shrink-0 text-[10px] font-bold px-1 py-0.5 rounded border",
                  PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[4]
                )}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
                <p className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{task.title}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onComplete && (
                    <button
                      onClick={() => onComplete(task.taskId)}
                      className="p-1 rounded bg-green-100 dark:bg-green-950/50 text-green-600 hover:bg-green-200 transition-colors"
                      title="Complete"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                  {onReschedule && (
                    <button
                      onClick={() => onReschedule(task.taskId)}
                      className="p-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 transition-colors"
                      title="Tomorrow"
                    >
                      <SkipForward className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sprint */}
      {briefing.sprintStatus && (
        <div className="rounded-xl border border-amber-100 dark:border-amber-900/50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Sprint: {briefing.sprintStatus.sprintName}</span>
            <span className="ml-auto text-xs font-bold text-amber-600">{briefing.sprintStatus.progressPct}%</span>
          </div>
          <div className="bg-white dark:bg-gray-900 px-3 py-2">
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mb-1.5 overflow-hidden">
              <div
                className={cn("h-full rounded-full", briefing.sprintStatus.isOnTrack ? "bg-green-500" : "bg-amber-500")}
                style={{ width: briefing.sprintStatus.progressPct + "%" }}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              {briefing.sprintStatus.doneTasks}/{briefing.sprintStatus.totalTasks} tasks · {briefing.sprintStatus.daysLeft}d remaining
            </p>
          </div>
        </div>
      )}

      {/* Coaching */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-gradient-to-r from-violet-50 to-transparent dark:from-violet-950/20 rounded-xl">
        <TrendingUp className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-gray-500 dark:text-gray-400 italic leading-relaxed">{briefing.coachingMessage}</p>
      </div>

      {/* CTA */}
      {onAsk && (
        <button
          onClick={() => onAsk("Based on my daily briefing, what should I focus on first?")}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 text-xs font-medium hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          Ask Friday a follow-up question
        </button>
      )}
    </div>
  );
}
