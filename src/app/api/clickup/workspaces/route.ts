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
import { prisma } from "@/lib/prisma";
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

  const connection = await prisma.clickUpConnection.findUnique({
    where: { userId: session.user.id },
  });

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

    // Get current workspace connections
    const existingConnections = await prisma.clickUpWorkspaceConnection.findMany({
      where: { userId: session.user.id },
      select: { teamId: true, isActive: true },
    });

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

  const connection = await prisma.clickUpConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection) {
    return NextResponse.json({ error: "No ClickUp connection" }, { status: 404 });
  }

  let body: { teamId?: string; teamName?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  if (!body.teamId || !body.teamName) {
    return NextResponse.json({ error: "teamId and teamName are required" }, { status: 400 });
  }

  try {
    // Check if already exists
    const existing = await prisma.clickUpWorkspaceConnection.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId: body.teamId } },
    });

    if (existing) {
      // Reactivate if inactive
      if (!existing.isActive) {
        await prisma.clickUpWorkspaceConnection.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      return NextResponse.json({ success: true, workspace: existing });
    }

    // Create new workspace connection
    const workspaceConn = await prisma.clickUpWorkspaceConnection.create({
      data: {
        connectionId: connection.id,
        userId: session.user.id,
        teamId: body.teamId,
        teamName: body.teamName,
        isActive: true,
        syncEnabled: true,
      },
    });

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
    // Verify ownership
    const workspaceConn = await prisma.clickUpWorkspaceConnection.findUnique({
      where: { id: body.workspaceConnectionId },
    });

    if (!workspaceConn || workspaceConn.userId !== session.user.id) {
      return NextResponse.json({ error: "Workspace connection not found" }, { status: 404 });
    }

    // Soft delete (deactivate)
    await prisma.clickUpWorkspaceConnection.update({
      where: { id: body.workspaceConnectionId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ClickUp Remove Workspace]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove workspace" },
      { status: 500 }
    );
  }
}
