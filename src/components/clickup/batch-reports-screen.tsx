"use client";
import { useState, useCallback, useRef } from "react";
import {
  Sparkles, BarChart3, Loader2, CheckCircle2, AlertCircle,
  ChevronDown, ChevronRight, RefreshCw, Building2, ArrowLeft,
  TrendingUp, TrendingDown, Clock, Zap, Users, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { MarkdownBody } from "./markdown-body";
import type {
  WorkspaceConnection, SyncReport,
  BatchReportStatus, WorkspaceReportProgress,
  BatchReportSummary, BatchSseEvent,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────────
// BatchReportsScreen — Multi-workspace AI report generator
// ───────────────────────────────────────────────────────────────────────────────

export function BatchReportsScreen({
  selectedWorkspaces,
  allWorkspaces,
  includeClosed,
  onBack,
}: {
  selectedWorkspaces: WorkspaceConnection[];
  allWorkspaces: WorkspaceConnection[];
  includeClosed: boolean;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<BatchReportStatus>("idle");
  const [progress, setProgress] = useState<WorkspaceReportProgress[]>(() =>
    selectedWorkspaces.map((ws) => ({
      workspaceId: ws.id,
      workspaceName: ws.teamName,
      status: "pending",
    }))
  );
  const [summary, setSummary] = useState<BatchReportSummary | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<string, SyncReport[]>>(() => {
    // Pre-populate with existing reports from workspace objects
    const map: Record<string, SyncReport[]> = {};
    allWorkspaces.forEach((ws) => {
      if (ws.reports?.length) {
        map[ws.id] = ws.reports.map((r) => ({
          id: r.id,
          workspaceName: r.workspaceName,
          analysis: r.analysis,
          taskCount: r.taskCount,
          overdueCount: r.overdueCount,
          stats: {
            total: r.taskCount,
            byStatus: {},
            byPriority: {},
            overdue: r.overdueCount,
            unassigned: 0,
            completedThisWeek: 0,
          },
          createdAt: r.createdAt,
        }));
      }
    });
    return map;
  });

  const abortRef = useRef<AbortController | null>(null);

  // ─── Start batch report generation via SSE ──────────────────────────────
  const startBatchReport = useCallback(async () => {
    if (selectedWorkspaces.length === 0) return;

    // Reset progress
    setProgress(selectedWorkspaces.map((ws) => ({
      workspaceId: ws.id,
      workspaceName: ws.teamName,
      status: "pending",
    })));
    setSummary(null);
    setStatus("running");

    abortRef.current = new AbortController();

    try {
      const res = await apiFetch("/api/clickup/sync/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceConnectionIds: selectedWorkspaces.map((w) => w.id),
          includeClosed,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({ error: "Failed to start" })) as { error?: string };
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as BatchSseEvent;
            handleSseEvent(event);
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("idle");
        return;
      }
      console.error("[BatchReports]", err);
      setStatus("error");
    }
  }, [selectedWorkspaces, includeClosed]);

  const handleSseEvent = (event: BatchSseEvent) => {
    switch (event.type) {
      case "start":
        setProgress((prev) =>
          prev.map((p) =>
            p.workspaceId === event.workspaceId
              ? { ...p, status: "fetching" }
              : p
          )
        );
        break;

      case "done":
        setProgress((prev) =>
          prev.map((p) =>
            p.workspaceId === event.workspaceId
              ? { ...p, status: "done", report: event.report }
              : p
          )
        );
        // Update history map
        setHistoryMap((prev) => ({
          ...prev,
          [event.workspaceId]: [
            event.report,
            ...(prev[event.workspaceId] ?? []),
          ],
        }));
        break;

      case "error":
        setProgress((prev) =>
          prev.map((p) =>
            p.workspaceId === event.workspaceId
              ? { ...p, status: "error", errorMessage: event.message }
              : p
          )
        );
        break;

      case "complete":
        setSummary(event.summary);
        setStatus("done");
        break;
    }
  };

  const doneCount = progress.filter((p) => p.status === "done").length;
  const errorCount = progress.filter((p) => p.status === "error").length;
  const isRunning = status === "running";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ─ Header ─ */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            AI Workspace Reports
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {selectedWorkspaces.length} workspace{selectedWorkspaces.length !== 1 ? "s" : ""} selected
          </p>
        </div>
      </div>

      {/* ─ Hero Card ─ */}
      <HeroCard
        workspaces={selectedWorkspaces}
        status={status}
        doneCount={doneCount}
        errorCount={errorCount}
        summary={summary}
        onGenerate={startBatchReport}
        onRegenerate={() => { setSummary(null); startBatchReport(); }}
      />

      {/* ─ Progress Grid ─ */}
      {(status !== "idle" || doneCount > 0) && (
        <ProgressGrid
          progress={progress}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId((prev) => prev === id ? null : id)}
        />
      )}

      {/* ─ Cross-Workspace Summary ─ */}
      {status === "done" && summary && doneCount > 0 && (
        <CrossWorkspaceSummary
          summary={summary}
          progress={progress}
        />
      )}

      {/* ─ History for all workspaces ─ */}
      <AllWorkspacesHistory
        allWorkspaces={allWorkspaces}
        historyMap={historyMap}
        selectedIds={new Set(selectedWorkspaces.map((w) => w.id))}
        expandedId={expandedId}
        onToggleExpand={(id) => setExpandedId((prev) => prev === id ? null : id)}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// HeroCard — the main CTA
// ───────────────────────────────────────────────────────────────────────────────

function HeroCard({
  workspaces, status, doneCount, errorCount, summary, onGenerate, onRegenerate,
}: {
  workspaces: WorkspaceConnection[];
  status: BatchReportStatus;
  doneCount: number;
  errorCount: number;
  summary: BatchReportSummary | null;
  onGenerate: () => void;
  onRegenerate: () => void;
}) {
  const isRunning = status === "running";
  const isDone = status === "done";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-gradient-to-br from-violet-50 via-indigo-50/50 to-purple-50/30 dark:from-violet-950/40 dark:via-indigo-950/20 dark:to-purple-950/10 p-6">
      {/* Decorative blobs */}
      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-violet-200/30 dark:bg-violet-700/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-indigo-200/20 dark:bg-indigo-700/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon + text */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">
              AI-Powered Workspace Analysis
            </h3>
          </div>

          {!isDone && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Analyzes tasks, priorities, overdue items, and workload distribution
              across{" "}
              <strong className="text-gray-900 dark:text-white">
                {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
              </strong>{" "}
              and generates actionable insights.
            </p>
          )}

          {isDone && summary && (
            <div className="flex flex-wrap gap-3">
              <SummaryBadge icon={FileText} label="Reports" value={summary.totalReports} color="violet" />
              <SummaryBadge icon={Building2} label="Total Tasks" value={summary.totalTasks} color="blue" />
              <SummaryBadge icon={TrendingDown} label="Overdue" value={summary.totalOverdue} color="red" />
              {errorCount > 0 && (
                <SummaryBadge icon={AlertCircle} label="Errors" value={errorCount} color="amber" />
              )}
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="flex-shrink-0">
          {!isDone && !isRunning && (
            <button
              onClick={onGenerate}
              className="flex items-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm shadow-violet-300 dark:shadow-violet-900"
            >
              <Zap className="w-4 h-4" />
              Generate {workspaces.length} Report{workspaces.length !== 1 ? "s" : ""}
            </button>
          )}

          {isRunning && (
            <div className="flex flex-col items-center gap-2">
              {/* Animated progress ring */}
              <div className="relative w-14 h-14">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor"
                    className="text-violet-200 dark:text-violet-800" strokeWidth="4" />
                  <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor"
                    className="text-violet-600 transition-all duration-700" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 22}`}
                    strokeDashoffset={`${2 * Math.PI * 22 * (1 - doneCount / workspaces.length)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                    {doneCount}/{workspaces.length}
                  </span>
                </div>
              </div>
              <span className="text-xs text-violet-600 dark:text-violet-400 font-medium animate-pulse">
                Analyzing…
              </span>
            </div>
          )}

          {isDone && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-2 px-4 py-2.5 border border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40 text-violet-700 dark:text-violet-300 rounded-xl text-sm font-semibold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate All
            </button>
          )}
        </div>
      </div>

      {/* Running progress bar */}
      {isRunning && (
        <div className="relative mt-4 h-1.5 rounded-full bg-violet-200 dark:bg-violet-800 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-violet-600 rounded-full transition-all duration-700"
            style={{ width: `${(doneCount / workspaces.length) * 100}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
        </div>
      )}
    </div>
  );
}

function SummaryBadge({
  icon: Icon, label, value, color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: "violet" | "blue" | "red" | "amber" | "green";
}) {
  const classes = {
    violet: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
    blue: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    red: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    amber: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    green: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  };
  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold", classes[color])}>
      <Icon className="w-3.5 h-3.5" />
      <span className="font-bold text-sm">{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// ProgressGrid — real-time status cards per workspace
// ───────────────────────────────────────────────────────────────────────────────

function ProgressGrid({
  progress, expandedId, onToggleExpand,
}: {
  progress: WorkspaceReportProgress[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Workspace Reports
      </h3>
      <div className="space-y-2">
        {progress.map((p) => (
          <WorkspaceProgressCard
            key={p.workspaceId}
            progress={p}
            expanded={expandedId === p.workspaceId}
            onToggle={() => p.status === "done" && onToggleExpand(p.workspaceId)}
          />
        ))}
      </div>
    </div>
  );
}

function WorkspaceProgressCard({
  progress, expanded, onToggle,
}: {
  progress: WorkspaceReportProgress;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { status, workspaceName, report, errorMessage } = progress;
  const initial = workspaceName.charAt(0).toUpperCase();

  const statusConfig = {
    pending: {
      icon: <Clock className="w-4 h-4 text-gray-400" />,
      label: "Waiting",
      badge: "bg-gray-100 dark:bg-gray-800 text-gray-500",
      border: "border-gray-200 dark:border-gray-700",
    },
    fetching: {
      icon: <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />,
      label: "Analyzing…",
      badge: "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300",
      border: "border-violet-300 dark:border-violet-700",
    },
    done: {
      icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
      label: "Done",
      badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
      border: "border-green-200 dark:border-green-800",
    },
    error: {
      icon: <AlertCircle className="w-4 h-4 text-red-400" />,
      label: "Error",
      badge: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300",
      border: "border-red-200 dark:border-red-800",
    },
  } as const;

  const cfg = statusConfig[status];

  return (
    <div className={cn("rounded-xl border overflow-hidden transition-all", cfg.border)}>
      <button
        className={cn(
          "w-full flex items-center gap-3 p-3.5",
          status === "done" ? "hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" : "cursor-default"
        )}
        onClick={onToggle}
        disabled={status !== "done"}
      >
        {/* Avatar */}
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0",
            status === "fetching" ? "bg-violet-500 animate-pulse" : "bg-[#7B68EE]"
          )}
        >
          {initial}
        </div>

        {/* Name + status */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{workspaceName}</p>
          {status === "done" && report && (
            <p className="text-xs text-gray-400">
              {report.taskCount} tasks · {report.overdueCount} overdue
            </p>
          )}
          {status === "error" && (
            <p className="text-xs text-red-400 truncate">{errorMessage}</p>
          )}
          {status === "fetching" && (
            <p className="text-xs text-violet-500">Fetching data &amp; generating insights…</p>
          )}
          {status === "pending" && (
            <p className="text-xs text-gray-400">Waiting in queue…</p>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {status === "done" && report && (
            <div className="flex items-center gap-1">
              {report.overdueCount > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium">
                  <TrendingDown className="w-3 h-3" />{report.overdueCount}
                </span>
              )}
              <span className="flex items-center gap-0.5 text-xs text-gray-400">
                <Users className="w-3 h-3" />{report.taskCount}
              </span>
            </div>
          )}
          {cfg.icon}
          {status === "done" && (
            expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded report */}
      {expanded && report && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {/* Stats row */}
          <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800">
            <StatCell label="Tasks" value={report.stats.total} />
            <StatCell label="Overdue" value={report.stats.overdue} highlight={report.stats.overdue > 0} />
            <StatCell label="Unassigned" value={report.stats.unassigned} />
            <StatCell label="Done/Week" value={report.stats.completedThisWeek} positive />
          </div>
          {/* Priority breakdown */}
          {Object.keys(report.stats.byPriority).length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5">
              {Object.entries(report.stats.byPriority).map(([priority, count]) => (
                <PriorityChip key={priority} priority={priority} count={count as number} />
              ))}
            </div>
          )}
          {/* AI Analysis */}
          <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
            <MarkdownBody content={report.analysis} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({
  label, value, highlight, positive,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="py-3 px-4 text-center">
      <p className={cn(
        "text-lg font-bold",
        highlight && value > 0 ? "text-red-500" : positive && value > 0 ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-white"
      )}>{value}</p>
      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{label}</p>
    </div>
  );
}

function PriorityChip({ priority, count }: { priority: string; count: number }) {
  const colorMap: Record<string, string> = {
    Urgent: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    High: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
    Normal: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    Low: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", colorMap[priority] ?? colorMap.Low)}>
      {priority}: {count}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// CrossWorkspaceSummary — aggregated insight across all workspaces
// ───────────────────────────────────────────────────────────────────────────────

function CrossWorkspaceSummary({
  summary, progress,
}: {
  summary: BatchReportSummary;
  progress: WorkspaceReportProgress[];
}) {
  const done = progress.filter((p) => p.status === "done" && p.report);
  if (done.length < 2) return null;

  // Most tasks / most overdue
  const sortedByTasks = [...done].sort((a, b) => (b.report!.taskCount) - (a.report!.taskCount));
  const sortedByOverdue = [...done].sort((a, b) => (b.report!.overdueCount) - (a.report!.overdueCount));
  const overdueRate = summary.totalTasks > 0
    ? Math.round((summary.totalOverdue / summary.totalTasks) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/50 bg-gradient-to-br from-indigo-50/60 to-blue-50/40 dark:from-indigo-950/30 dark:to-blue-950/20 overflow-hidden">
      <div className="px-5 py-4 border-b border-indigo-100 dark:border-indigo-800/40 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Cross-Workspace Overview</h3>
        <span className="ml-auto text-xs text-indigo-400">{done.length} workspaces analyzed</span>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-indigo-100 dark:divide-indigo-800/40">
        <MetricCell
          label="Total Tasks"
          value={summary.totalTasks}
          sub="across all workspaces"
          icon={FileText}
          color="indigo"
        />
        <MetricCell
          label="Overdue"
          value={summary.totalOverdue}
          sub={`${overdueRate}% overdue rate`}
          icon={TrendingDown}
          color={overdueRate > 20 ? "red" : overdueRate > 10 ? "amber" : "green"}
        />
        <MetricCell
          label="Largest WS"
          value={sortedByTasks[0]?.report?.taskCount ?? 0}
          sub={sortedByTasks[0]?.workspaceName ?? ""}
          icon={Building2}
          color="blue"
        />
        <MetricCell
          label="Most At Risk"
          value={sortedByOverdue[0]?.report?.overdueCount ?? 0}
          sub={sortedByOverdue[0]?.workspaceName ?? ""}
          icon={AlertCircle}
          color="amber"
        />
      </div>

      {/* Workspace comparison bar */}
      {summary.totalTasks > 0 && (
        <div className="px-5 py-4 border-t border-indigo-100 dark:border-indigo-800/40 space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Task Distribution</p>
          <div className="space-y-2">
            {sortedByTasks.map((p) => {
              const pct = Math.round((p.report!.taskCount / summary.totalTasks) * 100);
              const overduePct = p.report!.taskCount > 0
                ? Math.round((p.report!.overdueCount / p.report!.taskCount) * 100)
                : 0;
              return (
                <div key={p.workspaceId} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                      {p.workspaceName}
                    </span>
                    <span className="text-gray-400 flex-shrink-0 ml-2">
                      {p.report!.taskCount} tasks ({pct}%)
                      {overduePct > 0 && <span className="text-red-500 ml-1">· {overduePct}% overdue</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ElementType;
  color: "indigo" | "blue" | "red" | "amber" | "green";
}) {
  const textColor = {
    indigo: "text-indigo-600 dark:text-indigo-400",
    blue: "text-blue-600 dark:text-blue-400",
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    green: "text-green-600 dark:text-green-400",
  };
  return (
    <div className="px-4 py-4 space-y-1">
      <Icon className={cn("w-4 h-4 mb-1", textColor[color])} />
      <p className={cn("text-2xl font-extrabold", textColor[color])}>{value}</p>
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</p>
      <p className="text-[10px] text-gray-400 truncate">{sub}</p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// AllWorkspacesHistory — collapsed history of all past reports
// ───────────────────────────────────────────────────────────────────────────────

function AllWorkspacesHistory({
  allWorkspaces, historyMap, selectedIds, expandedId, onToggleExpand,
}: {
  allWorkspaces: WorkspaceConnection[];
  historyMap: Record<string, SyncReport[]>;
  selectedIds: Set<string>;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}) {
  const workspacesWithHistory = allWorkspaces.filter(
    (ws) => (historyMap[ws.id]?.length ?? 0) > 0
  );

  if (workspacesWithHistory.length === 0) return null;

  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Report History
      </h3>
      <div className="space-y-3">
        {workspacesWithHistory.map((ws) => {
          const reports = historyMap[ws.id] ?? [];
          const isSelected = selectedIds.has(ws.id);
          return (
            <WorkspaceHistoryGroup
              key={ws.id}
              workspace={ws}
              reports={reports}
              isSelected={isSelected}
              expandedId={expandedId}
              onToggleExpand={onToggleExpand}
            />
          );
        })}
      </div>
    </div>
  );
}

function WorkspaceHistoryGroup({
  workspace, reports, isSelected, expandedId, onToggleExpand,
}: {
  workspace: WorkspaceConnection;
  reports: SyncReport[];
  isSelected: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}) {
  const [groupOpen, setGroupOpen] = useState(false);
  const latestReport = reports[0];

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      isSelected
        ? "border-[#7B68EE]/30 dark:border-[#7B68EE]/20"
        : "border-gray-100 dark:border-gray-800"
    )}>
      {/* Group header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
        onClick={() => setGroupOpen((v) => !v)}
      >
        <div className="w-7 h-7 rounded-lg bg-[#7B68EE]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {workspace.teamName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{workspace.teamName}</p>
            {isSelected && (
              <span className="text-[10px] px-1.5 py-0.5 bg-[#7B68EE]/10 text-[#7B68EE] rounded-full font-semibold">Selected</span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {reports.length} report{reports.length !== 1 ? "s" : ""}
            {latestReport && <> · Latest: {new Date(latestReport.createdAt).toLocaleDateString()}</>}
          </p>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{reports.length}</span>
        {groupOpen
          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {/* Report entries */}
      {groupOpen && (
        <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800/50">
          {reports.map((r) => (
            <div key={r.id}>
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                onClick={() => onToggleExpand(r.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BarChart3 className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-400">· {r.taskCount} tasks</span>
                  {r.overdueCount > 0 && (
                    <span className="text-xs text-red-500">· {r.overdueCount} overdue</span>
                  )}
                </div>
                {expandedId === r.id
                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
              </button>
              {expandedId === r.id && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-50 dark:border-gray-800/50">
                  <MarkdownBody content={r.analysis} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
