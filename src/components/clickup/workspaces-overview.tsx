"use client";
import {
  Plus, CheckCircle2, Clock, ToggleRight, ToggleLeft,
  Trash2, Loader2, AlertTriangle, Unplug, Building2,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceConnection } from "./types";

interface WorkspacesOverviewProps {
  workspaces: WorkspaceConnection[];
  disconnecting: boolean;
  onSelectWorkspace: (ws: WorkspaceConnection) => void;
  onAddWorkspace: () => void;
  onDisconnectAll: () => void;
  onRemoveWorkspace: (id: string) => void;
}

export function WorkspacesOverview({
  workspaces, disconnecting,
  onSelectWorkspace, onAddWorkspace, onDisconnectAll, onRemoveWorkspace,
}: WorkspacesOverviewProps) {
  const activeCount = workspaces.filter((w) => w.isActive).length;

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 text-center">
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{activeCount}</p>
          <p className="text-xs text-green-600/70 dark:text-green-500/70 mt-0.5">Active</p>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-center">
          <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{workspaces.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Connected</p>
        </div>
        <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50 text-center">
          <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">
            {workspaces.filter((w) => w.syncEnabled && w.isActive).length}
          </p>
          <p className="text-xs text-violet-600/70 dark:text-violet-500/70 mt-0.5">Sync On</p>
        </div>
      </div>

      {/* Workspace list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Connected Workspaces</h4>
          <button
            onClick={onAddWorkspace}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30"
          >
            <Plus className="w-3.5 h-3.5" />
            Add workspace
          </button>
        </div>

        {workspaces.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <Building2 className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No workspaces connected yet</p>
            <button onClick={onAddWorkspace}
              className="mt-3 text-xs text-violet-500 hover:underline">
              Connect your first workspace
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                onOpen={() => onSelectWorkspace(ws)}
                onRemove={() => onRemoveWorkspace(ws.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      {workspaces.length > 0 && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onDisconnectAll}
            disabled={disconnecting}
            className="flex items-center gap-2 text-xs text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
          >
            {disconnecting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Unplug className="w-3.5 h-3.5" />}
            Disconnect all (remove ClickUp connection)
          </button>
          <p className="text-[11px] text-gray-400 mt-1 ml-5.5">
            Imported tasks and projects remain in FlowFocus.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── WorkspaceCard ───────────────────────────────────────────────────────────────────────

function WorkspaceCard({
  workspace, onOpen, onRemove,
}: {
  workspace: WorkspaceConnection;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const initial = workspace.teamName.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer",
        workspace.isActive
          ? "border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 bg-white dark:bg-gray-900 hover:shadow-sm"
          : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 opacity-60"
      )}
      onClick={onOpen}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-[#7B68EE] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
        {initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">{workspace.teamName}</p>
          {workspace.isActive ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex-shrink-0">
              <CheckCircle2 className="w-2.5 h-2.5" /> Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full flex-shrink-0">
              <AlertTriangle className="w-2.5 h-2.5" /> Inactive
            </span>
          )}
          {workspace.syncEnabled && workspace.isActive && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full flex-shrink-0">
              <Activity className="w-2.5 h-2.5" /> Sync
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {workspace.lastSyncedAt ? (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(workspace.lastSyncedAt).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-xs text-gray-400">Never synced</p>
          )}
          {workspace.reports.length > 0 && (
            <p className="text-xs text-gray-400">
              {workspace.reports.length} report{workspace.reports.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onRemove}
          title="Remove workspace"
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Arrow hint */}
      <div className="text-gray-300 dark:text-gray-600 group-hover:text-violet-400 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
