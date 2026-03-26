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
import { prisma } from "@/lib/prisma";

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
      await prisma.clickUpConnection.delete({
        where: { userId: session.user.id },
      });
      return NextResponse.json({ success: true, message: "Fully disconnected from ClickUp" });
    }

    // Disconnect specific workspace
    if (body.workspaceConnectionId) {
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

      return NextResponse.json({ success: true, message: `Disconnected from ${workspaceConn.teamName}` });
    }

    // No parameters: disconnect all workspaces but keep token
    await prisma.clickUpWorkspaceConnection.updateMany({
      where: { userId: session.user.id, isActive: true },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "Disconnected from all workspaces" });
  } catch (err) {
    console.error("[ClickUp Disconnect]", err);
    const msg = err instanceof Error ? err.message : "Failed to disconnect";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
