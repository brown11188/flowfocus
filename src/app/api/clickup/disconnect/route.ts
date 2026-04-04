/**
 * DELETE /api/clickup/disconnect
 * Disconnects ClickUp integration.
 * Body: { workspaceConnectionId?: string, full?: boolean }
 *
 * - If workspaceConnectionId is provided: disconnects only that workspace
 * - If full=true: disconnects everything (token + all workspaces)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { clickUpConnections, clickUpWorkspaceConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { workspaceConnectionId?: string; full?: boolean } = {};
  try { body = await req.json(); } catch { /* ok */ }

  try {
    // Full disconnect: remove token and all workspace connections
    if (body.full) {
      await db.delete(clickUpConnections).where(eq(clickUpConnections.userId, session.user.id));
      return NextResponse.json({ success: true, message: "Fully disconnected from ClickUp" });
    }

    // Disconnect specific workspace
    if (body.workspaceConnectionId) {
      const [workspaceConn] = await db
        .select()
        .from(clickUpWorkspaceConnections)
        .where(eq(clickUpWorkspaceConnections.id, body.workspaceConnectionId))
        .limit(1);

      if (!workspaceConn || workspaceConn.userId !== session.user.id) {
        return NextResponse.json({ error: "Workspace connection not found" }, { status: 404 });
      }

      // Soft delete (deactivate)
      await db
        .update(clickUpWorkspaceConnections)
        .set({ isActive: false })
        .where(eq(clickUpWorkspaceConnections.id, body.workspaceConnectionId));

      return NextResponse.json({ success: true, message: `Disconnected from ${workspaceConn.teamName}` });
    }

    // No parameters: disconnect all workspaces but keep token
    await db
      .update(clickUpWorkspaceConnections)
      .set({ isActive: false })
      .where(and(eq(clickUpWorkspaceConnections.userId, session.user.id), eq(clickUpWorkspaceConnections.isActive, true)));

    return NextResponse.json({ success: true, message: "Disconnected from all workspaces" });
  } catch (err) {
    console.error("[ClickUp Disconnect]", err);
    const msg = err instanceof Error ? err.message : "Failed to disconnect";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
