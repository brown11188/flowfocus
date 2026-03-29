"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, BarChart3, CheckCircle2,
  Plug, Zap, Building2, Clock, Trash2, ChevronRight,
  CheckSquare, Square, AlertCircle, Sparkles, Plus,
  Layers, FolderOpen, List, Info, Eye, EyeOff, KeyRound,
  ArrowLeft, Check, Users, Unplug, X, ChevronDown,
  ExternalLink, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { ClickUpLogo } from "./clickup-logo";
import { MarkdownBody } from "./markdown-body";
import { BatchReportsScreen } from "./batch-reports-screen";
import type {
  WorkspaceConnection, AvailableWorkspace, WorkspaceStructure,
  SyncReport, ClickUpTaskView, ClickUpTasksResponse,
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
  type Screen = "hub" | "connect" | "pick-workspaces" | "browse-tasks" | "reports" | "batch-reports";
  const [screen, setScreen] = useState<Screen>("hub");
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceConnection | null>(null);

  // Multi-select: which workspaces are "selected" for bulk operations (AI reports)
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

  // Browse tasks state
  const [browseTasks, setBrowseTasks] = useState<ClickUpTaskView[]>([]);
  const [browseStats, setBrowseStats] = useState<ClickUpTasksResponse["stats"] | null>(null);
  const [browseSpaces, setBrowseSpaces] = useState<ClickUpTasksResponse["spaces"]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseFilter, setBrowseFilter] = useState("");
  const [browseIncludeClosed, setBrowseIncludeClosed] = useState(false);

  // AI Reports
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [includeClosed, setIncludeClosed] = useState(false);

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
      setPickerSelected(new Set(wsList.map((w) => w.id)));
      setScreen("pick-workspaces");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Token verification failed");
    } finally {
      setVerifying(false);
    }
  };

  // ─── Connect: save workspaces (no auto-import) ────────────────────────────
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
      toast.success(`✅ ${selected.length} workspace${selected.length !== 1 ? "s" : ""} connected!`);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setSaving(false);
    }
  };

  // ─── Browse tasks: read-only fetch from ClickUp API ────────────────────────
  const openBrowseTasks = async (ws: WorkspaceConnection) => {
    setActiveWorkspace(ws);
    setBrowseTasks([]);
    setBrowseStats(null);
    setBrowseSpaces([]);
    setBrowseFilter("");
    setScreen("browse-tasks");
    await fetchBrowseTasks(ws.id, browseIncludeClosed);
  };

  const fetchBrowseTasks = async (wsConnId: string, withClosed: boolean) => {
    setBrowseLoading(true);
    try {
      const params = new URLSearchParams({
        workspaceConnectionId: wsConnId,
        includeClosed: String(withClosed),
      });
      const res = await apiFetch(`/api/clickup/tasks?${params}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const data = await res.json() as ClickUpTasksResponse;
      if (!isMounted.current) return;
      setBrowseTasks(data.tasks);
      setBrowseStats(data.stats);
      setBrowseSpaces(data.spaces);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch tasks");
    } finally {
      if (isMounted.current) setBrowseLoading(false);
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
    if (!window.confirm(`Remove "${ws.teamName}"?`)) return;
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
    if (!window.confirm("Disconnect ClickUp completely?")) return;
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
          {(screen === "browse-tasks" || screen === "reports" || screen === "batch-reports") && (
            <button
              onClick={() => { setScreen("hub"); setActiveWorkspace(null); }}
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
              {screen === "browse-tasks" && activeWorkspace ? `${activeWorkspace.teamName} — Tasks`
                : screen === "reports" && activeWorkspace ? `${activeWorkspace.teamName} — AI Reports`
                : screen === "batch-reports" ? "AI Workspace Reports"
                : screen === "pick-workspaces" ? "Select Workspaces"
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
        {screen === "hub" && (
          <HubScreen
            workspaces={workspaces}
            selectedWsIds={selectedWsIds}
            disconnecting={disconnecting}
            onToggleWs={toggleWsSelect}
            onSelectAll={selectAllWs}
            onDeselectAll={deselectAllWs}
            onBrowseTasks={openBrowseTasks}
            onOpenReports={openReports}
            onBatchReports={() => {
              if (selectedWsIds.size === 0) {
                toast.warning("Select at least one workspace first.");
                return;
              }
              setScreen("batch-reports");
            }}
            onRemoveWorkspace={handleRemoveWorkspace}
            onDisconnectAll={handleDisconnectAll}
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
        {screen === "browse-tasks" && activeWorkspace && (
          <BrowseTasksScreen
            workspace={activeWorkspace}
            tasks={browseTasks}
            stats={browseStats}
            spaces={browseSpaces}
            loading={browseLoading}
            filter={browseFilter}
            includeClosed={browseIncludeClosed}
            onFilterChange={setBrowseFilter}
            onIncludeClosedChange={(v) => {
              setBrowseIncludeClosed(v);
              fetchBrowseTasks(activeWorkspace.id, v);
            }}
            onRefresh={() => fetchBrowseTasks(activeWorkspace.id, browseIncludeClosed)}
          />
        )}
        {screen === "reports" && activeWorkspace && (
          <ReportsScreen
            connection={activeWorkspace}
            syncing={syncing}
            syncReport={syncReport}
            expandedReport={expandedReport}
            includeClosed={includeClosed}
            onSetExpandedReport={setExpandedReport}
            onGenerateReport={handleGenerateReport}
            onIncludeClosedChange={setIncludeClosed}
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
            Browse tasks from your ClickUp workspaces directly in FlowFocus.
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
            className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#7B68EE]/50 focus:border-[#7B68EE] transition-colors text-gray-900 dark:text-white"
          />
          <button onClick={onToggleRaw} type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
            {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={onVerify}
          disabled={verifying || !tokenInput.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7B68EE] hover:bg-[#6B5ADF] disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {verifying
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
            : <><KeyRound className="w-4 h-4" /> Load Workspaces</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkspacePickerScreen
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
  const chosenCount = selected.size;

  return (
    <div className="max-w-md mx-auto space-y-5 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Choose Workspaces</h2>
          <p className="text-xs text-gray-500">{workspaces.length} available</p>
        </div>
      </div>

      {/* Info */}
      <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>Select workspaces to connect. You can browse tasks and generate AI reports from connected workspaces. <strong>No data is saved</strong> — tasks are read directly from ClickUp each time.</span>
      </div>

      {/* Select all */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">{chosenCount} selected</span>
        <button onClick={onSelectAll} className="text-xs text-[#7B68EE] hover:underline font-medium">
          Select all
        </button>
      </div>

      {/* Workspace list */}
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {workspaces.map((ws) => {
          const checked = selected.has(ws.id);
          return (
            <label
              key={ws.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                checked
                  ? "border-[#7B68EE]/40 bg-[#7B68EE]/5 dark:bg-[#7B68EE]/10"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              )}
            >
              <input type="checkbox" checked={checked} onChange={() => onToggle(ws.id)} className="rounded text-[#7B68EE]" />
              <div className="w-8 h-8 rounded-lg bg-[#7B68EE] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {ws.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ws.name}</p>
                <p className="text-xs text-gray-400">
                  <Users className="w-3 h-3 inline mr-1" />{ws.memberCount} member{ws.memberCount !== 1 ? "s" : ""}
                  {ws.isConnected && <span className="ml-2 text-green-500">Already connected</span>}
                </p>
              </div>
              {checked && <Check className="w-4 h-4 text-[#7B68EE]" />}
            </label>
          );
        })}
      </div>

      <button
        onClick={onConfirm}
        disabled={saving || chosenCount === 0}
        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#7B68EE] hover:bg-[#6B5ADF] disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
      >
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
          : <><Plug className="w-4 h-4" /> Connect {chosenCount} workspace{chosenCount !== 1 ? "s" : ""}</>}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HubScreen — workspace list with browse/report actions
// ─────────────────────────────────────────────────────────────────────────────

function HubScreen({
  workspaces, selectedWsIds, disconnecting,
  onToggleWs, onSelectAll, onDeselectAll, onBrowseTasks,
  onOpenReports, onBatchReports, onRemoveWorkspace, onDisconnectAll, onAddWorkspace,
}: {
  workspaces: WorkspaceConnection[];
  selectedWsIds: Set<string>;
  disconnecting: boolean;
  onToggleWs: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBrowseTasks: (ws: WorkspaceConnection) => void;
  onOpenReports: (ws: WorkspaceConnection) => void;
  onBatchReports: () => void;
  onRemoveWorkspace: (ws: WorkspaceConnection) => Promise<void>;
  onDisconnectAll: () => Promise<void>;
  onAddWorkspace: () => void;
}) {
  if (workspaces.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#7B68EE]/10 flex items-center justify-center mx-auto">
          <Building2 className="w-8 h-8 text-[#7B68EE]" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">No workspaces connected</h3>
          <p className="text-sm text-gray-500 mt-1">Connect a ClickUp workspace to browse tasks and get AI reports.</p>
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
      {/* ─── Read-only info banner ─── */}
      <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Read-only mode</strong> — Tasks are fetched directly from ClickUp each time you browse. Nothing is saved to FlowFocus.
        </span>
      </div>

      {/* ─── Top toolbar ─── */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* AI Reports for selected workspaces */}
          <button
            onClick={onBatchReports}
            disabled={selectedWsIds.size === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
            title={selectedWsIds.size === 0 ? "Select workspaces first" : `Generate AI reports for ${selectedWsIds.size} workspace${selectedWsIds.size !== 1 ? "s" : ""}`}
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
            onToggleSelect={() => onToggleWs(ws.id)}
            onBrowseTasks={() => onBrowseTasks(ws)}
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
      </div>
    </div>
  );
}

// ─── WorkspaceHubCard ─────────────────────────────────────────────────────────

function WorkspaceHubCard({
  workspace, selected,
  onToggleSelect, onBrowseTasks, onOpenReports, onRemove,
}: {
  workspace: WorkspaceConnection;
  selected: boolean;
  onToggleSelect: () => void;
  onBrowseTasks: () => void;
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
          <Clock className="w-3 h-3" /> Read-only
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Browse tasks */}
        <button
          onClick={onBrowseTasks}
          title="Browse tasks"
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#7B68EE] hover:bg-[#7B68EE]/10 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
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
// BrowseTasksScreen — read-only task browser
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: "text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400",
  High: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400",
  Normal: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400",
  Low: "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
};

function BrowseTasksScreen({
  workspace, tasks, stats, spaces, loading, filter, includeClosed,
  onFilterChange, onIncludeClosedChange, onRefresh,
}: {
  workspace: WorkspaceConnection;
  tasks: ClickUpTaskView[];
  stats: ClickUpTasksResponse["stats"] | null;
  spaces: ClickUpTasksResponse["spaces"];
  loading: boolean;
  filter: string;
  includeClosed: boolean;
  onFilterChange: (v: string) => void;
  onIncludeClosedChange: (v: boolean) => void;
  onRefresh: () => void;
}) {
  // Filter tasks by search
  const lowerFilter = filter.toLowerCase();
  const filtered = filter
    ? tasks.filter((t) =>
        t.name.toLowerCase().includes(lowerFilter) ||
        t.status.toLowerCase().includes(lowerFilter) ||
        t.assignees.some((a) => a.toLowerCase().includes(lowerFilter)) ||
        t.listName.toLowerCase().includes(lowerFilter) ||
        t.spaceName.toLowerCase().includes(lowerFilter)
      )
    : tasks;

  // Group by space
  const grouped = new Map<string, ClickUpTaskView[]>();
  for (const t of filtered) {
    const key = t.spaceName || "Other";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Fetching tasks from ClickUp…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatPill label="Total Tasks" value={stats.total} color="blue" />
          <StatPill label="Overdue" value={stats.overdue} color="red" />
          <StatPill label="Unassigned" value={stats.unassigned} color="violet" />
          <StatPill label="Done/Week" value={stats.completedThisWeek} color="green" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Search tasks, statuses, assignees…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B68EE]/50 focus:border-[#7B68EE] transition-colors text-gray-900 dark:text-white"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={includeClosed} onChange={(e) => onIncludeClosedChange(e.target.checked)} className="rounded" />
          Include closed
        </label>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Space breakdown */}
      {spaces.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {spaces.map((s) => (
            <span key={s.id} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-[#7B68EE]/10 text-[#7B68EE] rounded-full">
              <Layers className="w-3 h-3" />{s.name} <span className="opacity-60">({s.taskCount})</span>
            </span>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="text-sm text-gray-400">
            {filter ? "No tasks match your search." : "No tasks found in this workspace."}
          </p>
        </div>
      )}

      {/* Task list grouped by space */}
      {Array.from(grouped.entries()).map(([spaceName, spaceTasks]) => (
        <div key={spaceName} className="space-y-2">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#7B68EE]" />
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {spaceName}
            </h3>
            <span className="text-xs text-gray-400">({spaceTasks.length})</span>
          </div>
          <div className="space-y-1">
            {spaceTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        </div>
      ))}

      {/* Footer */}
      {tasks.length > 0 && (
        <p className="text-xs text-gray-400 text-center pt-2">
          Showing {filtered.length} of {tasks.length} tasks · Live data from ClickUp
        </p>
      )}
    </div>
  );
}

// ─── TaskRow — single ClickUp task (read-only) ──────────────────────────────

function TaskRow({ task }: { task: ClickUpTaskView }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
      {/* Status dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: task.statusColor }}
        title={task.status}
      />

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.name}</p>
          {task.url && (
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Open in ClickUp"
            >
              <ExternalLink className="w-3 h-3 text-gray-400 hover:text-[#7B68EE]" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">{task.listName}</span>
          {task.assignees.length > 0 && (
            <span className="text-xs text-gray-400">· {task.assignees.join(", ")}</span>
          )}
          {task.tags.length > 0 && (
            <span className="text-xs text-gray-400">· {task.tags.join(", ")}</span>
          )}
        </div>
      </div>

      {/* Right side badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Priority badge */}
        <span className={cn(
          "text-[10px] font-semibold px-1.5 py-0.5 rounded",
          PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.Low
        )}>
          {task.priority}
        </span>

        {/* Status badge */}
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: task.statusColor + "20",
            color: task.statusColor,
          }}
        >
          {task.status}
        </span>

        {/* Due date */}
        {task.dueDate && (
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded",
            task.isOverdue
              ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
          )}>
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Shared StatPill ─────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400",
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
    violet: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400",
    red: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
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
  connection, syncing, syncReport, expandedReport, includeClosed,
  onSetExpandedReport, onGenerateReport, onIncludeClosedChange,
}: {
  connection: WorkspaceConnection;
  syncing: boolean;
  syncReport: SyncReport | null;
  expandedReport: string | null;
  includeClosed: boolean;
  onSetExpandedReport: (id: string | null) => void;
  onGenerateReport: () => void;
  onIncludeClosedChange: (v: boolean) => void;
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
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={includeClosed} onChange={(e) => onIncludeClosedChange(e.target.checked)} className="rounded" />
          Include completed / closed tasks
        </label>
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
              <StatPill label="Overdue" value={syncReport.stats.overdue} color="red" />
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
