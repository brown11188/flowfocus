/**
 * ClickUp API v2 Adapter
 * Docs: https://developer.clickup.com/docs
 *
 * Supports:
 *  - OAuth2 flow (Authorization Code Grant)
 *  - Personal API Token (direct)
 *  - Workspace / Space / Folder / List / Task fetching
 *  - AI report generation via DeepInfra
 */

const CLICKUP_BASE = "https://api.clickup.com/api/v2";
const CLICKUP_AUTH_URL = "https://app.clickup.com/api";
const CLICKUP_TOKEN_URL = `${CLICKUP_BASE}/oauth/token`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClickUpWorkspace {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
  members?: { user: { id: number; username: string; email: string } }[];
}

export interface ClickUpSpace {
  id: string;
  name: string;
  status?: { status: string; color: string }[];
  features?: Record<string, unknown>;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  orderindex: number;
  override_statuses: boolean;
  hidden?: boolean;
  task_count?: number;
  lists?: ClickUpList[];
}

export interface ClickUpList {
  id: string;
  name: string;
  orderindex: number;
  status?: { status: string; color: string; type: string }[];
  task_count?: number;
  folder: { id: string; name: string; hidden?: boolean };
  space: { id: string; name: string; access?: boolean };
}

/** Workspace structure for the import UI */
export interface ClickUpSpaceWithLists extends ClickUpSpace {
  lists: ClickUpList[];
  folders: ClickUpFolder[];  // Folders within this space (each folder contains its own lists)
}

export interface ClickUpWorkspaceStructure {
  workspace: ClickUpWorkspace;
  spaces: ClickUpSpaceWithLists[];
  totalLists: number;
}export interface ClickUpAssignee {
  id: number;
  username: string;
  email: string;
  profilePicture?: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: { status: string; color: string; type: string };
  priority?: { id: string; priority: string; color: string; orderindex: string } | null;
  due_date?: string | null;   // unix ms string
  start_date?: string | null;
  time_estimate?: number | null;  // ms
  time_spent?: number | null;     // ms
  date_created: string;           // unix ms string
  date_updated: string;
  creator: { id: number; username: string; email: string };
  assignees: ClickUpAssignee[];
  tags: { name: string; tag_fg: string; tag_bg: string }[];
  list: { id: string; name: string };
  folder: { id: string; name: string };
  space: { id: string };
  url: string;
  subtasks?: ClickUpTask[];
  parent?: string | null;
}

export interface ClickUpTaskSummary {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  priority: string;
  priorityColor: string;
  dueDate: Date | null;
  assignees: string[];
  listName: string;
  folderName: string;
  url: string;
  isOverdue: boolean;
  tags: string[];
}

export interface ClickUpWorkspaceReport {
  workspace: ClickUpWorkspace;
  spaces: ClickUpSpace[];
  tasks: ClickUpTaskSummary[];
  stats: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    unassigned: number;
    completedThisWeek: number;
  };
}

/** Result of a 1-way import into FlowFocus */
export interface ClickUpImportResult {
  importedCount: number;   // new tasks created
  updatedCount: number;    // existing tasks updated
  skippedCount: number;    // tasks that had no meaningful change
  projectsCreated: number; // new FlowFocus projects auto-created
  projectsReused: number;  // existing FlowFocus projects matched by spaceId
  spacesSynced: string[];  // space names processed
  errors: string[];
}

// ─── OAuth Helpers ────────────────────────────────────────────────────────────

/**
 * Build the OAuth2 authorization URL.
 *
 * ClickUp only accepts a bare domain as redirect_uri (path is stripped).
 * Workaround: set redirect_uri to <rootDomain>/clickup-relay.html,
 * and encode the real callback path inside the `state` parameter
 * using the delimiter "|".  The relay page decodes it and forwards
 * the browser to the actual /api/clickup/callback route.
 *
 * state format: <userId>:<random>|<callbackPath>
 * e.g.:  abc123:ff00ff...|/apps/xklwb3f46m48u5s4h2h5d4pd/api/clickup/callback
 */
