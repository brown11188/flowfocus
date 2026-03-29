// ─── Shared ClickUp Hub Types ─────────────────────────────────────────────────

export interface ReportEntry {
  id: string;
  workspaceName: string;
  taskCount: number;
  overdueCount: number;
  analysis: string;
  createdAt: string;
}

export interface WorkspaceConnection {
  id: string;               // ClickUpWorkspaceConnection.id
  teamId: string;
  teamName: string;
  isActive: boolean;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  reports: ReportEntry[];
}

export interface AvailableWorkspace {
  id: string;
  name: string;
  color: string | null;
  avatar: string | null;
  memberCount: number;
  isConnected: boolean;
}

export interface WorkspaceFolder {
  id: string;
  name: string;
  taskCount: number;
  lists: { id: string; name: string; taskCount: number }[];
}

export interface WorkspaceSpace {
  id: string;
  name: string;
  /** Folderless lists only */
  lists: { id: string; name: string; taskCount: number; folderId?: string | null; folderName?: string | null }[];
  /** Folders with their lists */
  folders: WorkspaceFolder[];
  /** All lists flat (folderless + inside folders) */
  allLists: { id: string; name: string; taskCount: number; folderId?: string | null; folderName?: string | null }[];
  totalTasks: number;
}

export interface WorkspaceStructure {
  workspaceConnectionId: string;
  workspace: { id: string; name: string };
  spaces: WorkspaceSpace[];
  totalLists: number;
}

export interface ImportResult {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  projectsCreated: number;
  projectsReused: number;
  spacesSynced: string[];
  errors: string[];
  message?: string;
}

/** Read-only ClickUp task returned from /api/clickup/tasks */
export interface ClickUpTaskView {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  priority: string;
  priorityColor: string;
  dueDate: string | null;
  assignees: string[];
  listName: string;
  folderName: string;
  url: string;
  isOverdue: boolean;
  tags: string[];
  spaceId: string;
  spaceName: string;
  description: string | null;
}

export interface ClickUpTasksResponse {
  tasks: ClickUpTaskView[];
  stats: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    unassigned: number;
    completedThisWeek: number;
  };
  spaces: { id: string; name: string; taskCount: number }[];
  totalTasks: number;
}

export interface SyncReport {
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
}

export type HubView = "overview" | "workspace" | "reports";
export type WorkspaceTab = "import" | "reports";

export interface InitialSyncState {
  status: "idle" | "syncing" | "done" | "error";
  workspaceId: string | null;
  workspaceName: string | null;
  result: ImportResult | null;
  error: string | null;
}

// ─── Multi-Workspace AI Report Types ─────────────────────────────────────────

export type BatchReportStatus = "idle" | "running" | "done" | "error";

export interface WorkspaceReportProgress {
  workspaceId: string;         // WorkspaceConnection.id
  workspaceName: string;
  status: "pending" | "fetching" | "done" | "error";
  report?: SyncReport;
  errorMessage?: string;
}

export interface BatchReportSummary {
  totalReports: number;
  totalTasks: number;
  totalOverdue: number;
}

// SSE event types from /api/clickup/sync/batch
export type BatchSseEvent =
  | { type: "start";    workspaceId: string; workspaceName: string; index: number; total: number }
  | { type: "done";     workspaceId: string; workspaceName: string; report: SyncReport }
  | { type: "error";    workspaceId: string; workspaceName: string; message: string }
  | { type: "complete"; summary: BatchReportSummary };
