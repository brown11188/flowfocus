"use client";
import {
  BarChart3, AlertCircle, ChevronDown, ChevronRight, Loader2,
} from "lucide-react";
import { MiniStat } from "./mini-stat";
import { MarkdownBody } from "./markdown-body";
import type { WorkspaceConnection, SyncReport } from "./types";

interface WorkspaceReportsTabProps {
  connection: WorkspaceConnection;
  syncing: boolean;
  syncResult: SyncReport | null;
  expandedReport: string | null;
  onSetExpandedReport: (id: string | null) => void;
  onSyncReport: () => void;
}

export function WorkspaceReportsTab({
  connection, syncing, syncResult, expandedReport, onSetExpandedReport, onSyncReport,
}: WorkspaceReportsTabProps) {
  return (
    <div className="space-y-5">
      {/* Generate CTA */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border border-violet-200 dark:border-violet-800/50">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Generate an AI-powered report analyzing all tasks in{" "}
          <strong>{connection.teamName}</strong> — overdue items, priorities, workload insights.
        </p>
        <button
          onClick={onSyncReport}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {syncing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating AI Report…</>
          ) : (
            <><BarChart3 className="w-4 h-4" /> Generate AI Workspace Report</>
          )}
        </button>
      </div>

      {/* Latest result */}
      {syncResult && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Latest — {syncResult.workspaceName}
              </span>
            </div>
            <span className="text-xs text-gray-400">{new Date(syncResult.createdAt).toLocaleString()}</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MiniStat label="Total Tasks" value={syncResult.stats.total} color="blue" />
              <MiniStat label="Overdue" value={syncResult.stats.overdue} color="red" />
              <MiniStat label="Unassigned" value={syncResult.stats.unassigned} color="yellow" />
              <MiniStat label="Done/Week" value={syncResult.stats.completedThisWeek} color="green" />
            </div>
            <MarkdownBody content={syncResult.analysis} />
          </div>
        </div>
      )}

      {/* History */}
      {connection.reports.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Past Reports
          </p>
          {connection.reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSetExpandedReport(expandedReport === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{r.workspaceName}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleString()} · {r.taskCount} tasks
                      {r.overdueCount > 0 && (
                        <span className="text-red-500 ml-1">
                          · <AlertCircle className="w-3 h-3 inline" /> {r.overdueCount} overdue
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {expandedReport === r.id
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedReport === r.id && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                  <MarkdownBody content={r.analysis} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {connection.reports.length === 0 && !syncResult && (
        <div className="text-center py-8 text-sm text-gray-400">
          No reports yet. Generate your first AI report above.
        </div>
      )}
    </div>
  );
}
