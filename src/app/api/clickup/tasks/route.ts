/**
 * GET /api/clickup/tasks
 * Read-only: fetch tasks from ClickUp API for a given workspace connection.
 * Returns normalized tasks directly from ClickUp — nothing is saved to FlowFocus DB.
 *
 * Query params:
 *   workspaceConnectionId: string (required)
 *   spaceIds: comma-separated space IDs (optional, empty = all)
 *   includeClosed: "true" | "false" (optional, default false)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { clickUpWorkspaceConnections, clickUpConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ClickUpClient, normalizeTask, buildWorkspaceStats } from "@/lib/clickup";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceConnectionId = req.nextUrl.searchParams.get("workspaceConnectionId");
  if (!workspaceConnectionId) {
    return NextResponse.json({ error: "workspaceConnectionId is required" }, { status: 400 });
  }

  const [workspaceConn] = await db
    .select({
      id: clickUpWorkspaceConnections.id,
      userId: clickUpWorkspaceConnections.userId,
      teamId: clickUpWorkspaceConnections.teamId,
      isActive: clickUpWorkspaceConnections.isActive,
      connectionAccessToken: clickUpConnections.accessToken,
    })
    .from(clickUpWorkspaceConnections)
    .innerJoin(clickUpConnections, eq(clickUpWorkspaceConnections.connectionId, clickUpConnections.id))
    .where(eq(clickUpWorkspaceConnections.id, workspaceConnectionId))
    .limit(1);

  if (!workspaceConn || workspaceConn.userId !== session.user.id) {
    return NextResponse.json({ error: "Workspace connection not found" }, { status: 404 });
  }

  if (!workspaceConn.isActive) {
    return NextResponse.json({ error: "Workspace connection is inactive" }, { status: 400 });
  }

  const spaceIdsParam = req.nextUrl.searchParams.get("spaceIds") ?? "";
  const spaceIds = spaceIdsParam ? spaceIdsParam.split(",").filter(Boolean) : [];
  const includeClosed = req.nextUrl.searchParams.get("includeClosed") === "true";

  try {
    const client = new ClickUpClient(workspaceConn.connectionAccessToken);
    const { tasks: rawTasks, spaceMap } = await client.fetchTasksForSpaces(
      workspaceConn.teamId,
      spaceIds,
      { includeClosed }
    );

    // Normalize tasks for the UI
    const tasks = rawTasks.map((raw) => {
      const normalized = normalizeTask(raw);
      return {
        ...normalized,
        dueDate: normalized.dueDate?.toISOString() ?? null,
        spaceId: raw._spaceId,
        spaceName: spaceMap.get(raw._spaceId)?.name ?? "",
        description: raw.description ?? null,
      };
    });

    // Build stats summary
    const stats = buildWorkspaceStats(rawTasks.map(normalizeTask));

    // Build space summary
    const spaces = Array.from(spaceMap.entries()).map(([id, space]) => ({
      id,
      name: space.name,
      taskCount: tasks.filter((t) => t.spaceId === id).length,
    }));

    return NextResponse.json({
      tasks,
      stats,
      spaces,
      totalTasks: tasks.length,
    });
  } catch (err) {
    console.error("[ClickUp Tasks]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
