/**
 * GET /api/clickup/reports
 * Returns all AI reports for the current user across all workspaces.
 * Optional query: ?workspaceConnectionId=<id>  to filter by workspace
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wsConnId = req.nextUrl.searchParams.get("workspaceConnectionId");

  // Fetch reports belonging to the user's workspace connections
  const reports = await prisma.clickUpReport.findMany({
    where: {
      workspaceConnection: {
        userId: session.user.id,
        ...(wsConnId ? { id: wsConnId } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      workspaceName: true,
      workspaceConnectionId: true,
      taskCount: true,
      overdueCount: true,
      analysis: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ reports });
}
