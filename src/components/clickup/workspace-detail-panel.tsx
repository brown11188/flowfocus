"use client";
import { useState, useCallback, useEffect } from "react";
import {
  ArrowLeft, CheckCircle2, Download, BarChart3,
  Loader2, Clock, ToggleLeft, ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { WorkspaceImportTab } from "./workspace-import-tab";
import { WorkspaceReportsTab } from "./workspace-reports-tab";
import type {
  WorkspaceConnection, WorkspaceStructure, ImportResult, SyncReport, WorkspaceTab,
} from "./types";

interface WorkspaceDetailPanelProps {
  connection: WorkspaceConnection;
  onBack: () => void;
  onUpdated: (ws: WorkspaceConnection) => void;
}

export function WorkspaceDetailPanel({
  connection, onBack, onUpdated,
}: WorkspaceDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("import");

  // Import state
  const [workspace, setWorkspace] = useState<WorkspaceStructure | null>(null);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
  const [includeClosed, setIncludeClosed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Report state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncReport | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  // Toggle state
  const [togglingSync, setTogglingSync] = useState(false);

  const loadStructure = useCallback(async (refresh = false) => {
    setLoadingStructure(true);
    try {
      const url = `/api/clickup/workspaces/${connection.id}${refresh ? "?refresh=1" : ""}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as WorkspaceStructure;
      setWorkspace(data);
      setSelectedSpaces(new Set(data.spaces.map((s) => s.id)));
    } catch {
      toast.error("Could not load workspace structure");
    } finally {
      setLoadingStructure(false);
    }
  }, [connection.id]);

  useEffect(() => {
    if (activeTab === "import" && !workspace) {
      loadStructure();
    }
  }, [activeTab, workspace, loadStructure]);

  const handleToggleSync = async () => {
    setTogglingSync(true);
    try {
      const res = await apiFetch(`/api/clickup/workspaces/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncEnabled: !connection.syncEnabled }),
      });
      if (!res.ok) throw new Error("Failed");
      onUpdated({ ...connection, syncEnabled: !connection.syncEnabled });
      toast.success(`Sync ${!connection.syncEnabled ? "enabled" : "disabled"} for ${connection.teamName}`);
    } catch {
      toast.error("Failed to update sync setting");
    } finally {
      setTogglingSync(false);
    }
  };

  const handleImport = async () => {
    if (selectedSpaces.size === 0) { toast.warning("Select at least one Space to import."); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await apiFetch("/api/clickup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceConnectionId: connection.id,
          spaceIds: [...selectedSpaces],
          includeClosed,
        }),
      });
      const data = await res.json() as ImportResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult(data);
      toast.success(`✅ Import done! ${data.importedCount} new, ${data.updatedCount} updated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleSyncReport = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiFetch("/api/clickup/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceConnectionId: connection.id,
          includeClosed,
        }),
      });
      const data = await res.json() as { report?: SyncReport; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.report) {
        setSyncResult(data.report);
        toast.success(`✅ AI Report generated for "${data.report.workspaceName}"!`);
        onUpdated({
          ...connection,
          lastSyncedAt: data.report.createdAt,
          reports: [{
            id: data.report.id,
            workspaceName: data.report.workspaceName,
            taskCount: data.report.taskCount,
            overdueCount: data.report.overdueCount,
            analysis: data.report.analysis,
            createdAt: data.report.createdAt,
          }, ...connection.reports].slice(0, 3),
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Report failed");
    } finally {
      setSyncing(false);
    }
  };

  const initial = connection.teamName.charAt(0).toUpperCase();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#7B68EE] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white truncate">{connection.teamName}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span>Connected</span>
              {connection.lastSyncedAt && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <Clock className="w-3 h-3" />
                  <span>Synced {new Date(connection.lastSyncedAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Sync toggle */}
        <button
          onClick={handleToggleSync}
          disabled={togglingSync}
          title={connection.syncEnabled ? "Disable auto-sync" : "Enable auto-sync"}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors",
            connection.syncEnabled
              ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 hover:bg-green-100"
              : "text-gray-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200"
          )}
        >
          {togglingSync ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : connection.syncEnabled ? (
            <ToggleRight className="w-4 h-4" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          {connection.syncEnabled ? "Sync on" : "Sync off"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
        {([
          { id: "import" as const, label: "Import Tasks", icon: Download },
          { id: "reports" as const, label: "AI Reports", icon: BarChart3 },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === id
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "import" && (
        <WorkspaceImportTab
          workspace={workspace}
          loadingStructure={loadingStructure}
          selectedSpaces={selectedSpaces}
          includeClosed={includeClosed}
          importing={importing}
          importResult={importResult}
          onToggleSpace={(id) =>
            setSelectedSpaces((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            })
          }
          onSelectAll={() => setSelectedSpaces(new Set(workspace?.spaces.map((s) => s.id) ?? []))}
          onDeselectAll={() => setSelectedSpaces(new Set())}
          onIncludeClosedChange={setIncludeClosed}
          onImport={handleImport}
          onRefresh={() => loadStructure(true)}
        />
      )}

      {activeTab === "reports" && (
        <WorkspaceReportsTab
          connection={connection}
          syncing={syncing}
          syncResult={syncResult}
          expandedReport={expandedReport}
          onSetExpandedReport={setExpandedReport}
          onSyncReport={handleSyncReport}
        />
      )}
    </div>
  );
}
