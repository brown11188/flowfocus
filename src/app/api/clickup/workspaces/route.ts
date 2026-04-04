/**
 * GET /api/clickup/workspaces
 * Returns available workspaces from ClickUp API and current connections.
 * POST /api/clickup/workspaces
 * Adds a new workspace connection.
 * DELETE /api/clickup/workspaces
 * Removes a workspace connection.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { clickUpConnections, clickUpWorkspaceConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ClickUpClient } from "@/lib/clickup";

export const dynamic = "force-dynamic";

// In-memory cache for workspace list (5 minutes)
const workspaceListCache = new Map<string, { data: unknown; expiresAt: number }>();

// ─── GET: Fetch available workspaces ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [connection] = await db
    .select()
    .from(clickUpConnections)
    .where(eq(clickUpConnections.userId, session.user.id))
    .limit(1);

  if (!connection) {
    return NextResponse.json({ error: "No ClickUp connection" }, { status: 404 });
  }

  const noCache = req.nextUrl.searchParams.get("refresh") === "1";
  const cached = workspaceListCache.get(connection.id);
  if (!noCache && cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const client = new ClickUpClient(connection.accessToken);
    const workspaces = await client.getWorkspaces();

    const existingConnections = await db
      .select({ teamId: clickUpWorkspaceConnections.teamId, isActive: clickUpWorkspaceConnections.isActive })
      .from(clickUpWorkspaceConnections)
      .where(eq(clickUpWorkspaceConnections.userId, session.user.id));

    const connectedTeamIds = new Set(existingConnections.map((c) => c.teamId));

    const result = {
      available: workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        color: ws.color ?? null,
        avatar: ws.avatar ?? null,
        memberCount: ws.members?.length ?? 0,
        isConnected: connectedTeamIds.has(ws.id),
      })),
      connected: existingConnections.filter((c) => c.isActive).map((c) => c.teamId),
    };

    workspaceListCache.set(connection.id, { data: result, expiresAt: Date.now() + 5 * 60 * 1000 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ClickUp Workspaces]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}

// ─── POST: Add workspace connection ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [connection] = await db
    .select()
    .from(clickUpConnections)
    .where(eq(clickUpConnections.userId, session.user.id))
    .limit(1);

  if (!connection) {
    return NextResponse.json({ error: "No ClickUp connection" }, { status: 404 });
  }

  let body: { teamId?: string; teamName?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  if (!body.teamId || !body.teamName) {
    return NextResponse.json({ error: "teamId and teamName are required" }, { status: 400 });
  }

  try {
    const [existing] = await db
      .select()
      .from(clickUpWorkspaceConnections)
      .where(and(eq(clickUpWorkspaceConnections.userId, session.user.id), eq(clickUpWorkspaceConnections.teamId, body.teamId)))
      .limit(1);

    if (existing) {
      if (!existing.isActive) {
        await db
          .update(clickUpWorkspaceConnections)
          .set({ isActive: true })
          .where(eq(clickUpWorkspaceConnections.id, existing.id));
      }
      return NextResponse.json({ success: true, workspace: existing });
    }

    const [workspaceConn] = await db.insert(clickUpWorkspaceConnections).values({
      connectionId: connection.id,
      userId: session.user.id,
      teamId: body.teamId,
      teamName: body.teamName,
      isActive: true,
      syncEnabled: true,
    }).returning();

    return NextResponse.json({ success: true, workspace: workspaceConn });
  } catch (err) {
    console.error("[ClickUp Add Workspace]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add workspace" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove workspace connection ─────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { workspaceConnectionId?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  if (!body.workspaceConnectionId) {
    return NextResponse.json({ error: "workspaceConnectionId is required" }, { status: 400 });
  }

  try {
    const [workspaceConn] = await db
      .select()
      .from(clickUpWorkspaceConnections)
      .where(eq(clickUpWorkspaceConnections.id, body.workspaceConnectionId))
      .limit(1);

    if (!workspaceConn || workspaceConn.userId !== session.user.id) {
      return NextResponse.json({ error: "Workspace connection not found" }, { status: 404 });
    }

    await db
      .update(clickUpWorkspaceConnections)
      .set({ isActive: false })
      .where(eq(clickUpWorkspaceConnections.id, body.workspaceConnectionId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ClickUp Remove Workspace]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove workspace" },
      { status: 500 }
    );
  }
}
