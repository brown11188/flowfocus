/**
 * GET /api/clickup/reports
 * Returns all AI reports for the current user across all workspaces.
 * Optional query: ?workspaceConnectionId=<id>  to filter by workspace
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { clickUpReports, clickUpWorkspaceConnections } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wsConnId = req.nextUrl.searchParams.get("workspaceConnectionId");

  // Fetch reports belonging to the user's workspace connections
  const reports = await db
    .select({
      id: clickUpReports.id,
      workspaceName: clickUpReports.workspaceName,
      workspaceConnectionId: clickUpReports.workspaceConnectionId,
      taskCount: clickUpReports.taskCount,
      overdueCount: clickUpReports.overdueCount,
      analysis: clickUpReports.analysis,
      createdAt: clickUpReports.createdAt,
    })
    .from(clickUpReports)
    .innerJoin(clickUpWorkspaceConnections, eq(clickUpReports.workspaceConnectionId, clickUpWorkspaceConnections.id))
    .where(
      wsConnId
        ? and(eq(clickUpWorkspaceConnections.userId, session.user.id), eq(clickUpWorkspaceConnections.id, wsConnId))
        : eq(clickUpWorkspaceConnections.userId, session.user.id)
    )
    .orderBy(desc(clickUpReports.createdAt))
    .limit(50);

  return NextResponse.json({ reports });
}
