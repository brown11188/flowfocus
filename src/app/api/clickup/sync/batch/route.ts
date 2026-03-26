/**
 * POST /api/clickup/sync/batch
 * Generates AI reports for multiple ClickUp workspace connections.
 * Streams SSE progress events so the client can show live per-workspace status.
 *
 * Body: { workspaceConnectionIds: string[], includeClosed?: boolean }
 *
 * SSE event format (JSON lines prefixed with "data: "):
 *   { type: "start",    workspaceId, workspaceName, index, total }
 *   { type: "done",     workspaceId, workspaceName, report: SyncReport }
 *   { type: "error",    workspaceId, workspaceName, message }
 *   { type: "complete", summary: { totalReports, totalTasks, totalOverdue } }
 */
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ClickUpClient,
  normalizeTask,
  buildWorkspaceStats,
  generateClickUpReport,
} from "@/lib/clickup";

export const dynamic = "force-dynamic";

// Rate limit: max 2 batch runs per 15 minutes per user
const batchCounts: Record<string, { count: number; resetAt: number }> = {};
function checkBatchLimit(userId: string): boolean {
  const now = Date.now();
  const entry = batchCounts[userId];
  if (!entry || now > entry.resetAt) {
    batchCounts[userId] = { count: 1, resetAt: now + 15 * 60 * 1000 };
    return true;
  }
  if (entry.count >= 2) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!checkBatchLimit(session.user.id)) {
    return new Response(
      JSON.stringify({ error: "Rate limit: max 2 batch reports per 15 minutes." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { workspaceConnectionIds?: string[]; includeClosed?: boolean } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const ids = body.workspaceConnectionIds ?? [];
  if (ids.length === 0) {
    return new Response(
      JSON.stringify({ error: "workspaceConnectionIds is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify all workspace connections belong to the current user
  const workspaceConns = await prisma.clickUpWorkspaceConnection.findMany({
    where: { id: { in: ids }, userId: session.user.id, isActive: true },
    include: { connection: true },
  });

  if (workspaceConns.length === 0) {
    return new Response(
      JSON.stringify({ error: "No valid workspace connections found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const total = workspaceConns.length;

  // ── SSE Stream ────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // controller may already be closed
        }
      };

      let totalReports = 0;
      let totalTasks = 0;
      let totalOverdue = 0;

      for (let i = 0; i < workspaceConns.length; i++) {
        const wsConn = workspaceConns[i];

        send({
          type: "start",
          workspaceId: wsConn.id,
          workspaceName: wsConn.teamName,
          index: i + 1,
          total,
        });

        try {
          const client = new ClickUpClient(wsConn.connection.accessToken);

          const { tasks: rawTasks, spaces } = await client.getAllWorkspaceTasks(
            wsConn.teamId,
            { includeClosed: body.includeClosed ?? false, maxLists: 30 }
          );

          const tasks = rawTasks.map(normalizeTask);
          const stats = buildWorkspaceStats(tasks);

          const analysis = await generateClickUpReport(
            { id: wsConn.teamId, name: wsConn.teamName },
            tasks,
            stats
          );

          const report = await prisma.clickUpReport.create({
            data: {
              connectionId: wsConn.connectionId,
              workspaceId: wsConn.teamId,
              workspaceName: wsConn.teamName,
              workspaceConnectionId: wsConn.id,
              rawData: JSON.stringify({
                tasks: tasks.slice(0, 100),
                spaces: spaces.map((s) => ({ id: s.id, name: s.name })),
              }),
              analysis,
              taskCount: stats.total,
              overdueCount: stats.overdue,
            },
          });

          await prisma.clickUpWorkspaceConnection.update({
            where: { id: wsConn.id },
            data: { lastSyncedAt: new Date() },
          });

          totalReports++;
          totalTasks += stats.total;
          totalOverdue += stats.overdue;

          send({
            type: "done",
            workspaceId: wsConn.id,
            workspaceName: wsConn.teamName,
            report: {
              id: report.id,
              workspaceName: wsConn.teamName,
              analysis,
              stats,
              taskCount: stats.total,
              overdueCount: stats.overdue,
              spaces: spaces.map((s) => ({ id: s.id, name: s.name })),
              createdAt: report.createdAt.toISOString(),
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Report generation failed";
          console.error(`[ClickUp Batch Sync] ${wsConn.teamName}:`, err);
          send({
            type: "error",
            workspaceId: wsConn.id,
            workspaceName: wsConn.teamName,
            message,
          });
        }
      }

      send({
        type: "complete",
        summary: { totalReports, totalTasks, totalOverdue },
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
