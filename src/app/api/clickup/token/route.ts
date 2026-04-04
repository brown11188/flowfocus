/**
 * POST /api/clickup/token
 * Save a Personal API Token and create workspace connection(s).
 * Body: { token: string; workspaces: { id: string; name: string }[] }
 *
 * This creates:
 *  - ClickUpConnection (holds the token)
 *  - ClickUpWorkspaceConnection for each selected workspace
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clickUpConnections, clickUpWorkspaceConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { token?: string; workspaces?: Array<{ id: string; name: string }> } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const token = body.token?.trim();
  const workspaces = body.workspaces ?? [];

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  if (workspaces.length === 0) {
    return NextResponse.json({ error: "At least one workspace must be selected" }, { status: 400 });
  }

  try {
    // Upsert the main connection (holds the token)
    const [connection] = await db
      .insert(clickUpConnections)
      .values({
        userId: session.user.id,
        accessToken: token,
        tokenType: "Bearer",
      })
      .onConflictDoUpdate({
        target: clickUpConnections.userId,
        set: {
          accessToken: token,
          tokenType: "Bearer",
          updatedAt: new Date(),
        },
      })
      .returning();

    // Create workspace connections for each selected workspace
    const createdWorkspaces = [];
    for (const ws of workspaces) {
      const [workspaceConn] = await db
        .insert(clickUpWorkspaceConnections)
        .values({
          connectionId: connection.id,
          userId: session.user.id,
          teamId: ws.id,
          teamName: ws.name,
          isActive: true,
          syncEnabled: true,
        })
        .onConflictDoUpdate({
          target: [clickUpWorkspaceConnections.userId, clickUpWorkspaceConnections.teamId],
          set: {
            teamName: ws.name,
            isActive: true,
            updatedAt: new Date(),
          },
        })
        .returning();
      createdWorkspaces.push({ id: workspaceConn.id, teamId: ws.id, name: ws.name });
    }

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      workspaces: createdWorkspaces,
    });
  } catch (err) {
    console.error("[ClickUp Token]", err);
    const msg = err instanceof Error ? err.message : "Failed to save connection";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
