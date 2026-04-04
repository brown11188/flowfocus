/**
 * GET /api/clickup/status
 * Returns all ClickUp workspace connections for the user.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { clickUpConnections, clickUpWorkspaceConnections, clickUpReports } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the main connection (holds the token)
  const [connection] = await db
    .select({ id: clickUpConnections.id, createdAt: clickUpConnections.createdAt, updatedAt: clickUpConnections.updatedAt })
    .from(clickUpConnections)
    .where(eq(clickUpConnections.userId, session.user.id))
    .limit(1);

  if (!connection) {
    return NextResponse.json({ connection: null, workspaces: [] });
  }

  // Get all workspace connections for this user
  const wsRows = await db
    .select()
    .from(clickUpWorkspaceConnections)
    .where(eq(clickUpWorkspaceConnections.userId, session.user.id))
    .orderBy(desc(clickUpWorkspaceConnections.isActive), asc(clickUpWorkspaceConnections.teamName));

  // Fetch recent reports for each workspace connection
  const workspaces = await Promise.all(
    wsRows.map(async (ws) => {
      const reports = await db
        .select({
          id: clickUpReports.id,
          workspaceName: clickUpReports.workspaceName,
          taskCount: clickUpReports.taskCount,
          overdueCount: clickUpReports.overdueCount,
          analysis: clickUpReports.analysis,
          createdAt: clickUpReports.createdAt,
        })
        .from(clickUpReports)
        .where(eq(clickUpReports.workspaceConnectionId, ws.id))
        .orderBy(desc(clickUpReports.createdAt))
        .limit(3);
      return {
        id: ws.id,
        teamId: ws.teamId,
        teamName: ws.teamName,
        isActive: ws.isActive,
        syncEnabled: ws.syncEnabled,
        lastSyncedAt: ws.lastSyncedAt,
        createdAt: ws.createdAt,
        reports,
      };
    })
  );

  return NextResponse.json({
    connection: { id: connection.id },
    workspaces,
  });
}
