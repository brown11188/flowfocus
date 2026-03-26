/**
 * GET /api/clickup/status
 * Returns all ClickUp workspace connections for the user.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the main connection (holds the token)
  const connection = await prisma.clickUpConnection.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!connection) {
    return NextResponse.json({ connection: null, workspaces: [] });
  }

  // Get all workspace connections for this user
  const workspaces = await prisma.clickUpWorkspaceConnection.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isActive: "desc" }, { teamName: "asc" }],
    select: {
      id: true,
      teamId: true,
      teamName: true,
      isActive: true,
      syncEnabled: true,
      lastSyncedAt: true,
      createdAt: true,
      reports: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          workspaceName: true,
          taskCount: true,
          overdueCount: true,
          analysis: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    connection: connection ? { id: connection.id } : null,
    workspaces: workspaces.map((ws) => ({
      id: ws.id,
      teamId: ws.teamId,
      teamName: ws.teamName,
      isActive: ws.isActive,
      syncEnabled: ws.syncEnabled,
      lastSyncedAt: ws.lastSyncedAt,
      createdAt: ws.createdAt,
      reports: ws.reports,
    })),
  });
}
