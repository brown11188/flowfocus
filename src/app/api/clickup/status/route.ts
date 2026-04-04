/**
 * GET /api/clickup/status
 * Returns all ClickUp workspace connections for the user.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clickUpConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the main connection (holds the token)
  const [connection] = await db
    .select({ id: clickUpConnections.id })
    .from(clickUpConnections)
    .where(eq(clickUpConnections.userId, session.user.id))
    .limit(1);

  if (!connection) {
    return NextResponse.json({ connection: null, workspaces: [] });
  }

  // Get all workspace connections with their recent reports
  const workspaces = await db.query.clickUpWorkspaceConnections.findMany({
    where: (w, { eq }) => eq(w.userId, session.user.id),
    orderBy: (w, { desc, asc }) => [desc(w.isActive), asc(w.teamName)],
    with: {
      reports: {
        orderBy: (r, { desc }) => [desc(r.createdAt)],
        limit: 3,
      },
    },
  });

  return NextResponse.json({
    connection: { id: connection.id },
    workspaces: workspaces.map((ws) => ({
      id: ws.id,
      teamId: ws.teamId,
      teamName: ws.teamName,
      isActive: ws.isActive,
      syncEnabled: ws.syncEnabled,
      lastSyncedAt: ws.lastSyncedAt,
      createdAt: ws.createdAt,
      reports: ws.reports.map((r) => ({
        id: r.id,
        workspaceName: r.workspaceName,
        taskCount: r.taskCount,
        overdueCount: r.overdueCount,
        analysis: r.analysis,
        createdAt: r.createdAt,
      })),
    })),
  });
}