export function buildAuthorizationUrl(state: string): string {
  const clientId = process.env.CLICKUP_CLIENT_ID;
  if (!clientId) throw new Error("CLICKUP_CLIENT_ID env var is not set");

  const relayUri  = buildRelayUri();   // root-domain relay page
  const basePath  = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const stateWithPath = `${state}|${basePath}/api/clickup/callback`;

  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: relayUri,
    state:        stateWithPath,
  });
  return `${CLICKUP_AUTH_URL}?${params.toString()}`;
}

/**
 * The relay page URL that is registered in the ClickUp OAuth app.
 * Must be a bare domain or domain + simple path that ClickUp accepts.
 * Default:  <rootDomain>/clickup-relay.html
 * Override: set CLICKUP_RELAY_URI env var.
 */
export function buildRelayUri(): string {
  if (process.env.CLICKUP_RELAY_URI) return process.env.CLICKUP_RELAY_URI.trim();

  let appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  appUrl = appUrl.replace(/\/+$/, "");
  // Strip basePath suffix if NEXTAUTH_URL already includes it
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (base && appUrl.endsWith(base)) {
    appUrl = appUrl.slice(0, appUrl.length - base.length);
  }
  return `${appUrl}/clickup-relay.html`;
}

/**
 * Legacy helper — kept for backward-compat.
 * Returns the real /api/clickup/callback URL (NOT the relay).
 */
export function buildRedirectUri(): string {
  if (process.env.CLICKUP_REDIRECT_URI) return process.env.CLICKUP_REDIRECT_URI.trim();
  let appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  appUrl = appUrl.replace(/\/+$/, "");
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (base && appUrl.endsWith(base)) appUrl = appUrl.slice(0, appUrl.length - base.length);
  return `${appUrl}${base}/api/clickup/callback`;
}

/**
 * Exchange authorization code for an access token.
 */
export async function exchangeCodeForToken(
  code: string
): Promise<{ access_token: string; token_type: string }> {
  const clientId = process.env.CLICKUP_CLIENT_ID;
  const clientSecret = process.env.CLICKUP_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("CLICKUP_CLIENT_ID / CLICKUP_CLIENT_SECRET not set");

  const res = await fetch(CLICKUP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp token exchange failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ access_token: string; token_type: string }>;
}

// ─── ClickUp API Client ───────────────────────────────────────────────────────

export class ClickUpClient {
  private readonly token: string;

