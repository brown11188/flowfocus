/**
 * GET /api/clickup/reports
 * Returns all AI reports for the current user across all workspaces.
 * Optional query: ?workspaceConnectionId=<id>  to filter by workspace
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clickUpReports, clickUpWorkspaceConnections } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wsConnId = req.nextUrl.searchParams.get("workspaceConnectionId");

  // Find the user's workspace connection IDs (optionally filtered)
  const connConditions = [eq(clickUpWorkspaceConnections.userId, session.user.id)];
  if (wsConnId) connConditions.push(eq(clickUpWorkspaceConnections.id, wsConnId));

  const userConns = await db
    .select({ id: clickUpWorkspaceConnections.id })
    .from(clickUpWorkspaceConnections)
    .where(and(...connConditions));

  if (userConns.length === 0) {
    return NextResponse.json({ reports: [] });
  }

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
    .where(inArray(clickUpReports.workspaceConnectionId, userConns.map((c) => c.id)))
    .orderBy(desc(clickUpReports.createdAt))
    .limit(50);

  return NextResponse.json({ reports });
}
