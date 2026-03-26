/**
 * POST /api/clickup/sync
 * Fetches tasks from a specific ClickUp workspace and generates an AI report.
 * Body: { workspaceConnectionId: string, includeClosed?: boolean }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ClickUpClient,
  normalizeTask,
  buildWorkspaceStats,
  generateClickUpReport,
} from "@/lib/clickup";

export const dynamic = "force-dynamic";

// Rate limit: max 3 syncs per 10 minutes per user
const syncCounts: Record<string, { count: number; resetAt: number }> = {};

function checkSyncLimit(userId: string): boolean {
  const now = Date.now();
  const entry = syncCounts[userId];
  if (!entry || now > entry.resetAt) {
    syncCounts[userId] = { count: 1, resetAt: now + 10 * 60 * 1000 };
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkSyncLimit(session.user.id)) {
    return NextResponse.json(
      { error: "Rate limit: max 3 syncs per 10 minutes." },
      { status: 429 }
    );
  }

  let body: { workspaceConnectionId?: string; includeClosed?: boolean } = {};
  try { body = await req.json(); } catch { /* ok */ }

  if (!body.workspaceConnectionId) {
    return NextResponse.json({ error: "workspaceConnectionId is required" }, { status: 400 });
  }

  // Get the workspace connection
  const workspaceConn = await prisma.clickUpWorkspaceConnection.findUnique({
    where: { id: body.workspaceConnectionId },
    include: { connection: true },
  });

  if (!workspaceConn || workspaceConn.userId !== session.user.id) {
    return NextResponse.json({ error: "Workspace connection not found" }, { status: 404 });
  }

  if (!workspaceConn.isActive) {
    return NextResponse.json({ error: "Workspace connection is inactive" }, { status: 400 });
  }

  try {
    const client = new ClickUpClient(workspaceConn.connection.accessToken);

    // Fetch all tasks from the workspace
    const { tasks: rawTasks, spaces } = await client.getAllWorkspaceTasks(
      workspaceConn.teamId,
      { includeClosed: body.includeClosed ?? false, maxLists: 30 }
    );

    // Normalize
    const tasks = rawTasks.map(normalizeTask);

    // Build stats
    const stats = buildWorkspaceStats(tasks);

    // Generate AI analysis
    const analysis = await generateClickUpReport(
      { id: workspaceConn.teamId, name: workspaceConn.teamName },
      tasks,
      stats
    );

    // Persist the report
    const report = await prisma.clickUpReport.create({
      data: {
        connectionId: workspaceConn.connectionId,
        workspaceId: workspaceConn.teamId,
        workspaceName: workspaceConn.teamName,
        workspaceConnectionId: workspaceConn.id,
        rawData: JSON.stringify({ tasks: tasks.slice(0, 100), spaces: spaces.map((s) => ({ id: s.id, name: s.name })) }),
        analysis,
        taskCount: stats.total,
        overdueCount: stats.overdue,
      },
    });

    // Update lastSyncedAt
    await prisma.clickUpWorkspaceConnection.update({
      where: { id: workspaceConn.id },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({
      report: {
        id: report.id,
        workspaceName: workspaceConn.teamName,
        analysis,
        stats,
        taskCount: stats.total,
        overdueCount: stats.overdue,
        spaces: spaces.map((s) => ({ id: s.id, name: s.name })),
        createdAt: report.createdAt,
      },
    });
  } catch (err) {
    console.error("[ClickUp Sync]", err);
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
