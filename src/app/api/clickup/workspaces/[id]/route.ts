/**
 * GET /api/clickup/workspaces/[id]
 * Returns workspace structure (spaces + lists) for a specific workspace connection.
 * [id] is the ClickUpWorkspaceConnection.id
 *
 * PATCH /api/clickup/workspaces/[id]
 * Updates syncEnabled or isActive for a workspace connection.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { clickUpWorkspaceConnections, clickUpConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ClickUpClient } from "@/lib/clickup";

export const dynamic = "force-dynamic";

// In-memory cache: key = workspaceConnectionId, value = { data, expiresAt }
const structureCache = new Map<string, { data: unknown; expiresAt: number }>();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the workspace connection
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
    .where(eq(clickUpWorkspaceConnections.id, id))
    .limit(1);

  if (!workspaceConn || workspaceConn.userId !== session.user.id) {
    return NextResponse.json({ error: "Workspace connection not found" }, { status: 404 });
  }

  if (!workspaceConn.isActive) {
    return NextResponse.json({ error: "Workspace connection is inactive" }, { status: 400 });
  }

  const noCache = req.nextUrl.searchParams.get("refresh") === "1";
  const cached = structureCache.get(id);
  if (!noCache && cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const client = new ClickUpClient(workspaceConn.connectionAccessToken);
    const structure = await client.getWorkspaceStructure(workspaceConn.teamId);

    const result = {
      workspaceConnectionId: id,
      workspace: { id: structure.workspace.id, name: structure.workspace.name },
      spaces: structure.spaces.map((s) => ({
        id: s.id,
        name: s.name,
        // Folderless lists in this space
        lists: s.lists
          .filter((l) => l.folder?.hidden !== false || !l.folder?.id)
          .map((l) => ({
            id: l.id,
            name: l.name,
            taskCount: l.task_count ?? 0,
            folderId: l.folder?.hidden === false ? l.folder?.id : null,
            folderName: l.folder?.hidden === false ? l.folder?.name : null,
          })),
        // Folders with their lists
        folders: (s.folders ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          taskCount: f.task_count ?? 0,
          lists: (f.lists ?? []).map((l) => ({
            id: l.id,
            name: l.name,
            taskCount: l.task_count ?? 0,
          })),
        })),
        // All lists (flat, for backward compat)
        allLists: s.lists.map((l) => ({
          id: l.id,
          name: l.name,
          taskCount: l.task_count ?? 0,
          folderId: l.folder?.id ?? null,
          folderName: l.folder?.name ?? null,
        })),
        totalTasks: s.lists.reduce((acc, l) => acc + (l.task_count ?? 0), 0),
      })),
      totalLists: structure.totalLists,
    };

    structureCache.set(id, { data: result, expiresAt: Date.now() + 5 * 60 * 1000 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ClickUp Workspace Structure]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch workspace structure" },
      { status: 500 }
    );
  }
}

// ─── PATCH: Toggle syncEnabled / isActive ───────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [workspaceConn] = await db
    .select()
    .from(clickUpWorkspaceConnections)
    .where(eq(clickUpWorkspaceConnections.id, id))
    .limit(1);

  if (!workspaceConn || workspaceConn.userId !== session.user.id) {
    return NextResponse.json({ error: "Workspace connection not found" }, { status: 404 });
  }

  let body: { syncEnabled?: boolean; isActive?: boolean } = {};
  try { body = await req.json(); } catch { /* ok */ }

  try {
    const [updated] = await db
      .update(clickUpWorkspaceConnections)
      .set({
        ...(typeof body.syncEnabled === "boolean" ? { syncEnabled: body.syncEnabled } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      })
      .where(eq(clickUpWorkspaceConnections.id, id))
      .returning();
    return NextResponse.json({ success: true, workspace: updated });
  } catch (err) {
    console.error("[ClickUp Patch Workspace]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
