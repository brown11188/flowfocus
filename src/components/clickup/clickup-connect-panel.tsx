"use client";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Plug, Unplug, CheckCircle2, AlertCircle,
  ChevronDown, ChevronRight, BarChart3, KeyRound, Loader2,
  Download, FolderOpen, ListChecks, Layers, RotateCcw, Info, Eye, EyeOff,
  ExternalLink, Zap, Building2, ArrowLeft, Users, RefreshCw, Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportEntry {
  id: string;
  workspaceName: string;
  taskCount: number;
  overdueCount: number;
  analysis: string;
  createdAt: string;
}

interface Connection {
  id: string;
  teamId: string;
  teamName: string;
  lastSyncedAt: string | null;
  createdAt: string;
  reports: ReportEntry[];
}

interface WorkspaceSpace {
  id: string;
  name: string;
  lists: { id: string; name: string; taskCount: number; folderId?: string | null; folderName?: string | null }[];
  folders: { id: string; name: string; taskCount: number; lists: { id: string; name: string; taskCount: number }[] }[];
  allLists: { id: string; name: string; taskCount: number; folderId?: string | null; folderName?: string | null }[];
  totalTasks: number;
}

interface WorkspaceStructure {
  workspace: { id: string; name: string };
  spaces: WorkspaceSpace[];
  totalLists: number;
}

interface ImportResult {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  projectsCreated: number;
  projectsReused: number;
  spacesSynced: string[];
  errors: string[];
  message?: string;
}

interface SyncReportResult {
  report: {
    id: string;
    workspaceName: string;
    analysis: string;
    taskCount: number;
    overdueCount: number;
    stats: {
      total: number;
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
      overdue: number;
      unassigned: number;
      completedThisWeek: number;
    };
    createdAt: string;
  };
}

interface WorkspaceOption {
  id: string;
  name: string;
  color: string | null;
  avatar: string | null;
  memberCount: number;
}

type ConnectStep = "form" | "picking" | "done";
type ActiveTab = "import" | "reports";

// ─── Main Panel ─────────────────────────────────────────────────────────────────

