"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Download, BarChart3, CheckCircle2,
  Plug, Zap, Building2, Clock, Trash2, ChevronRight,
  CheckSquare, Square, AlertCircle, Sparkles, Plus,
  Layers, FolderOpen, List, Info, Eye, EyeOff, KeyRound,
  ArrowLeft, Check, Users, Unplug, X, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { ClickUpLogo } from "./clickup-logo";
import { MarkdownBody } from "./markdown-body";
import { BatchReportsScreen } from "./batch-reports-screen";
import type {
  WorkspaceConnection, AvailableWorkspace, WorkspaceStructure,
  ImportResult, SyncReport, InitialSyncState,
} from "./types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// ─────────────────────────────────────────────────────────────────────────────
// Main Hub Component
// ─────────────────────────────────────────────────────────────────────────────

export function ClickUpIntegrationPage() {
  const [loading, setLoading] = useState(true);
  const [hasConnection, setHasConnection] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceConnection[]>([]);

  // UI state
  type Screen = "hub" | "connect" | "pick-workspaces" | "first-sync" | "workspace-detail" | "reports" | "batch-reports";
  const [screen, setScreen] = useState<Screen>("hub");
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceConnection | null>(null);

  // Multi-select: which workspaces are "selected" for bulk operations
  const [selectedWsIds, setSelectedWsIds] = useState<Set<string>>(new Set());

  // Connect flow
  const [connectMode, setConnectMode] = useState<"token" | "oauth">("token");
  const [tokenInput, setTokenInput] = useState("");
  const [showRawToken, setShowRawToken] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [availableWorkspaces, setAvailableWorkspaces] = useState<AvailableWorkspace[]>([]);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // First sync state
  const [syncState, setSyncState] = useState<InitialSyncState>({
    status: "idle",
    workspaceId: null,
    workspaceName: null,
    result: null,
    error: null,
  });
  const [syncQueue, setSyncQueue] = useState<WorkspaceConnection[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncResults, setSyncResults] = useState<{ name: string; result: ImportResult }[]>([]);

  // Workspace detail / import
  const [wsStructure, setWsStructure] = useState<WorkspaceStructure | null>(null);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
  const [includeClosed, setIncludeClosed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // AI Reports
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  // Disconnect
  const [disconnecting, setDisconnecting] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  // ─── Load status ──────────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/clickup/status");
      const data = await res.json() as {
        connection: { id: string } | null;
        workspaces: WorkspaceConnection[];
      };
      if (!isMounted.current) return;
      setHasConnection(!!data.connection);
      const wsList = data.workspaces ?? [];
      setWorkspaces(wsList);
      // Default: all workspaces selected
      setSelectedWsIds(new Set(wsList.map((w) => w.id)));
      if (!data.connection) setScreen("connect");
      else setScreen("hub");
    } catch {
      toast.error("Failed to load ClickUp status");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // ─── Workspace selector toggle ─────────────────────────────────────────────
  const toggleWsSelect = (id: string) => {
    setSelectedWsIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllWs = () => setSelectedWsIds(new Set(workspaces.map((w) => w.id)));
  const deselectAllWs = () => setSelectedWsIds(new Set());

  // ─── Connect: verify token ─────────────────────────────────────────────────
  const handleVerifyToken = async () => {
    if (!tokenInput.trim()) return;
    setVerifying(true);
    try {
      const res = await apiFetch("/api/clickup/verify-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      });
      const data = await res.json() as {
        valid?: boolean; workspaces?: AvailableWorkspace[]; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setPendingToken(tokenInput);
      const wsList = data.workspaces ?? [];
      setAvailableWorkspaces(wsList);
      // Auto-select all
      setPickerSelected(new Set(wsList.map((w) => w.id)));
      setScreen("pick-workspaces");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Token verification failed");
    } finally {
      setVerifying(false);
    }
  };

  // ─── Connect: save workspaces ─────────────────────────────────────────────
  const handleSaveWorkspaces = async () => {
    if (pickerSelected.size === 0) { toast.warning("Select at least one workspace."); return; }
    setSaving(true);
    try {
      const selected = availableWorkspaces.filter((w) => pickerSelected.has(w.id));
      const res = await apiFetch("/api/clickup/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: pendingToken,
          workspaces: selected.map((w) => ({ id: w.id, name: w.name })),
        }),
      });
      const data = await res.json() as {
        success?: boolean; workspaces?: { id: string }[]; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed");

      // Reload workspaces then auto-sync
      await loadStatus();
      // Trigger first-time sync after status loaded
      setScreen("first-sync");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setSaving(false);
    }
  };

  // ─── First sync: sync all selected workspaces ─────────────────────────────
  const runFirstSync = useCallback(async (wsList: WorkspaceConnection[]) => {
    if (wsList.length === 0) { setScreen("hub"); return; }
    setSyncResults([]);
    setSyncProgress(0);
    setSyncTotal(wsList.length);
    setSyncState({ status: "syncing", workspaceId: null, workspaceName: null, result: null, error: null });

    for (let i = 0; i < wsList.length; i++) {
      const ws = wsList[i];
      setSyncState({ status: "syncing", workspaceId: ws.id, workspaceName: ws.teamName, result: null, error: null });
      try {
        const res = await apiFetch("/api/clickup/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceConnectionId: ws.id, spaceIds: [], includeClosed: false }),
        });
        const data = await res.json() as ImportResult & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        setSyncResults((prev) => [...prev, { name: ws.teamName, result: data }]);
      } catch (err) {
        setSyncResults((prev) => [
          ...prev,
          { name: ws.teamName, result: { importedCount: 0, updatedCount: 0, skippedCount: 0, projectsCreated: 0, projectsReused: 0, spacesSynced: [], errors: [err instanceof Error ? err.message : "Unknown error"] } },
        ]);
      }
      setSyncProgress(i + 1);
    }

    setSyncState({ status: "done", workspaceId: null, workspaceName: null, result: null, error: null });
    await loadStatus();
  }, [loadStatus]);

  // Auto-run first sync when screen becomes "first-sync"
  const didRunFirstSync = useRef(false);
  useEffect(() => {
    if (screen === "first-sync" && workspaces.length > 0 && !didRunFirstSync.current) {
      didRunFirstSync.current = true;
      runFirstSync(workspaces);
    }
  }, [screen, workspaces, runFirstSync]);

  // ─── Open workspace detail ─────────────────────────────────────────────────
  const openWorkspace = async (ws: WorkspaceConnection) => {
    setActiveWorkspace(ws);
    setImportResult(null);
    setWsStructure(null);
    setScreen("workspace-detail");
    setLoadingStructure(true);
    try {
      const res = await apiFetch(`/api/clickup/workspaces/${ws.id}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as WorkspaceStructure;
      setWsStructure(data);
      setSelectedSpaces(new Set(data.spaces.map((s) => s.id)));
    } catch {
      toast.error("Could not load workspace structure");
    } finally {
      setLoadingStructure(false);
    }
  };

  // ─── Quick import (from hub card) ─────────────────────────────────────────
  const quickImport = async (ws: WorkspaceConnection) => {
    try {
      const res = await apiFetch("/api/clickup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceConnectionId: ws.id, spaceIds: [], includeClosed }),
      });
      const data = await res.json() as ImportResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      toast.success(`✅ ${ws.teamName}: ${data.importedCount} new, ${data.updatedCount} updated`);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  };

  // ─── Bulk sync selected ────────────────────────────────────────────────────
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const handleBulkSync = async () => {
    const toSync = workspaces.filter((w) => selectedWsIds.has(w.id));
    if (toSync.length === 0) { toast.warning("Select at least one workspace."); return; }
    setBulkSyncing(true);
    let total = 0;
    let updated = 0;
    for (const ws of toSync) {
      try {
        const res = await apiFetch("/api/clickup/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceConnectionId: ws.id, spaceIds: [], includeClosed }),
        });
        const data = await res.json() as ImportResult & { error?: string };
        if (res.ok) { total += data.importedCount; updated += data.updatedCount; }
      } catch { /* continue */ }
    }
    toast.success(`✅ Sync done: ${total} new, ${updated} updated across ${toSync.length} workspace${toSync.length !== 1 ? "s" : ""}`);
    await loadStatus();
    setBulkSyncing(false);
  };

  // ─── Import inside detail panel ───────────────────────────────────────────
  const handleDetailImport = async () => {
    if (!activeWorkspace) return;
    if (selectedSpaces.size === 0) { toast.warning("Select at least one space."); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await apiFetch("/api/clickup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceConnectionId: activeWorkspace.id,
          spaceIds: [...selectedSpaces],
          includeClosed,
        }),
      });
      const data = await res.json() as ImportResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult(data);
      toast.success(`✅ ${data.importedCount} new, ${data.updatedCount} updated`);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  // ─── Generate AI report ───────────────────────────────────────────────────
  const openReports = (ws: WorkspaceConnection) => {
    setActiveWorkspace(ws);
    setSyncReport(null);
    setScreen("reports");
  };

  const handleGenerateReport = async () => {
    if (!activeWorkspace) return;
    setSyncing(true);
    try {
      const res = await apiFetch("/api/clickup/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceConnectionId: activeWorkspace.id, includeClosed }),
      });
      const data = await res.json() as { report?: SyncReport; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.report) {
        setSyncReport(data.report);
        toast.success(`✅ Report generated for "${data.report.workspaceName}"!`);
        await loadStatus();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Report failed");
    } finally {
      setSyncing(false);
    }
  };

  // ─── Remove workspace ─────────────────────────────────────────────────────
  const handleRemoveWorkspace = async (ws: WorkspaceConnection) => {
    if (!window.confirm(`Remove "${ws.teamName}"? Imported tasks stay in FlowFocus.`)) return;
    try {
      await apiFetch("/api/clickup/workspaces", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceConnectionId: ws.id }),
      });
      toast.success(`"${ws.teamName}" removed.`);
      await loadStatus();
    } catch { toast.error("Failed to remove workspace"); }
  };

  // ─── Disconnect all ────────────────────────────────────────────────────────
  const handleDisconnectAll = async () => {
    if (!window.confirm("Disconnect ClickUp completely? Imported tasks remain in FlowFocus.")) return;
    setDisconnecting(true);
    try {
      await apiFetch("/api/clickup/disconnect", { method: "DELETE" });
      setHasConnection(false);
      setWorkspaces([]);
      setScreen("connect");
      setTokenInput("");
      setPendingToken("");
      toast.success("ClickUp disconnected.");
    } catch { toast.error("Failed to disconnect."); }
    finally { setDisconnecting(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading ClickUp Hub…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* ─── Page Header ─── */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          {(screen === "workspace-detail" || screen === "reports" || screen === "batch-reports") && (
            <button
              onClick={() => { setScreen("hub"); setActiveWorkspace(null); setWsStructure(null); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-[#7B68EE]/10 flex items-center justify-center flex-shrink-0">
            <ClickUpLogo className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 dark:text-white">
              {screen === "workspace-detail" && activeWorkspace ? activeWorkspace.teamName
                : screen === "reports" && activeWorkspace ? `${activeWorkspace.teamName} — AI Reports`
                : screen === "batch-reports" ? "AI Workspace Reports"
                : screen === "pick-workspaces" ? "Select Workspaces"
                : screen === "first-sync" ? "Syncing Workspaces"
                : "ClickUp Hub"}
            </h1>
            {hasConnection && screen === "hub" && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""} connected
              </p>
            )}
          </div>
          {hasConnection && screen === "hub" && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Connected</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        {screen === "connect" && (
          <ConnectScreen
            tokenInput={tokenInput}
            showRaw={showRawToken}
            verifying={verifying}
            connectingOAuth={connectMode === "oauth"}
            onTokenChange={setTokenInput}
            onToggleRaw={() => setShowRawToken((v) => !v)}
            onVerify={handleVerifyToken}
            onOAuth={() => { setConnectMode("oauth"); window.location.href = `${BASE_PATH}/api/clickup/connect`; }}
          />
        )}
        {screen === "pick-workspaces" && (
          <WorkspacePickerScreen
            workspaces={availableWorkspaces}
            selected={pickerSelected}
            saving={saving}
            onToggle={(id) => setPickerSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
            onSelectAll={() => setPickerSelected(new Set(availableWorkspaces.map((w) => w.id)))}
            onBack={() => setScreen("connect")}
            onConfirm={handleSaveWorkspaces}
          />
        )}
        {screen === "first-sync" && (
          <FirstSyncScreen
            syncState={syncState}
            syncProgress={syncProgress}
            syncTotal={syncTotal}
            syncResults={syncResults}
            onDone={() => setScreen("hub")}
          />
        )}
        {screen === "hub" && (
          <HubScreen
            workspaces={workspaces}
            selectedWsIds={selectedWsIds}
            bulkSyncing={bulkSyncing}
            disconnecting={disconnecting}
            includeClosed={includeClosed}
            onToggleWs={toggleWsSelect}
            onSelectAll={selectAllWs}
            onDeselectAll={deselectAllWs}
            onQuickImport={quickImport}
            onOpenDetail={openWorkspace}
            onOpenReports={openReports}
            onBulkSync={handleBulkSync}
            onBatchReports={() => {
              if (selectedWsIds.size === 0) {
                toast.warning("Select at least one workspace first.");
                return;
              }
              setScreen("batch-reports");
            }}
            onRemoveWorkspace={handleRemoveWorkspace}
            onDisconnectAll={handleDisconnectAll}
            onIncludeClosedChange={setIncludeClosed}
            onAddWorkspace={() => setScreen("connect")}
          />
        )}
        {screen === "batch-reports" && (
          <BatchReportsScreen
            selectedWorkspaces={workspaces.filter((w) => selectedWsIds.has(w.id))}
            allWorkspaces={workspaces}
            includeClosed={includeClosed}
            onBack={() => setScreen("hub")}
          />
        )}
        {screen === "workspace-detail" && activeWorkspace && (
          <WorkspaceDetailScreen
            connection={activeWorkspace}
            structure={wsStructure}
            loadingStructure={loadingStructure}
            selectedSpaces={selectedSpaces}
            includeClosed={includeClosed}
            importing={importing}
            importResult={importResult}
            onToggleSpace={(id) => setSelectedSpaces((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
            onSelectAll={() => setSelectedSpaces(new Set(wsStructure?.spaces.map((s) => s.id) ?? []))}
            onDeselectAll={() => setSelectedSpaces(new Set())}
            onIncludeClosedChange={setIncludeClosed}
            onImport={handleDetailImport}
            onRefresh={async () => {
              if (!activeWorkspace) return;
              setLoadingStructure(true); setWsStructure(null);
              try {
                const res = await apiFetch(`/api/clickup/workspaces/${activeWorkspace.id}?refresh=1`);
                if (!res.ok) throw new Error();
                const data = await res.json() as WorkspaceStructure;
                setWsStructure(data);
                setSelectedSpaces(new Set(data.spaces.map((s) => s.id)));
              } catch { toast.error("Could not refresh workspace"); }
              finally { setLoadingStructure(false); }
            }}
          />
        )}
        {screen === "reports" && activeWorkspace && (
          <ReportsScreen
            connection={activeWorkspace}
            syncing={syncing}
            syncReport={syncReport}
            expandedReport={expandedReport}
            onSetExpandedReport={setExpandedReport}
            onGenerateReport={handleGenerateReport}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConnectScreen
// ─────────────────────────────────────────────────────────────────────────────

function ConnectScreen({
  tokenInput, showRaw, verifying, connectingOAuth,
  onTokenChange, onToggleRaw, onVerify, onOAuth,
}: {
  tokenInput: string; showRaw: boolean; verifying: boolean; connectingOAuth: boolean;
  onTokenChange: (v: string) => void; onToggleRaw: () => void;
  onVerify: () => void; onOAuth: () => void;
}) {
  return (
    <div className="max-w-md mx-auto space-y-5 pt-4">
      {/* Hero */}
      <div className="text-center space-y-3 pb-2">
        <div className="w-16 h-16 rounded-2xl bg-[#7B68EE]/10 flex items-center justify-center mx-auto">
          <ClickUpLogo className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Connect ClickUp</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sync tasks from your ClickUp workspaces into FlowFocus.
          </p>
        </div>
      </div>

      {/* OAuth */}
      <button
        onClick={onOAuth}
        disabled={connectingOAuth}
        className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-[#7B68EE] hover:bg-[#6B5ADF] disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
      >
        {connectingOAuth
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
          : <><Zap className="w-4 h-4" /> Connect via OAuth (recommended)</>}
      </button>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <span>or use Personal API Token</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Token input */}
      <div className="space-y-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Get your token at{" "}
            <a href="https://app.clickup.com/settings/apps" target="_blank" rel="noopener noreferrer"
              className="font-medium underline">ClickUp → Settings → Apps</a>.
            Starts with <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">pk_</code>.
          </span>
        </div>
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block">
          Personal API Token
        </label>
        <div className="relative">
          <input
            type={showRaw ? "text" : "password"}
            value={tokenInput}
            onChange={(e) => onTokenChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && tokenInput.trim()) onVerify(); }}
            placeholder="pk_xxxxxxxxxxxxxxxxxxxx"
            autoComplete="off"
            spellCheck={false}
            className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#7B68EE]/40 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
          />
          <button type="button" onClick={onToggleRaw} tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {tokenInput && !tokenInput.trim().startsWith("pk_") && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Personal tokens usually start with <code className="font-mono">pk_</code>
          </p>
        )}
        <button
          onClick={onVerify}
          disabled={verifying || !tokenInput.trim()}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {verifying
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying token…</>
            : <><KeyRound className="w-4 h-4" /> Load Workspaces</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkspacePickerScreen — multi-select with "Connect & Sync All" CTA
// ─────────────────────────────────────────────────────────────────────────────

function WorkspacePickerScreen({
  workspaces, selected, saving, onToggle, onSelectAll, onBack, onConfirm,
}: {
  workspaces: AvailableWorkspace[];
  selected: Set<string>;
  saving: boolean;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const chosenCount = [...selected].filter((id) => workspaces.some((w) => w.id === id)).length;

  return (
    <div className="max-w-md mx-auto space-y-5 pt-4">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="space-y-1">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Select Workspaces</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Found {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}. Choose which to connect.
          All tasks will be synced immediately after connecting.
        </p>
      </div>

      {/* Select all / none */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{chosenCount} of {workspaces.length} selected</span>
        <div className="flex gap-2">
          <button onClick={onSelectAll} className="text-xs font-medium text-[#7B68EE] hover:underline">Select all</button>
          <span className="text-gray-300">|</span>
          <button onClick={() => { workspaces.forEach((w) => { if (selected.has(w.id)) onToggle(w.id); }); }}
            className="text-xs font-medium text-gray-400 hover:text-gray-600">None</button>
        </div>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
        {workspaces.map((ws) => {
          const isSelected = selected.has(ws.id);
          return (
            <button key={ws.id} onClick={() => onToggle(ws.id)} disabled={saving}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                isSelected
                  ? "border-[#7B68EE]/50 bg-[#7B68EE]/5 dark:bg-[#7B68EE]/10"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300"
              )}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: ws.color ?? "#7B68EE" }}
              >
                {ws.avatar
                  ? <img src={ws.avatar} alt={ws.name} className="w-full h-full object-cover" />
                  : ws.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">{ws.name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3" />
                  {ws.memberCount > 0 ? `${ws.memberCount} member${ws.memberCount !== 1 ? "s" : ""}` : "Workspace"}
                </p>
              </div>
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                isSelected ? "border-[#7B68EE] bg-[#7B68EE]" : "border-gray-300 dark:border-gray-600"
              )}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info banner */}
      <div className="flex gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-700 dark:text-amber-300">
        <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>After connecting, FlowFocus will automatically sync all tasks from the selected workspaces.</span>
      </div>

      <button
        onClick={onConfirm}
        disabled={chosenCount === 0 || saving}
        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#7B68EE] hover:bg-[#6B5ADF] disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
      >
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
          : <><Zap className="w-4 h-4" /> Connect &amp; Sync {chosenCount} workspace{chosenCount !== 1 ? "s" : ""}</>}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FirstSyncScreen — progress display
// ─────────────────────────────────────────────────────────────────────────────

function FirstSyncScreen({
  syncState, syncProgress, syncTotal, syncResults, onDone,
}: {
  syncState: InitialSyncState;
  syncProgress: number;
  syncTotal: number;
  syncResults: { name: string; result: ImportResult }[];
  onDone: () => void;
}) {
  const isDone = syncState.status === "done";
  const totalImported = syncResults.reduce((a, r) => a + r.result.importedCount, 0);
  const totalUpdated = syncResults.reduce((a, r) => a + r.result.updatedCount, 0);

  return (
    <div className="max-w-md mx-auto pt-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all",
          isDone ? "bg-green-100 dark:bg-green-900/30" : "bg-[#7B68EE]/10"
        )}>
          {isDone
            ? <CheckCircle2 className="w-8 h-8 text-green-500" />
            : <Loader2 className="w-8 h-8 text-[#7B68EE] animate-spin" />}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isDone ? "Sync Complete!" : "Syncing your workspaces…"}
          </h2>
          {!isDone && syncState.workspaceName && (
            <p className="text-sm text-gray-500 mt-1">
              Importing from <strong>{syncState.workspaceName}</strong> ({syncProgress} of {syncTotal})
            </p>
          )}
          {isDone && (
            <p className="text-sm text-gray-500 mt-1">
              {totalImported} tasks imported, {totalUpdated} updated across {syncTotal} workspace{syncTotal !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isDone && syncTotal > 0 && (
        <div className="space-y-2">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#7B68EE] transition-all duration-500"
              style={{ width: `${(syncProgress / syncTotal) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center">{syncProgress} / {syncTotal} workspaces</p>
        </div>
      )}

      {/* Results */}
      {syncResults.length > 0 && (
        <div className="space-y-2">
          {syncResults.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <div className="w-8 h-8 rounded-lg bg-[#7B68EE] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.name}</p>
                <p className="text-xs text-gray-400">
                  {r.result.importedCount} new · {r.result.updatedCount} updated · {r.result.projectsCreated} project{r.result.projectsCreated !== 1 ? "s" : ""} created
                </p>
              </div>
              {r.result.errors.length > 0
                ? <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                : <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {isDone && (
        <button
          onClick={onDone}
          className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#7B68EE] hover:bg-[#6B5ADF] text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
        >
          <ChevronRight className="w-4 h-4" /> Go to ClickUp Hub
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HubScreen — main dashboard with workspace selector + workspace cards
// ─────────────────────────────────────────────────────────────────────────────

function HubScreen({
  workspaces, selectedWsIds, bulkSyncing, disconnecting, includeClosed,
  onToggleWs, onSelectAll, onDeselectAll, onQuickImport, onOpenDetail,
  onOpenReports, onBulkSync, onBatchReports, onRemoveWorkspace, onDisconnectAll, onIncludeClosedChange, onAddWorkspace,
}: {
  workspaces: WorkspaceConnection[];
  selectedWsIds: Set<string>;
  bulkSyncing: boolean;
  disconnecting: boolean;
  includeClosed: boolean;
  onToggleWs: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onQuickImport: (ws: WorkspaceConnection) => Promise<void>;
  onOpenDetail: (ws: WorkspaceConnection) => void;
  onOpenReports: (ws: WorkspaceConnection) => void;
  onBulkSync: () => Promise<void>;
  onBatchReports: () => void;
  onRemoveWorkspace: (ws: WorkspaceConnection) => Promise<void>;
  onDisconnectAll: () => Promise<void>;
  onIncludeClosedChange: (v: boolean) => void;
  onAddWorkspace: () => void;
}) {
  const selectedWsList = workspaces.filter((w) => selectedWsIds.has(w.id));
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());

  const handleQuickImport = async (ws: WorkspaceConnection) => {
    setImportingIds((p) => new Set([...p, ws.id]));
    await onQuickImport(ws);
    setImportingIds((p) => { const n = new Set(p); n.delete(ws.id); return n; });
  };

  if (workspaces.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#7B68EE]/10 flex items-center justify-center mx-auto">
          <Building2 className="w-8 h-8 text-[#7B68EE]" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">No workspaces connected</h3>
          <p className="text-sm text-gray-500 mt-1">Connect a ClickUp workspace to start importing tasks.</p>
        </div>
        <button onClick={onAddWorkspace}
          className="flex items-center gap-2 px-5 py-3 bg-[#7B68EE] hover:bg-[#6B5ADF] text-white rounded-xl font-semibold text-sm mx-auto transition-colors">
          <Plus className="w-4 h-4" /> Connect Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── Top toolbar ─── */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        {/* Left: workspace selector controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {selectedWsIds.size} of {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""} selected
          </span>
          <button onClick={onSelectAll}
            className="text-xs text-[#7B68EE] hover:underline font-medium">All</button>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <button onClick={onDeselectAll}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">None</button>
        </div>
        {/* Right: bulk actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
            <input type="checkbox" checked={includeClosed} onChange={(e) => onIncludeClosedChange(e.target.checked)} className="rounded" />
            Include closed
          </label>
          <button
            onClick={onBulkSync}
            disabled={bulkSyncing || selectedWsIds.size === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#7B68EE] hover:bg-[#6B5ADF] disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            {bulkSyncing
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing…</>
              : <><RefreshCw className="w-3.5 h-3.5" /> Sync Selected</>}
          </button>
          {/* AI Reports for selected workspaces */}
          <button
            onClick={onBatchReports}
            disabled={selectedWsIds.size === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
            title={selectedWsIds.size === 0 ? "Select workspaces first" : `Generate AI reports for ${selectedWsIds.size} workspace${selectedWsIds.size !== 1 ? 's' : ''}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Reports
            {selectedWsIds.size > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 bg-white/20 rounded-md text-[10px] font-bold">
                {selectedWsIds.size}
              </span>
            )}
          </button>
          <button onClick={onAddWorkspace}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-semibold transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* ─── Workspace cards ─── */}
      <div className="grid grid-cols-1 gap-3">
        {workspaces.map((ws) => (
          <WorkspaceHubCard
            key={ws.id}
            workspace={ws}
            selected={selectedWsIds.has(ws.id)}
            importing={importingIds.has(ws.id)}
            onToggleSelect={() => onToggleWs(ws.id)}
            onQuickImport={() => handleQuickImport(ws)}
            onOpenDetail={() => onOpenDetail(ws)}
            onOpenReports={() => onOpenReports(ws)}
            onRemove={() => onRemoveWorkspace(ws)}
          />
        ))}
      </div>

      {/* ─── Danger zone ─── */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onDisconnectAll}
          disabled={disconnecting}
          className="flex items-center gap-2 text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
        >
          {disconnecting
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Unplug className="w-3.5 h-3.5" />}
          Disconnect all workspaces
        </button>
        <p className="text-[11px] text-gray-400 mt-0.5 ml-5">Imported tasks and projects remain in FlowFocus.</p>
      </div>
    </div>
  );
}

// ─── WorkspaceHubCard ─────────────────────────────────────────────────────────

function WorkspaceHubCard({
  workspace, selected, importing,
  onToggleSelect, onQuickImport, onOpenDetail, onOpenReports, onRemove,
}: {
  workspace: WorkspaceConnection;
  selected: boolean;
  importing: boolean;
  onToggleSelect: () => void;
  onQuickImport: () => void;
  onOpenDetail: () => void;
  onOpenReports: () => void;
  onRemove: () => void;
}) {
  const initial = workspace.teamName.charAt(0).toUpperCase();

  return (
    <div className={cn(
      "group flex items-center gap-3 p-4 rounded-xl border bg-white dark:bg-gray-900 transition-all",
      selected
        ? "border-[#7B68EE]/40 shadow-sm shadow-[#7B68EE]/10"
        : "border-gray-200 dark:border-gray-700 opacity-70"
    )}>
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className="flex-shrink-0 text-gray-400 hover:text-[#7B68EE] transition-colors"
        title={selected ? "Deselect" : "Select"}
      >
        {selected
          ? <CheckSquare className="w-4 h-4 text-[#7B68EE]" />
          : <Square className="w-4 h-4" />}
      </button>

      {/* Avatar */}
      <div className="w-9 h-9 rounded-xl bg-[#7B68EE] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
        {initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{workspace.teamName}</p>
          {workspace.isActive && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">Active</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
          {workspace.lastSyncedAt
            ? <><Clock className="w-3 h-3" /> Last sync: {new Date(workspace.lastSyncedAt).toLocaleDateString()}</>
            : "Never synced"}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Quick import */}
        <button
          onClick={onQuickImport}
          disabled={importing}
          title="Quick sync all spaces"
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#7B68EE] hover:bg-[#7B68EE]/10 transition-colors disabled:opacity-50"
        >
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
        {/* Select spaces to import */}
        <button
          onClick={onOpenDetail}
          title="Select spaces to import"
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        {/* AI Reports */}
        <button
          onClick={onOpenReports}
          title="AI Reports"
          className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" />
        </button>
        {/* Remove */}
        <button
          onClick={onRemove}
          title="Remove workspace"
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkspaceDetailScreen — select spaces + import
// ─────────────────────────────────────────────────────────────────────────────

function WorkspaceDetailScreen({
  connection, structure, loadingStructure, selectedSpaces, includeClosed, importing, importResult,
  onToggleSpace, onSelectAll, onDeselectAll, onIncludeClosedChange, onImport, onRefresh,
}: {
  connection: WorkspaceConnection;
  structure: WorkspaceStructure | null;
  loadingStructure: boolean;
  selectedSpaces: Set<string>;
  includeClosed: boolean;
  importing: boolean;
  importResult: ImportResult | null;
  onToggleSpace: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onIncludeClosedChange: (v: boolean) => void;
  onImport: () => void;
  onRefresh: () => void;
}) {
  if (loadingStructure) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Loading workspace structure…</p>
      </div>
    );
  }

  if (!structure) {
    return (
      <div className="text-center py-16 space-y-3">
        <AlertCircle className="w-8 h-8 text-gray-300 mx-auto" />
        <p className="text-sm text-gray-400">Could not load workspace.</p>
        <button onClick={onRefresh} className="text-sm text-[#7B68EE] hover:underline">Retry</button>
      </div>
    );
  }

  const totalLists = structure.spaces.reduce((a, s) => a + (s.allLists?.length ?? s.lists.length), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Workspace banner */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-[#7B68EE]/5 border border-[#7B68EE]/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7B68EE] flex items-center justify-center text-white font-bold text-sm">
            {structure.workspace.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{structure.workspace.name}</p>
            <p className="text-xs text-gray-500">{structure.spaces.length} spaces · {totalLists} lists</p>
          </div>
        </div>
        <button onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs text-[#7B68EE] hover:text-[#6B5ADF] font-medium">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Info note */}
      <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Each <strong>Space</strong> maps to a <strong>Project</strong> in FlowFocus. All folders and lists within a space are imported.
          Import is a <strong>one-way upsert</strong> — new tasks are added, existing tasks are updated. Local notes and labels are preserved.
        </span>
      </div>

      {/* Space selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Select Spaces
            <span className="ml-2 text-xs font-normal text-gray-400">({selectedSpaces.size} of {structure.spaces.length})</span>
          </p>
          <div className="flex gap-2 text-xs">
            <button onClick={onSelectAll} className="text-[#7B68EE] hover:underline font-medium">All</button>
            <span className="text-gray-300">·</span>
            <button onClick={onDeselectAll} className="text-gray-400 hover:text-gray-600">None</button>
          </div>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
          {structure.spaces.map((space) => (
            <SpaceSelectCard
              key={space.id}
              space={space}
              selected={selectedSpaces.has(space.id)}
              onToggle={() => onToggleSpace(space.id)}
            />
          ))}
        </div>
      </div>

      {/* Options row */}
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
        <input type="checkbox" checked={includeClosed} onChange={(e) => onIncludeClosedChange(e.target.checked)} className="rounded" />
        Include completed / closed tasks
      </label>

      {/* Import button */}
      <button
        onClick={onImport}
        disabled={importing || selectedSpaces.size === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-[#7B68EE] hover:bg-[#6B5ADF] disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
      >
        {importing
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
          : <><Download className="w-4 h-4" /> Import {selectedSpaces.size} Space{selectedSpaces.size !== 1 ? "s" : ""} into FlowFocus</>}
      </button>

      {importResult && <ImportResultCard result={importResult} />}
    </div>
  );
}

// ─── SpaceSelectCard ─────────────────────────────────────────────────────────

function SpaceSelectCard({
  space, selected, onToggle,
}: {
  space: WorkspaceStructure["spaces"][0];
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allLists = space.allLists ?? space.lists;
  const folders = space.folders ?? [];
  const folderlessLists = space.lists.filter((l) => !l.folderId);
  const hasFolders = folders.length > 0;
  const totalTasks = space.totalTasks ?? allLists.reduce((a, l) => a + (l.taskCount ?? 0), 0);

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      selected ? "border-[#7B68EE]/40 bg-[#7B68EE]/5 dark:bg-[#7B68EE]/10" : "border-gray-200 dark:border-gray-700"
    )}>
      <label className="flex items-center gap-3 p-3 cursor-pointer select-none">
        <input type="checkbox" checked={selected} onChange={onToggle} className="rounded text-[#7B68EE]" />
        <Layers className="w-4 h-4 text-[#7B68EE]/70 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{space.name}</p>
          <p className="text-xs text-gray-400">
            {hasFolders && <span>{folders.length} folder{folders.length !== 1 ? "s" : ""} · </span>}
            {allLists.length} list{allLists.length !== 1 ? "s" : ""}
            {totalTasks > 0 && <> · ~{totalTasks} tasks</>}
          </p>
        </div>
        {selected && <CheckCircle2 className="w-4 h-4 text-[#7B68EE] flex-shrink-0" />}
        {(hasFolders || allLists.length > 0) && (
          <button type="button" onClick={(e) => { e.preventDefault(); setExpanded((v) => !v); }}
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 transition-colors">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </label>
      {expanded && (
        <div className="pb-2 px-3 space-y-1.5">
          {folders.map((folder) => (
            <FolderRow key={folder.id} folder={folder} />
          ))}
          {folderlessLists.length > 0 && (
            <div className="space-y-1">
              {hasFolders && <p className="text-xs font-medium text-gray-400 pl-5 pt-1">Folderless Lists</p>}
              {folderlessLists.map((list) => (
                <div key={list.id} className="flex items-center gap-2 py-1 px-2 rounded-lg text-xs text-gray-500 pl-6">
                  <List className="w-3 h-3 text-gray-400" />
                  <span className="flex-1 truncate">{list.name}</span>
                  {(list.taskCount ?? 0) > 0 && <span className="text-gray-400 ml-auto">{list.taskCount}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FolderRow({ folder }: {
  folder: { id: string; name: string; taskCount: number; lists: { id: string; name: string; taskCount: number }[] };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-1.5 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="flex-1 text-left font-medium truncate">{folder.name}</span>
        <span className="text-gray-400">{folder.lists.length} list{folder.lists.length !== 1 ? "s" : ""}</span>
        {open ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
      </button>
      {open && folder.lists.length > 0 && (
        <div className="py-1 bg-gray-50/50 dark:bg-gray-900/30">
          {folder.lists.map((list) => (
            <div key={list.id} className="flex items-center gap-2 py-1 px-2 pl-7 text-xs text-gray-500">
              <List className="w-3 h-3 text-gray-400" />
              <span className="flex-1 truncate">{list.name}</span>
              {list.taskCount > 0 && <span className="text-gray-400">{list.taskCount}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportResultCard({ result }: { result: ImportResult }) {
  const hasErrors = result.errors.length > 0;
  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      hasErrors ? "border-amber-200 dark:border-amber-800/50" : "border-green-200 dark:border-green-800/50"
    )}>
      <div className={cn(
        "px-4 py-2.5 flex items-center gap-2",
        hasErrors ? "bg-amber-50 dark:bg-amber-950/30" : "bg-green-50 dark:bg-green-950/30"
      )}>
        <CheckCircle2 className={cn("w-4 h-4", hasErrors ? "text-amber-500" : "text-green-500")} />
        <span className={cn("text-sm font-semibold", hasErrors ? "text-amber-800 dark:text-amber-300" : "text-green-800 dark:text-green-300")}>
          Import Complete
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatPill label="New Tasks" value={result.importedCount} color="green" />
          <StatPill label="Updated" value={result.updatedCount} color="blue" />
          <StatPill label="Projects Created" value={result.projectsCreated} color="violet" />
          <StatPill label="Projects Matched" value={result.projectsReused} color="gray" />
        </div>
        {result.spacesSynced.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {result.spacesSynced.map((s) => (
              <span key={s} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-[#7B68EE]/10 text-[#7B68EE] rounded-full">
                <Layers className="w-3 h-3" />{s}
              </span>
            ))}
          </div>
        )}
        {result.message && <p className="text-xs text-gray-500">{result.message}</p>}
        {hasErrors && (
          <details className="text-xs">
            <summary className="text-red-500 cursor-pointer">{result.errors.length} error{result.errors.length !== 1 ? "s" : ""}</summary>
            <ul className="mt-1 space-y-1 text-gray-500 list-disc pl-4">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </details>
        )}
        <p className="text-xs text-gray-400">Reload the sidebar to see newly imported projects.</p>
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400",
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
    violet: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400",
    gray: "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  };
  return (
    <div className={cn("rounded-lg p-2.5 text-center", colorMap[color] ?? colorMap.gray)}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] font-medium opacity-80 mt-0.5">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReportsScreen
// ─────────────────────────────────────────────────────────────────────────────

function ReportsScreen({
  connection, syncing, syncReport, expandedReport, onSetExpandedReport, onGenerateReport,
}: {
  connection: WorkspaceConnection;
  syncing: boolean;
  syncReport: SyncReport | null;
  expandedReport: string | null;
  onSetExpandedReport: (id: string | null) => void;
  onGenerateReport: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Generate */}
      <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border border-violet-200 dark:border-violet-800/50 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <p className="text-sm font-semibold text-gray-900 dark:text-white">AI Workspace Report</p>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Generate an AI-powered analysis of <strong>{connection.teamName}</strong> — overdue tasks, priorities, workload distribution, and productivity insights.
        </p>
        <button
          onClick={onGenerateReport}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
        >
          {syncing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Report…</>
            : <><BarChart3 className="w-4 h-4" /> Generate AI Report</>}
        </button>
      </div>

      {/* Latest */}
      {syncReport && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Latest — {syncReport.workspaceName}</span>
            </div>
            <span className="text-xs text-gray-400">{new Date(syncReport.createdAt).toLocaleString()}</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatPill label="Total Tasks" value={syncReport.stats.total} color="blue" />
              <StatPill label="Overdue" value={syncReport.stats.overdue} color="gray" />
              <StatPill label="Unassigned" value={syncReport.stats.unassigned} color="violet" />
              <StatPill label="Done/Week" value={syncReport.stats.completedThisWeek} color="green" />
            </div>
            <MarkdownBody content={syncReport.analysis} />
          </div>
        </div>
      )}

      {/* History */}
      {connection.reports.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Past Reports</p>
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
                      {r.overdueCount > 0 && <span className="text-red-500 ml-1">· {r.overdueCount} overdue</span>}
                    </p>
                  </div>
                </div>
                {expandedReport === r.id
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedReport === r.id && (
                <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <MarkdownBody content={r.analysis} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {connection.reports.length === 0 && !syncReport && (
        <div className="text-center py-10 text-sm text-gray-400">
          No reports yet. Generate your first AI report above.
        </div>
      )}
    </div>
  );
}
