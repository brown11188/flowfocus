import { Task } from "@/types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const CACHE_KEY = "flowfocus:offline-cache:v1";
const QUEUE_KEY = "flowfocus:offline-task-queue:v1";

export type OfflineDataKey =
  | "tasks"
  | "projects"
  | "labels"
  | "risks"
  | "approvals"
  | "scopeChanges"
  | "decisionLogs"
  | "meetingNotes"
  | "reports";

export interface OfflineAppCache {
  tasks: Task[];
  projects: Array<Record<string, unknown>>;
  labels: Array<Record<string, unknown>>;
  risks: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>;
  scopeChanges: Array<Record<string, unknown>>;
  decisionLogs: Array<Record<string, unknown>>;
  meetingNotes: Array<Record<string, unknown>>;
  reports: Array<Record<string, unknown>>;
  updatedAt: string;
}

interface BaseMutation {
  queueId: string;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
}

interface CreateTaskMutation extends BaseMutation {
  kind: "create";
  tempId: string;
  payload: Record<string, unknown>;
}

interface PatchTaskMutation extends BaseMutation {
  kind: "patch";
  taskId: string;
  payload: Record<string, unknown>;
}

interface DeleteTaskMutation extends BaseMutation {
  kind: "delete";
  taskId: string;
}

export type OfflineTaskMutation =
  | CreateTaskMutation
  | PatchTaskMutation
  | DeleteTaskMutation;

export interface FlushQueueResult {
  syncedCount: number;
  failedCount: number;
  hadChanges: boolean;
}

export interface OfflineQueueDiagnostics {
  totalPending: number;
  totalFailed: number;
  oldestAt: string | null;
  lastError: string | null;
}

const DEFAULT_CACHE: OfflineAppCache = {
  tasks: [],
  projects: [],
  labels: [],
  risks: [],
  approvals: [],
  scopeChanges: [],
  decisionLogs: [],
  meetingNotes: [],
  reports: [],
  updatedAt: new Date(0).toISOString(),
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function makeResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildApiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota/storage failures and continue app execution.
  }
}

function dispatch(name: string, detail?: Record<string, unknown>): void {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function normalizeCache(cache: Partial<OfflineAppCache>): OfflineAppCache {
  return {
    tasks: Array.isArray(cache.tasks) ? cache.tasks : [],
    projects: Array.isArray(cache.projects) ? cache.projects : [],
    labels: Array.isArray(cache.labels) ? cache.labels : [],
    risks: Array.isArray(cache.risks) ? cache.risks : [],
    approvals: Array.isArray(cache.approvals) ? cache.approvals : [],
    scopeChanges: Array.isArray(cache.scopeChanges) ? cache.scopeChanges : [],
    decisionLogs: Array.isArray(cache.decisionLogs) ? cache.decisionLogs : [],
    meetingNotes: Array.isArray(cache.meetingNotes) ? cache.meetingNotes : [],
    reports: Array.isArray(cache.reports) ? cache.reports : [],
    updatedAt: cache.updatedAt ?? new Date().toISOString(),
  };
}

export function isOnline(): boolean {
  if (!isBrowser()) {
    return true;
  }

  return window.navigator.onLine;
}

export function getOfflineCache(): OfflineAppCache {
  return normalizeCache(readJson<OfflineAppCache>(CACHE_KEY, DEFAULT_CACHE));
}

export function setOfflineCache(
  partial: Partial<OfflineAppCache>,
  options: { silent?: boolean } = {},
): OfflineAppCache {
  const next = normalizeCache({
    ...getOfflineCache(),
    ...partial,
    updatedAt: new Date().toISOString(),
  });

  writeJson(CACHE_KEY, next);
  if (!options.silent) {
    dispatch("offline-tasks:cache-updated", { updatedAt: next.updatedAt });
  }
  return next;
}

export function getOfflineTaskQueue(): OfflineTaskMutation[] {
  return readJson<OfflineTaskMutation[]>(QUEUE_KEY, []);
}

function setOfflineTaskQueue(queue: OfflineTaskMutation[]): OfflineTaskMutation[] {
  writeJson(QUEUE_KEY, queue);
  dispatch("offline-tasks:queue-changed", { pending: queue.length });
  return queue;
}

export function hasPendingTaskMutations(): boolean {
  return getOfflineTaskQueue().length > 0;
}

export function getPendingTaskMutationsCount(): number {
  return getOfflineTaskQueue().length;
}

export function getOldestPendingTaskMutationAt(): string | null {
  const queue = getOfflineTaskQueue();
  return queue[0]?.createdAt ?? null;
}

export function getOfflineDataForPath(path: string): Response | null {
  const cache = getOfflineCache();

  switch (path) {
    case "/api/tasks":
      return makeResponse(cache.tasks);
    case "/api/projects":
      return makeResponse(cache.projects);
    case "/api/labels":
      return makeResponse(cache.labels);
    case "/api/risks":
      return makeResponse(cache.risks);
    case "/api/approvals":
      return makeResponse(cache.approvals);
    case "/api/scope-changes":
      return makeResponse(cache.scopeChanges);
    case "/api/decision-logs":
      return makeResponse(cache.decisionLogs);
    case "/api/meeting-notes":
      return makeResponse(cache.meetingNotes);
    case "/api/status-reports":
      return makeResponse(cache.reports);
    case "/api/stats":
      return makeResponse(buildOfflineStats(cache.tasks));
    default:
      return null;
  }
}

function buildOfflineStats(tasks: Task[]) {
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks.filter(
    (task) => !task.isDeleted && !!task.dueDate && task.dueDate.slice(0, 10) === today,
  );

  const completedToday = todayTasks.filter((task) => task.completed).length;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    completedToday,
    totalToday: todayTasks.length,
    streak: 0,
    weeklyData: days.map((day) => ({ day, count: 0 })),
  };
}