export function ClickUpConnectPanel() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("import");

  // Connect states
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [connectStep, setConnectStep] = useState<ConnectStep>("form");
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>([]);
  const [pendingToken, setPendingToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);

  // Import states
  const [workspace, setWorkspace] = useState<WorkspaceStructure | null>(null);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
  const [includeClosed, setIncludeClosed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Report states
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncReportResult["report"] | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/clickup/status");
      const data = await res.json() as { connection: Connection | null };
      setConnection(data.connection);
    } catch {
      toast.error("Failed to load ClickUp status");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkspaceStructure = useCallback(async (refresh = false) => {
    setLoadingStructure(true);
    try {
      const res = await apiFetch(`/api/clickup/workspaces${refresh ? "?refresh=1" : ""}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as WorkspaceStructure;
      setWorkspace(data);
      setSelectedSpaces(new Set(data.spaces.map((s) => s.id)));
    } catch {
      toast.error("Could not load workspace structure");
    } finally {
      setLoadingStructure(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    if (connection && activeTab === "import" && !workspace) {
      loadWorkspaceStructure();
    }
  }, [connection, activeTab, workspace, loadWorkspaceStructure]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleOAuthConnect = () => {
    setConnectingOAuth(true);
    window.location.href = `${BASE_PATH}/api/clickup/connect`;
  };

  /** Step 1: verify token → fetch workspace list */
  const handleVerifyToken = async () => {
    if (!tokenInput.trim()) return;
    setVerifyingToken(true);
    try {
      const res = await apiFetch("/api/clickup/verify-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      });
      const data = await res.json() as {
        valid?: boolean;
        workspaces?: WorkspaceOption[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setPendingToken(tokenInput);
      setWorkspaceOptions(data.workspaces ?? []);
      setConnectStep("picking");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Token verification failed");
    } finally {
      setVerifyingToken(false);
    }
  };

  /** Step 2: pick workspace → save to DB */
  const handleSelectWorkspace = async (ws: WorkspaceOption) => {
    setSavingToken(true);
    try {
      const res = await apiFetch("/api/clickup/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: pendingToken,
          workspaceId: ws.id,
          workspaceName: ws.name,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`✅ Connected to "${ws.name}"!`);
      setConnectStep("done");
      setShowTokenForm(false);
      setTokenInput("");
      setPendingToken("");
      setWorkspaceOptions([]);
      setWorkspace(null);
      loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setSavingToken(false);
    }
  };

  /** Switch to a different workspace (re-opens workspace picker with existing token) */
  const handleSwitchWorkspace = async () => {
    if (!connection) return;
    setSavingToken(true);
    try {
      // Re-verify the stored token to get workspace list
      const res = await apiFetch("/api/clickup/verify-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: connection.teamId }), // won't work — need stored token
      });
      // We don't have the raw token stored in client, so redirect to re-connect
      toast.info("To switch workspace, disconnect and reconnect with your token.");
    } catch {
      toast.error("Failed to load workspaces");
    } finally {
      setSavingToken(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect ClickUp? All import history will be kept in FlowFocus.")) return;
    setDisconnecting(true);
    try {
      await apiFetch("/api/clickup/disconnect", { method: "DELETE" });
      setConnection(null);
      setWorkspace(null);
      setSyncResult(null);
      setImportResult(null);
      setConnectStep("form");
      setTokenInput("");
      setPendingToken("");
      setWorkspaceOptions([]);
      toast.success("ClickUp disconnected.");
    } catch {
      toast.error("Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  };

  const toggleSpace = (spaceId: string) => {
    setSelectedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedSpaces.size === 0) { toast.warning("Select at least one Space to import."); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await apiFetch("/api/clickup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceIds: [...selectedSpaces], includeClosed }),
      });
      const data = await res.json() as ImportResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult(data);
      toast.success(`✅ Import complete! ${data.importedCount} new, ${data.updatedCount} updated.`);
      loadStatus();
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
        body: JSON.stringify({ includeClosed }),
      });
      const data = await res.json() as SyncReportResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSyncResult(data.report);
      toast.success(`✅ AI Report generated for "${data.report.workspaceName}"!`);
      loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Report failed");
    } finally {
      setSyncing(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 py-10 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#7B68EE]/10 flex items-center justify-center">
            <ClickUpLogo />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">ClickUp Integration</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {connection
                ? `Connected to ${connection.teamName}`
                : "Connect to import tasks into FlowFocus"}
            </p>
          </div>
        </div>
        {connection && (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
          >
            {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unplug className="w-3 h-3" />}
            Disconnect
          </button>
        )}
      </div>

      {!connection ? (
        // ─── Connect Flow ─────────────────────────────────────────────────────
        connectStep === "picking" ? (
          <WorkspacePicker
            workspaces={workspaceOptions}
            saving={savingToken}
            onSelect={handleSelectWorkspace}
            onBack={() => { setConnectStep("form"); setWorkspaceOptions([]); }}
          />
        ) : (
          <ConnectForm
            connectingOAuth={connectingOAuth}
            showTokenForm={showTokenForm}
            tokenInput={tokenInput}
            verifyingToken={verifyingToken}
            onOAuthConnect={handleOAuthConnect}
            onToggleTokenForm={() => setShowTokenForm((v) => !v)}
            onTokenChange={setTokenInput}
            onVerifyToken={handleVerifyToken}
            onCancelToken={() => { setShowTokenForm(false); setTokenInput(""); }}
          />
        )
      ) : (
        // ─── Connected View ───────────────────────────────────────────────────
        <>
          {/* Connection status bar */}
          <ConnectedStatusBar
            connection={connection}
            onDisconnect={handleDisconnect}
            disconnecting={disconnecting}
          />

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
            <ImportTab
              workspace={workspace}
              loadingStructure={loadingStructure}
              selectedSpaces={selectedSpaces}
              includeClosed={includeClosed}
              importing={importing}
              importResult={importResult}
              onToggleSpace={toggleSpace}
              onSelectAll={() => setSelectedSpaces(new Set(workspace?.spaces.map((s) => s.id) ?? []))}
              onDeselectAll={() => setSelectedSpaces(new Set())}
              onIncludeClosedChange={setIncludeClosed}
              onImport={handleImport}
              onRefreshStructure={() => loadWorkspaceStructure(true)}
            />
          )}

          {activeTab === "reports" && (
            <ReportsTab
              connection={connection}
              syncing={syncing}
              syncResult={syncResult}
              expandedReport={expandedReport}
              onSetExpandedReport={setExpandedReport}
              onSyncReport={handleSyncReport}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── WorkspacePicker ──────────────────────────────────────────────────────────

function WorkspacePicker({
  workspaces,
  saving,
  onSelect,
  onBack,
}: {
  workspaces: WorkspaceOption[];
  saving: boolean;
  onSelect: (ws: WorkspaceOption) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(
    workspaces.length === 1 ? workspaces[0].id : null
  );

  const chosenWs = workspaces.find((w) => w.id === selected);

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to connect
      </button>

      {/* Title */}
      <div className="text-center space-y-1 py-2">
        <div className="w-12 h-12 rounded-full bg-[#7B68EE]/10 flex items-center justify-center mx-auto">
          <Building2 className="w-6 h-6 text-[#7B68EE]" />
        </div>
        <h4 className="font-semibold text-gray-900 dark:text-white">Select a Workspace</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {workspaces.length === 1
            ? "Found 1 workspace linked to your token."
            : `Found ${workspaces.length} workspaces. Choose which one to connect.`}
        </p>
      </div>

      {/* Workspace list */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
        {workspaces.map((ws) => {
          const isSelected = selected === ws.id;
          const initial = ws.name.charAt(0).toUpperCase();
          return (
            <button
              key={ws.id}
              onClick={() => setSelected(ws.id)}
              disabled={saving}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                isSelected
                  ? "border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/30 ring-2 ring-violet-300/50 dark:ring-violet-700/50"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
              )}
            >
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: ws.color ?? "#7B68EE" }}
              >
                {ws.avatar ? (
                  <img src={ws.avatar} alt={ws.name} className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                  {ws.name}
                </p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3" />
                  {ws.memberCount > 0 ? `${ws.memberCount} member${ws.memberCount !== 1 ? "s" : ""}` : "Workspace"}
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <span className="font-mono text-[10px] text-gray-300 dark:text-gray-600">{ws.id}</span>
                </p>
              </div>

              {/* Check */}
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                isSelected
                  ? "border-violet-500 bg-violet-500"
                  : "border-gray-300 dark:border-gray-600"
              )}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Connect CTA */}
      <button
        onClick={() => chosenWs && onSelect(chosenWs)}
        disabled={!selected || saving}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
        ) : (
          <><CheckCircle2 className="w-4 h-4" /> Connect to {chosenWs?.name ?? "selected workspace"}</>
        )}
      </button>
    </div>
  );
}

// ─── ConnectedStatusBar ────────────────────────────────────────────────────────

function ConnectedStatusBar({
  connection,
  onDisconnect,
  disconnecting,
}: {
  connection: Connection;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  // Initial letter for avatar fallback
  const initial = connection.teamName.charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
      {/* Workspace avatar */}
      <div className="w-7 h-7 rounded-lg bg-[#7B68EE] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-green-800 dark:text-green-300 truncate">
            {connection.teamName}
          </span>
        </div>
        {connection.lastSyncedAt && (
          <p className="text-[11px] text-green-600/70 dark:text-green-500/70 mt-0.5">
            Last synced {new Date(connection.lastSyncedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── ConnectForm ─────────────────────────────────────────────────────────────────

function ConnectForm({
  connectingOAuth, showTokenForm, tokenInput, verifyingToken,
  onOAuthConnect, onToggleTokenForm, onTokenChange, onVerifyToken, onCancelToken,
}: {
  connectingOAuth: boolean;
  showTokenForm: boolean;
  tokenInput: string;
  verifyingToken: boolean;
  onOAuthConnect: () => void;
  onToggleTokenForm: () => void;
  onTokenChange: (v: string) => void;
  onVerifyToken: () => void;
  onCancelToken: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#7B68EE]/10 flex items-center justify-center mx-auto">
          <Plug className="w-6 h-6 text-[#7B68EE]" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">Connect your ClickUp account</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose how to connect ClickUp to import tasks and projects into FlowFocus.
          </p>
        </div>

        {/* OAuth button */}
        <button
          onClick={onOAuthConnect}
          disabled={connectingOAuth}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-[#7B68EE] hover:bg-[#6B5ADF] disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
        >
          {connectingOAuth
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to ClickUp…</>
            : <><Zap className="w-4 h-4" /> Connect via OAuth (recommended)</>}
        </button>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span>or use a token</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Token toggle button */}
        <button
          onClick={onToggleTokenForm}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm transition-colors"
        >
          <KeyRound className="w-4 h-4" />
          {showTokenForm ? "Hide Personal API Token form" : "Use Personal API Token"}
        </button>
      </div>

      {/* Token form */}
      {showTokenForm && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800/50 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-4">
          {/* How-to */}
          <div className="flex gap-2.5 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
            <Info className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 mt-0.5" />
            <span>
              Go to{" "}
              <a
                href="https://app.clickup.com/settings/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 dark:text-violet-400 font-medium hover:underline"
              >
                ClickUp → Settings → Apps
              </a>
              {" "}and copy your <strong>Personal API Token</strong>.
              It starts with{" "}
              <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-[11px]">pk_</code>.
            </span>
          </div>

          {/* Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Personal API Token
            </label>
            <div className="relative">
              <input
                type={showRaw ? "text" : "password"}
                value={tokenInput}
                onChange={(e) => onTokenChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && tokenInput.trim()) onVerifyToken(); }}
                placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {tokenInput && !tokenInput.trim().startsWith("pk_") && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Personal tokens usually start with{" "}
                <code className="font-mono">pk_</code>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onVerifyToken}
              disabled={verifyingToken || !tokenInput.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {verifyingToken
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                : <><Building2 className="w-4 h-4" /> Load Workspaces</>}
            </button>
            <button
              onClick={onCancelToken}
              className="px-4 py-2.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ImportTab ───────────────────────────────────────────────────────────────────

function ImportTab({
  workspace, loadingStructure, selectedSpaces, includeClosed, importing, importResult,
  onToggleSpace, onSelectAll, onDeselectAll, onIncludeClosedChange, onImport, onRefreshStructure,
}: {
  workspace: WorkspaceStructure | null;
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
  onRefreshStructure: () => void;
}) {
  if (loadingStructure) {
    return (
      <div className="flex items-center gap-3 py-8 justify-center text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading workspace structure…
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        Could not load workspace.{" "}
        <button onClick={onRefreshStructure} className="text-violet-500 hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Workspace info banner */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50">
        <div className="w-8 h-8 rounded-lg bg-[#7B68EE] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {workspace.workspace.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-200 truncate">
            {workspace.workspace.name}
          </p>
          <p className="text-xs text-violet-600/70 dark:text-violet-400/70">
            {workspace.spaces.length} space{workspace.spaces.length !== 1 ? "s" : ""}
            {" · "}{workspace.totalLists} list{workspace.totalLists !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onRefreshStructure}
          className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Info banner */}
      <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Each selected Space becomes a <strong>Project</strong> in FlowFocus.
          Tasks are <strong>upserted</strong> — new tasks added, existing tasks updated.
          Your local edits to notes and labels are preserved.
        </span>
      </div>

      {/* Space selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Select Spaces to import
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onSelectAll} className="text-xs text-violet-600 hover:underline">All</button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button onClick={onDeselectAll} className="text-xs text-gray-400 hover:text-gray-600">None</button>
          </div>
        </div>
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {workspace.spaces.map((space) => (
            <label
              key={space.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none",
                selectedSpaces.has(space.id)
                  ? "border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              )}
            >
              <input
                type="checkbox"
                checked={selectedSpaces.has(space.id)}
                onChange={() => onToggleSpace(space.id)}
                className="rounded text-violet-600"
              />
              <Layers className="w-4 h-4 text-violet-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{space.name}</p>
                <p className="text-xs text-gray-400">
                  {(space.allLists ?? space.lists).length} list{(space.allLists ?? space.lists).length !== 1 ? "s" : ""}
                  {space.totalTasks > 0 && <> · ~{space.totalTasks} tasks</>}
                </p>
              </div>
              {selectedSpaces.has(space.id) && (
                <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0" />
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Options */}
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
        <input type="checkbox" checked={includeClosed}
          onChange={(e) => onIncludeClosedChange(e.target.checked)} className="rounded" />
        Include completed / closed tasks
      </label>

      {/* Import button */}
      <button
        onClick={onImport}
        disabled={importing || selectedSpaces.size === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        {importing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Importing tasks…</>
        ) : (
          <><Download className="w-4 h-4" /> Import {selectedSpaces.size} Space{selectedSpaces.size !== 1 ? "s" : ""} into FlowFocus</>
        )}
      </button>

      {importResult && <ImportResultCard result={importResult} />}
    </div>
  );
}

// ─── ImportResultCard ──────────────────────────────────────────────────────────

function ImportResultCard({ result }: { result: ImportResult }) {
  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800/50 overflow-hidden">
      <div className="bg-green-50 dark:bg-green-950/30 px-4 py-2.5 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm font-semibold text-green-800 dark:text-green-300">Import Complete</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniStat label="New Tasks" value={result.importedCount} color="green" />
          <MiniStat label="Updated" value={result.updatedCount} color="blue" />
          <MiniStat label="Projects Created" value={result.projectsCreated} color="violet" />
          <MiniStat label="Projects Matched" value={result.projectsReused} color="gray" />
        </div>
        {result.spacesSynced.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {result.spacesSynced.map((s) => (
              <span key={s} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">
                <FolderOpen className="w-3 h-3" />{s}
              </span>
            ))}
          </div>
        )}
        {result.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{result.message}</p>
        )}
        {result.errors.length > 0 && (
          <details className="text-xs">
            <summary className="text-red-500 cursor-pointer">{result.errors.length} errors</summary>
            <ul className="mt-1 space-y-1 text-gray-500">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </details>
        )}
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <ListChecks className="w-3 h-3" />
          Reload the sidebar to see newly imported projects.
        </p>
      </div>
    </div>
  );
}

// ─── ReportsTab ──────────────────────────────────────────────────────────────────

function ReportsTab({
  connection, syncing, syncResult, expandedReport,
  onSetExpandedReport, onSyncReport,
}: {
  connection: Connection;
  syncing: boolean;
  syncResult: SyncReportResult["report"] | null;
  expandedReport: string | null;
  onSetExpandedReport: (id: string | null) => void;
  onSyncReport: () => void;
}) {
  return (
    <div className="space-y-4">
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

      {syncResult && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Latest — {syncResult.workspaceName}</span>
            </div>
            <span className="text-xs text-gray-400">{new Date(syncResult.createdAt).toLocaleString()}</span>
          </div>
          <div className="p-4 space-y-3">
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

      {connection.reports.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Past Reports</p>
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
                        <span className="text-red-500 ml-1">· <AlertCircle className="w-3 h-3 inline" /> {r.overdueCount} overdue</span>
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
    </div>
  );
}

// ─── MarkdownBody ─────────────────────────────────────────────────────────────

function MarkdownBody({ content }: { content: string }) {
  return (
    <div
      className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
      dangerouslySetInnerHTML={{
        __html: content
          .replace(/## (.+)/g, '<h3 class="font-bold text-gray-900 dark:text-white mt-3 mb-1 text-sm">$1</h3>')
          .replace(/### (.+)/g, '<h4 class="font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-1 text-sm">$1</h4>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/^- (.+)/gm, '<li class="ml-4 list-disc">$1</li>')
          .replace(/^\d+\. (.+)/gm, '<li class="ml-4 list-decimal">$1</li>')
          .replace(/\n/g, '<br/>'),
      }}
    />
  );
}

// ─── MiniStat ────────────────────────────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: number; color: "blue" | "red" | "yellow" | "green" | "violet" | "gray" }) {
  const colors = {
    blue:   "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
    red:    "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300",
    yellow: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300",
    green:  "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300",
    violet: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300",
    gray:   "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
  };
  return (
    <div className={cn("rounded-xl p-2.5 text-center", colors[color])}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs opacity-75 mt-0.5">{label}</p>
    </div>
  );
}

// ─── ClickUpLogo ─────────────────────────────────────────────────────────────────

function ClickUpLogo() {
  return (
    <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
      <path d="M4.53 21.4L8.2 18.4c1.95 2.3 3.9 3.46 7.8 3.46s5.85-1.16 7.8-3.46l3.67 3c-2.73 3.2-6.4 4.87-11.47 4.87S7.26 24.6 4.53 21.4z" fill="#7B68EE"/>
      <path d="M4 11.2l3.78 2.87C9.9 11.5 12.7 10.1 16 10.1s6.1 1.4 8.22 3.97L28 11.2C25.13 7.7 20.9 5.67 16 5.67S6.87 7.7 4 11.2z" fill="#FF79C6"/>
    </svg>
  );
}