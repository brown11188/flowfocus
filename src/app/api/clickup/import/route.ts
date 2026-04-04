/**
 * POST /api/clickup/import
 * 1-way import: fetch tasks from selected ClickUp spaces → upsert into FlowFocus DB.
 *
 * Body: {
 *   workspaceConnectionId: string  // Required: which workspace connection to import from
 *   spaceIds: string[]              // Empty = all spaces
 *   includeClosed?: boolean
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clickUpWorkspaceConnections, projects, tasks } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { ClickUpClient } from "@/lib/clickup";

export const dynamic = "force-dynamic";

const CU_PRIORITY: Record<string, number> = {
  "1": 1, "2": 2, "3": 3, "4": 4,
};

const SPACE_COLORS = [
  "#7B68EE", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

// Rate limit: max 3 imports per 15 minutes per user
const importCounts: Record<string, { count: number; resetAt: number }> = {};
function checkImportLimit(userId: string): boolean {
  const now = Date.now();
  const e = importCounts[userId];
  if (!e || now > e.resetAt) {
    importCounts[userId] = { count: 1, resetAt: now + 15 * 60 * 1000 };
    return true;
  }
  if (e.count >= 3) return false;
  e.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkImportLimit(session.user.id)) {
    return NextResponse.json(
      { error: "Rate limit: max 3 imports per 15 minutes." },
      { status: 429 }
    );
  }

  let body: { workspaceConnectionId?: string; spaceIds?: string[]; includeClosed?: boolean } = {};
  try { body = await req.json(); } catch { /* ok */ }

  if (!body.workspaceConnectionId) {
    return NextResponse.json({ error: "workspaceConnectionId is required" }, { status: 400 });
  }

  // Get the workspace connection with its parent connection (for the access token)
  const workspaceConn = await db.query.clickUpWorkspaceConnections.findFirst({
    where: (w, { eq }) => eq(w.id, body.workspaceConnectionId!),
    with: { connection: true },
  });

  if (!workspaceConn || workspaceConn.userId !== session.user.id) {
    return NextResponse.json({ error: "Workspace connection not found" }, { status: 404 });
  }

  if (!workspaceConn.isActive) {
    return NextResponse.json({ error: "Workspace connection is inactive" }, { status: 400 });
  }

  const spaceIds: string[] = body.spaceIds ?? [];
  const includeClosed = body.includeClosed ?? false;

  const errors: string[] = [];
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let projectsCreated = 0;
  let projectsReused = 0;
  const spacesSynced: string[] = [];

  try {
    const client = new ClickUpClient(workspaceConn.connection.accessToken);
    const { tasks: rawTasks, spaceMap } = await client.fetchTasksForSpaces(
      workspaceConn.teamId,
      spaceIds,
      { includeClosed }
    );

    if (rawTasks.length === 0) {
      return NextResponse.json({
        importedCount: 0, updatedCount: 0, skippedCount: 0,
        projectsCreated: 0, projectsReused: 0,
        spacesSynced: [], errors: [],
        message: "No tasks found in the selected spaces.",
      });
    }

    // Ensure a FlowFocus Project exists for each space
    const projectBySpaceId = new Map<string, string>();
    let colorIndex = 0;

    for (const [spaceId, space] of spaceMap.entries()) {
      const existing = await db.query.projects.findFirst({
        where: (p, { and, eq }) => and(
          eq(p.userId, session.user.id),
          eq(p.clickupSpaceId, spaceId)
        ),
      });

      if (existing) {
        projectBySpaceId.set(spaceId, existing.id);
        projectsReused++;
      } else {
        const color = SPACE_COLORS[colorIndex % SPACE_COLORS.length];
        colorIndex++;
        const [created] = await db
          .insert(projects)
          .values({
            name: space.name,
            color,
            userId: session.user.id,
            isInbox: false,
            clickupSpaceId: spaceId,
            clickupSpaceName: space.name,
            clickupTeamId: workspaceConn.teamId,
            clickupWorkspaceConnectionId: workspaceConn.id,
          })
          .returning();
        projectBySpaceId.set(spaceId, created.id);
        projectsCreated++;
      }
      spacesSynced.push(space.name);
    }

    // Load existing clickupTaskIds for this user
    const existingTasks = await db
      .select({ id: tasks.id, clickupTaskId: tasks.clickupTaskId, notes: tasks.notes })
      .from(tasks)
      .where(and(eq(tasks.userId, session.user.id), isNotNull(tasks.clickupTaskId)));
    const existingMap = new Map(existingTasks.map((t) => [t.clickupTaskId!, t]));

    const now = new Date();

    for (const raw of rawTasks) {
      try {
        const spaceId = raw._spaceId;
        const projectId = projectBySpaceId.get(spaceId);
        if (!projectId) continue;

        const title = raw.name?.trim();
        if (!title) continue;

        const dueDate = raw.due_date ? new Date(parseInt(raw.due_date, 10)) : null;
        const priorityId = raw.priority?.id ?? "4";
        const priority = CU_PRIORITY[priorityId] ?? 4;

        const statusType = raw.status?.type ?? "";
        const ffStatus =
          statusType === "closed" || statusType === "done" ? "DONE" :
          statusType === "active" ? "IN_PROGRESS" : "TODO";

        const isCompleted =
          statusType === "closed" ||
          raw.status?.status?.toLowerCase() === "complete" ||
          raw.status?.status?.toLowerCase() === "done";

        const assigneesJson = JSON.stringify(
          (raw.assignees ?? []).map((a) => a.username || a.email)
        );

        const existing = existingMap.get(raw.id);

        if (existing) {
          await db
            .update(tasks)
            .set({
              title,
              dueDate,
              priority,
              status: ffStatus,
              completed: isCompleted,
              completedAt: isCompleted ? now : null,
              clickupStatus: raw.status?.status ?? null,
              clickupAssignees: assigneesJson,
              clickupUrl: raw.url ?? null,
              importedAt: now,
            })
            .where(eq(tasks.id, existing.id));
          updatedCount++;
        } else {
          await db.insert(tasks).values({
            title,
            notes: raw.description ?? null,
            dueDate,
            priority,
            status: ffStatus,
            completed: isCompleted,
            completedAt: isCompleted ? now : null,
            userId: session.user.id,
            projectId,
            clickupTaskId: raw.id,
            clickupListId: raw.list?.id ?? null,
            clickupSpaceId: spaceId,
            clickupUrl: raw.url ?? null,
            clickupStatus: raw.status?.status ?? null,
            clickupAssignees: assigneesJson,
            importedAt: now,
          });
          importedCount++;
        }
      } catch (taskErr) {
        const msg = taskErr instanceof Error ? taskErr.message : String(taskErr);
        errors.push(`Task "${raw.name}": ${msg}`);
        skippedCount++;
      }
    }

    // Update lastSyncedAt
    await db
      .update(clickUpWorkspaceConnections)
      .set({ lastSyncedAt: now })
      .where(eq(clickUpWorkspaceConnections.id, workspaceConn.id));

    return NextResponse.json({
      importedCount,
      updatedCount,
      skippedCount,
      projectsCreated,
      projectsReused,
      spacesSynced: [...new Set(spacesSynced)],
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    console.error("[ClickUp Import]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}