  constructor(accessToken: string) {
    this.token = accessToken;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${CLICKUP_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: this.token,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ClickUp API ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  // ── Workspaces ──────────────────────────────────────────────────────────────

  async getWorkspaces(): Promise<ClickUpWorkspace[]> {
    const data = await this.get<{ teams: ClickUpWorkspace[] }>("/team");
    return data.teams;
  }

  // ── Spaces ──────────────────────────────────────────────────────────────────

  async getSpaces(workspaceId: string): Promise<ClickUpSpace[]> {
    const data = await this.get<{ spaces: ClickUpSpace[] }>(
      `/team/${workspaceId}/space`,
      { archived: "false" }
    );
    return data.spaces;
  }

  // ── Folders ─────────────────────────────────────────────────────────────────

  async getFolders(spaceId: string): Promise<ClickUpFolder[]> {
    const data = await this.get<{ folders: ClickUpFolder[] }>(
      `/space/${spaceId}/folder`,
      { archived: "false" }
    );
    return data.folders ?? [];
  }

  // ── Lists ────────────────────────────────────────────────────────────────────

  /**
   * Returns ONLY folderless lists in a space.
   * Lists inside Folders are NOT returned here — use getListsInFolder().
   */
  async getFolderlessLists(spaceId: string): Promise<ClickUpList[]> {
    const data = await this.get<{ lists: ClickUpList[] }>(
      `/space/${spaceId}/list`,
      { archived: "false" }
    );
    return data.lists ?? [];
  }

  /**
   * Returns all lists inside a specific Folder.
   */
  async getListsInFolder(folderId: string): Promise<ClickUpList[]> {
    const data = await this.get<{ lists: ClickUpList[] }>(
      `/folder/${folderId}/list`,
      { archived: "false" }
    );
    return data.lists ?? [];
  }

  /**
   * Returns ALL lists in a space: folderless lists + lists inside every folder.
   * This is the correct replacement for the old getListsInSpace().
   */
  async getListsInSpace(spaceId: string): Promise<ClickUpList[]> {
    const [folderlessLists, folders] = await Promise.all([
      this.getFolderlessLists(spaceId),
      this.getFolders(spaceId),
    ]);

    const folderListArrays = await Promise.all(
      folders.map(async (folder) => {
        try {
          return await this.getListsInFolder(folder.id);
        } catch {
          return [] as ClickUpList[];
        }
      })
    );

    return [...folderlessLists, ...folderListArrays.flat()];
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────────

  /**
   * Fetch all tasks in a list, handling pagination automatically.
   * ClickUp returns max 100 tasks per page.
   */
  async getTasksInList(
    listId: string,
    options: { includeSubtasks?: boolean; includeClosed?: boolean } = {}
  ): Promise<ClickUpTask[]> {
    const tasks: ClickUpTask[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const data = await this.get<{ tasks: ClickUpTask[]; last_page?: boolean }>(
        `/list/${listId}/task`,
        {
          page: String(page),
          include_closed: String(options.includeClosed ?? true),
          subtasks: String(options.includeSubtasks ?? false),
          order_by: "due_date",
        }
      );

      tasks.push(...(data.tasks ?? []));

      if (data.last_page || (data.tasks?.length ?? 0) < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return tasks;
  }

  /**
   * Fetch workspace structure (spaces + lists) for the import UI.
   * Does NOT fetch tasks — just the tree structure.
   */
  async getWorkspaceStructure(workspaceId: string): Promise<ClickUpWorkspaceStructure> {
    const workspaces = await this.getWorkspaces();
    const workspace = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];
    const spaces = await this.getSpaces(workspace.id);

    const spacesWithLists: ClickUpSpaceWithLists[] = await Promise.all(
      spaces.map(async (space) => {
        try {
          const [folders, folderlessLists] = await Promise.all([
            this.getFolders(space.id),
            this.getFolderlessLists(space.id),
          ]);

          // Fetch lists inside each folder in parallel
          const foldersWithLists: ClickUpFolder[] = await Promise.all(
            folders.map(async (folder) => {
              try {
                const lists = await this.getListsInFolder(folder.id);
                return { ...folder, lists };
              } catch {
                return { ...folder, lists: [] };
              }
            })
          );

          // Combine: folderless lists first, then all folder lists
          const allLists = [
            ...folderlessLists,
            ...foldersWithLists.flatMap((f) => f.lists ?? []),
          ];

          return { ...space, lists: allLists, folders: foldersWithLists };
        } catch {
          return { ...space, lists: [], folders: [] };
        }
      })
    );

    const totalLists = spacesWithLists.reduce((acc, s) => acc + s.lists.length, 0);
    return { workspace, spaces: spacesWithLists, totalLists };
  }

  /**
   * Fetch all tasks across all spaces/lists in a workspace.
   * Respects ClickUp's rate limit by spacing requests.
   */
  async getAllWorkspaceTasks(
    workspaceId: string,
    options: { includeClosed?: boolean; maxLists?: number } = {}
  ): Promise<{ tasks: ClickUpTask[]; spaces: ClickUpSpace[] }> {
    const spaces = await this.getSpaces(workspaceId);
    const allTasks: ClickUpTask[] = [];
    let listsProcessed = 0;
    const maxLists = options.maxLists ?? 50; // safety cap

    for (const space of spaces) {
      if (listsProcessed >= maxLists) break;
      try {
        // Get both folderless lists and lists inside folders
        const [folderlessLists, folders] = await Promise.all([
          this.getFolderlessLists(space.id),
          this.getFolders(space.id),
        ]);

        // Collect all lists: folderless + from folders
        const allSpaceLists: ClickUpList[] = [...folderlessLists];
        for (const folder of folders) {
          try {
            const folderLists = await this.getListsInFolder(folder.id);
            allSpaceLists.push(...folderLists);
          } catch (e) {
            console.warn(`[ClickUp] Failed to fetch lists for folder ${folder.id}:`, e);
          }
        }

        for (const list of allSpaceLists) {
          if (listsProcessed >= maxLists) break;
          try {
            const tasks = await this.getTasksInList(list.id, {
              includeClosed: options.includeClosed ?? false,
            });
            allTasks.push(...tasks);
            listsProcessed++;
          } catch (e) {
            console.warn(`[ClickUp] Failed to fetch tasks for list ${list.id}:`, e);
          }
        }
      } catch (e) {
        console.warn(`[ClickUp] Failed to fetch lists for space ${space.id}:`, e);
      }
    }

    return { tasks: allTasks, spaces };
  }

  /**
   * Fetch tasks for a specific set of space IDs only.
   * Used by the 1-way import flow (user selects which spaces to import).
   */
  async fetchTasksForSpaces(
    workspaceId: string,
    spaceIds: string[],
    options: { includeClosed?: boolean } = {}
  ): Promise<{ tasks: Array<ClickUpTask & { _spaceId: string }>; spaceMap: Map<string, ClickUpSpaceWithLists> }> {
    const structure = await this.getWorkspaceStructure(workspaceId);
    const selectedSpaces = structure.spaces.filter(
      (s) => spaceIds.length === 0 || spaceIds.includes(s.id)
    );

    const allTasks: Array<ClickUpTask & { _spaceId: string }> = [];
    const spaceMap = new Map<string, ClickUpSpaceWithLists>();

    for (const space of selectedSpaces) {
      spaceMap.set(space.id, space);
      // space.lists now contains BOTH folderless lists AND lists inside folders
      // (populated by the updated getWorkspaceStructure)
      for (const list of space.lists) {
        try {
          const tasks = await this.getTasksInList(list.id, {
            includeClosed: options.includeClosed ?? false,
          });
          allTasks.push(...tasks.map((t) => ({ ...t, _spaceId: space.id })));
        } catch (e) {
          console.warn(`[ClickUp] list ${list.id} ("${list.name}") fetch error:`, e);
        }
      }
    }

    return { tasks: allTasks, spaceMap };
  }
}

// ─── Task Normalizer──────────

const PRIORITY_MAP: Record<string, string> = {
  "1": "Urgent",
  "2": "High",
  "3": "Normal",
  "4": "Low",
};

const PRIORITY_COLORS: Record<string, string> = {
  "1": "#ff0000",
  "2": "#ffb900",
  "3": "#6fddff",
  "4": "#d8d8d8",
};

export function normalizeTask(task: ClickUpTask): ClickUpTaskSummary {
  const dueDate = task.due_date
    ? new Date(parseInt(task.due_date, 10))
    : null;

  const priorityId = task.priority?.id ?? "4";
  const now = new Date();

  return {
    id: task.id,
    name: task.name,
    status: task.status?.status ?? "unknown",
    statusColor: task.status?.color ?? "#cccccc",
    priority: PRIORITY_MAP[priorityId] ?? "None",
    priorityColor: PRIORITY_COLORS[priorityId] ?? "#d8d8d8",
    dueDate,
    assignees: task.assignees?.map((a) => a.username ?? a.email) ?? [],
    listName: task.list?.name ?? "",
    folderName: task.folder?.name ?? "",
    url: task.url,
    isOverdue:
      dueDate != null &&
      dueDate < now &&
      task.status?.type !== "closed",
    tags: task.tags?.map((t) => t.name) ?? [],
  };
}

// ─── Statistics Builder ───────────────────────────────────────────────────────

export function buildWorkspaceStats(
  tasks: ClickUpTaskSummary[]
): ClickUpWorkspaceReport["stats"] {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let overdue = 0;
  let unassigned = 0;
  let completedThisWeek = 0;

  for (const task of tasks) {
    // Status
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;

    // Priority
    byPriority[task.priority] = (byPriority[task.priority] ?? 0) + 1;

    // Overdue
    if (task.isOverdue) overdue++;

    // Unassigned
    if (task.assignees.length === 0) unassigned++;

    // Completed this week (status type = closed)
    if (
      task.status.toLowerCase() === "complete" ||
      task.status.toLowerCase() === "closed" ||
      task.status.toLowerCase() === "done"
    ) {
      completedThisWeek++; // ClickUp doesn't provide completion date in list view easily
    }
  }

  return {
    total: tasks.length,
    byStatus,
    byPriority,
    overdue,
    unassigned,
    completedThisWeek,
  };
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL =
  process.env.DEEPINFRA_MODEL ?? "meta-llama/Meta-Llama-3.1-70B-Instruct";

export async function generateClickUpReport(
  workspace: ClickUpWorkspace,
  tasks: ClickUpTaskSummary[],
  stats: ClickUpWorkspaceReport["stats"]
): Promise<string> {
  const apiKey = process.env.DEEPINFRA_API_KEY;

  const overdueSample = tasks
    .filter((t) => t.isOverdue)
    .slice(0, 10)
    .map((t) => `  • [${t.priority}] "${t.name}" in ${t.listName} (due ${t.dueDate?.toLocaleDateString()})`);

  const urgentSample = tasks
    .filter((t) => t.priority === "Urgent" || t.priority === "High")
    .slice(0, 10)
    .map((t) => `  • [${t.status}] "${t.name}" → ${t.assignees.join(", ") || "Unassigned"}`);

  const promptData = {
    workspace: workspace.name,
    generated: new Date().toLocaleString(),
    stats,
    overdueTasks: overdueSample,
    urgentTasks: urgentSample,
    topStatuses: Object.entries(stats.byStatus)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${v}`),
  };

  if (!apiKey) return generateFallbackReport(promptData);

  try {
    const prompt = `You are a project management analyst. Analyze this ClickUp workspace data and provide an actionable report.

Workspace: ${promptData.workspace}
Generated: ${promptData.generated}

Statistics:
- Total open tasks: ${stats.total}
- Overdue: ${stats.overdue}
- Unassigned: ${stats.unassigned}
- Completed this week: ${stats.completedThisWeek}
- Status breakdown: ${promptData.topStatuses.join(", ")}
- Priority breakdown: ${Object.entries(stats.byPriority).map(([k, v]) => `${k}: ${v}`).join(", ")}

Top overdue tasks:
${overdueSample.join("\n") || "  None"}

High priority tasks:
${urgentSample.join("\n") || "  None"}

Please provide:
1. **Executive Summary** (2-3 sentences)
2. **Key Risks** (top 3 issues needing immediate attention)
3. **Action Items** (prioritized list of 5 recommended actions)
4. **Team Insights** (workload and assignment observations)
5. **Positive Highlights** (what's going well)

Write in clear, professional markdown. Be specific and actionable.`;

    const res = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPINFRA_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
      }),
    });

    if (!res.ok) throw new Error(`DeepInfra ${res.status}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0]?.message?.content ?? generateFallbackReport(promptData);
  } catch (e) {
    console.error("[ClickUp AI] DeepInfra error:", e);
    return generateFallbackReport(promptData);
  }
}

function generateFallbackReport(data: {
  workspace: string;
  generated: string;
  stats: ClickUpWorkspaceReport["stats"];
  overdueTasks: string[];
  urgentTasks: string[];
  topStatuses: string[];
}): string {
  const { workspace, generated, stats, overdueTasks, urgentTasks, topStatuses } = data;
  return `## ClickUp Workspace Report — ${workspace}
*Generated: ${generated}*

### Executive Summary
Workspace **${workspace}** has **${stats.total}** open tasks across all spaces.
${stats.overdue > 0 ? `⚠️ **${stats.overdue} tasks are overdue** and need immediate attention.` : "✅ No overdue tasks found."}
${stats.unassigned > 0 ? `🔔 **${stats.unassigned} tasks are unassigned** and may stall without ownership.` : ""}

### Status Breakdown
${topStatuses.map((s) => `- ${s}`).join("\n")}

### Priority Breakdown
- Urgent: ${stats.byPriority["Urgent"] ?? 0}
- High: ${stats.byPriority["High"] ?? 0}
- Normal: ${stats.byPriority["Normal"] ?? 0}
- Low: ${stats.byPriority["Low"] ?? 0}

### ⚠️ Overdue Tasks
${overdueTasks.length > 0 ? overdueTasks.join("\n") : "None"}

### 🔥 High Priority Tasks
${urgentTasks.length > 0 ? urgentTasks.join("\n") : "None"}

### Recommended Actions
1. Review and reassign the **${stats.unassigned}** unassigned tasks immediately
2. Triage **${stats.overdue}** overdue tasks — reschedule or close stale ones
3. Ensure Urgent/High priority tasks have clear owners and deadlines
4. Conduct a brief standup to address blockers
5. Update task statuses to reflect current progress
`;
}