function makeTempTask(payload: Record<string, unknown>): Task {
  const cache = getOfflineCache();
  const tempId = `offline-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const inboxProject = cache.projects.find((project) => Boolean(project.isInbox));
  const resolvedProjectId =
    typeof payload.projectId === "string"
      ? payload.projectId
      : (typeof inboxProject?.id === "string" ? inboxProject.id : null);

  const project = cache.projects.find((item) => item.id === resolvedProjectId) ?? null;

  return {
    id: tempId,
    title: String(payload.title ?? "Untitled task"),
    notes: typeof payload.notes === "string" ? payload.notes : null,
    dueDate: typeof payload.dueDate === "string" ? payload.dueDate : null,
    dueTime: typeof payload.dueTime === "string" ? payload.dueTime : null,
    priority: (Number(payload.priority ?? 4) as 1 | 2 | 3 | 4),
    completed: false,
    completedAt: null,
    isDeleted: false,
    sortOrder: Date.now(),
    userId: "offline",
    projectId: resolvedProjectId,
    parentId: typeof payload.parentId === "string" ? payload.parentId : null,
    depth: typeof payload.depth === "number" ? payload.depth : 0,
    recurrenceRule: typeof payload.recurrenceRule === "string" ? payload.recurrenceRule : null,
    recurrenceInterval:
      typeof payload.recurrenceInterval === "number" ? payload.recurrenceInterval : null,
    recurrenceDays: typeof payload.recurrenceDays === "string" ? payload.recurrenceDays : null,
    recurrenceEndDate:
      typeof payload.recurrenceEndDate === "string" ? payload.recurrenceEndDate : null,
    estimatedHours:
      typeof payload.estimatedHours === "number" ? payload.estimatedHours : null,
    status: typeof payload.status === "string" ? payload.status : "TODO",
    kanbanColumnId:
      typeof payload.kanbanColumnId === "string" ? payload.kanbanColumnId : null,
    sprintId: typeof payload.sprintId === "string" ? payload.sprintId : null,
    createdAt: now,
    updatedAt: now,
    project: project as Task["project"],
    labels: [],
    subtasks: [],
    blockedBy: [],
    blocking: [],
    timeLogs: [],
    milestones: [],
  };
}

function applyPatchToTask(task: Task, payload: Record<string, unknown>): Task {
  const completed =
    typeof payload.completed === "boolean" ? payload.completed : task.completed;

  return {
    ...task,
    ...payload,
    priority: payload.priority !== undefined ? (Number(payload.priority) as 1 | 2 | 3 | 4) : task.priority,
    estimatedHours:
      payload.estimatedHours !== undefined
        ? (payload.estimatedHours === null ? null : Number(payload.estimatedHours))
        : task.estimatedHours,
    completed,
    completedAt:
      payload.completed !== undefined
        ? (completed ? new Date().toISOString() : null)
        : task.completedAt,
    updatedAt: new Date().toISOString(),
  };
}

function enqueueTaskMutation(mutation: OfflineTaskMutation): OfflineTaskMutation[] {
  const queue = getOfflineTaskQueue();

  if (mutation.kind === "patch") {
    const existingIndex = queue.findIndex(
      (entry) => entry.kind === "patch" && entry.taskId === mutation.taskId,
    );

    if (existingIndex >= 0) {
      const existing = queue[existingIndex] as PatchTaskMutation;
      queue[existingIndex] = {
        ...existing,
        payload: { ...existing.payload, ...mutation.payload },
        createdAt: new Date().toISOString(),
      };
      return setOfflineTaskQueue(queue);
    }
  }

  if (mutation.kind === "delete") {
    const createIndex = queue.findIndex(
      (entry) => entry.kind === "create" && entry.tempId === mutation.taskId,
    );

    if (createIndex >= 0) {
      const filtered = queue.filter((entry, index) => {
        if (index === createIndex) return false;
        if (entry.kind === "patch" && entry.taskId === mutation.taskId) return false;
        return true;
      });
      return setOfflineTaskQueue(filtered);
    }
  }

  return setOfflineTaskQueue([...queue, mutation]);
}

export async function handleOfflineTaskRequest(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  const method = (init?.method ?? "GET").toUpperCase();
  const cache = getOfflineCache();

  if (method === "POST" && path === "/api/tasks") {
    const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const optimisticTask = makeTempTask(payload);

    setOfflineCache({ tasks: [optimisticTask, ...cache.tasks] }, { silent: true });
    enqueueTaskMutation({
      queueId: crypto.randomUUID(),
      kind: "create",
      tempId: optimisticTask.id,
      payload,
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });
    dispatch("offline-tasks:queued", { kind: "create", taskId: optimisticTask.id });
    return makeResponse(optimisticTask, 202);
  }

  const match = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (!match) {
    return null;
  }

  const taskId = decodeURIComponent(match[1]);

  if (method === "PATCH") {
    const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const tasks = cache.tasks.map((task) =>
      task.id === taskId ? applyPatchToTask(task, payload) : task,
    );
    const updatedTask = tasks.find((task) => task.id === taskId) ?? null;

    setOfflineCache({ tasks }, { silent: true });
    enqueueTaskMutation({
      queueId: crypto.randomUUID(),
      kind: "patch",
      taskId,
      payload,
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });
    dispatch("offline-tasks:queued", { kind: "patch", taskId });
    return makeResponse(updatedTask ?? { success: true }, 202);
  }

  if (method === "DELETE") {
    const tasks = cache.tasks.filter((task) => task.id !== taskId);
    setOfflineCache({ tasks }, { silent: true });
    enqueueTaskMutation({
      queueId: crypto.randomUUID(),
      kind: "delete",
      taskId,
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });
    dispatch("offline-tasks:queued", { kind: "delete", taskId });
    return makeResponse({ success: true }, 202);
  }

  return null;
}

export async function updateOfflineCacheFromResponse(
  path: string,
  response: Response,
): Promise<Response> {
  const clone = response.clone();

  try {
    const data = await clone.json();
    switch (path) {
      case "/api/tasks":
        if (Array.isArray(data)) setOfflineCache({ tasks: data }, { silent: true });
        break;
      case "/api/projects":
        if (Array.isArray(data)) setOfflineCache({ projects: data }, { silent: true });
        break;
      case "/api/labels":
        if (Array.isArray(data)) setOfflineCache({ labels: data }, { silent: true });
        break;
      case "/api/risks":
        if (Array.isArray(data)) setOfflineCache({ risks: data }, { silent: true });
        break;
      case "/api/approvals":
        if (Array.isArray(data)) setOfflineCache({ approvals: data }, { silent: true });
        break;
      case "/api/scope-changes":
        if (Array.isArray(data)) setOfflineCache({ scopeChanges: data }, { silent: true });
        break;
      case "/api/decision-logs":
        if (Array.isArray(data)) setOfflineCache({ decisionLogs: data }, { silent: true });
        break;
      case "/api/meeting-notes":
        if (Array.isArray(data)) setOfflineCache({ meetingNotes: data }, { silent: true });
        break;
      case "/api/status-reports":
        if (Array.isArray(data)) setOfflineCache({ reports: data }, { silent: true });
        break;
      default:
        break;
    }
  } catch {
    // Ignore non-JSON responses.
  }

  return response;
}

export async function updateOfflineCacheAfterMutation(
  path: string,
  method: string,
  response: Response,
): Promise<Response> {
  const clone = response.clone();
  const cache = getOfflineCache();

  try {
    const data = await clone.json();

    if (method === "POST" && path === "/api/tasks" && data && typeof data === "object") {
      const createdTask = data as Task;
      const dedupedTasks = cache.tasks.filter((task) => task.id !== createdTask.id);
      setOfflineCache({ tasks: [createdTask, ...dedupedTasks] }, { silent: true });
      return response;
    }

    const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
    if (!taskMatch) {
      return response;
    }

    const taskId = decodeURIComponent(taskMatch[1]);

    if (method === "PATCH" && data && typeof data === "object") {
      const updatedTask = data as Task;
      setOfflineCache(
        {
          tasks: cache.tasks.map((task) => (task.id === taskId ? updatedTask : task)),
        },
        { silent: true },
      );
      return response;
    }

    if (method === "DELETE") {
      setOfflineCache(
        {
          tasks: cache.tasks.filter((task) => task.id !== taskId),
        },
        { silent: true },
      );
    }
  } catch {
    // Ignore non-JSON responses.
  }

  return response;
}

async function requestJson(
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(buildApiUrl(path), init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

const MAX_RETRY_ATTEMPTS = 5;

export async function flushOfflineTaskQueue(): Promise<FlushQueueResult> {
  const queue = getOfflineTaskQueue();
  if (!queue.length || !isOnline()) {
    return { syncedCount: 0, failedCount: queue.length, hadChanges: false };
  }

  const nextQueue = [...queue];
  const taskIdMap = new Map<string, string>();
  let syncedCount = 0;

  while (nextQueue.length > 0) {
    const mutation = nextQueue[0];

    // Skip mutations that exceeded retry limit
    if (mutation.attemptCount >= MAX_RETRY_ATTEMPTS) {
      dispatch("offline-tasks:dead-letter", { queueId: mutation.queueId, kind: mutation.kind });
      nextQueue.shift();
      continue;
    }

    // Update retry metadata
    mutation.attemptCount += 1;
    mutation.lastAttemptAt = new Date().toISOString();

    try {
      if (mutation.kind === "create") {
        const created = await requestJson("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mutation.payload),
        });

        if (typeof created?.id === "string") {
          taskIdMap.set(mutation.tempId, created.id);
        }
      }

      if (mutation.kind === "patch") {
        const resolvedId = taskIdMap.get(mutation.taskId) ?? mutation.taskId;
        await requestJson(`/api/tasks/${resolvedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mutation.payload),
        });
      }

      if (mutation.kind === "delete") {
        const resolvedId = taskIdMap.get(mutation.taskId) ?? mutation.taskId;
        const response = await fetch(buildApiUrl(`/api/tasks/${resolvedId}`), {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error(`Delete failed: ${response.status}`);
        }
      }

      mutation.lastError = null;
      nextQueue.shift();
      syncedCount += 1;
    } catch (err) {
      mutation.lastError =
        err instanceof Error ? err.message : "Unknown sync error";
      // Save current state and stop — will retry next time
      break;
    }
  }

  setOfflineTaskQueue(nextQueue);

  const result = {
    syncedCount,
    failedCount: nextQueue.length,
    hadChanges: syncedCount > 0,
  };

  if (syncedCount > 0) {
    dispatch("offline-tasks:synced", result);
  }

  if (nextQueue.length > 0) {
    dispatch("offline-tasks:sync-failed", result);
  }

  return result;
}

export function getOfflineQueueDiagnostics(): OfflineQueueDiagnostics {
  const queue = getOfflineTaskQueue();
  const failed = queue.filter((m) => m.attemptCount > 0 && m.lastError !== null);
  return {
    totalPending: queue.length,
    totalFailed: failed.length,
    oldestAt: queue[0]?.createdAt ?? null,
    lastError: failed[failed.length - 1]?.lastError ?? null,
  };
}

export function clearOfflineQueue(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(QUEUE_KEY);
  dispatch("offline-tasks:queue-changed", { pending: 0 });
}

export function requestManualSync(): void {
  dispatch("offline-tasks:manual-sync");
}
