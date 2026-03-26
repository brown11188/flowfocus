import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent } from "@/lib/microsoft-graph";

export const dynamic = "force-dynamic";

/**
 * POST /api/microsoft/sync-calendar
 * Sync tasks with due dates to Outlook Calendar
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { taskIds, syncAll } = body;

  // Check Microsoft connection
  const connection = await prisma.microsoftConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Microsoft not connected" },
      { status: 400 }
    );
  }

  if (!connection.syncCalendarEnabled) {
    return NextResponse.json(
      { error: "Calendar sync is disabled" },
      { status: 400 }
    );
  }

  // Get tasks to sync
  const whereClause: { userId: string; dueDate: { not: null }; completed: boolean; id?: { in: string[] } } = {
    userId: session.user.id,
    dueDate: { not: null },
    completed: false,
  };

  if (taskIds && taskIds.length > 0) {
    whereClause.id = { in: taskIds };
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    include: { project: true },
    take: syncAll ? 50 : 10,
  });

  if (tasks.length === 0) {
    return NextResponse.json({
      synced: 0,
      message: "No tasks with due dates to sync",
    });
  }

  const results: { taskId: string; success: boolean; eventId?: string; error?: string }[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;

    // Check if already synced
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { linkedTaskId: task.id },
    });

    if (existingEvent) {
      results.push({ taskId: task.id, success: false, error: "Already synced" });
      continue;
    }

    try {
      // Create event in Outlook
      const startDate = new Date(task.dueDate);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

      const event = await createCalendarEvent(session.user.id, {
        subject: task.title,
        body: task.notes ?? undefined,
        start: startDate,
        end: endDate,
        isAllDay: false,
        location: task.project?.name ?? undefined,
      });

      if (event) {
        // Store event in database
        await prisma.calendarEvent.create({
          data: {
            connectionId: connection.id,
            userId: session.user.id,
            microsoftId: event.id,
            subject: event.subject,
            bodyPreview: event.bodyPreview,
            startDateTime: new Date(event.start.dateTime),
            endDateTime: new Date(event.end.dateTime),
            isAllDay: event.isAllDay,
            location: event.location?.displayName ?? null,
            webLink: event.webLink,
            linkedTaskId: task.id,
            syncDirection: "bidirectional",
          },
        });

        results.push({ taskId: task.id, success: true, eventId: event.id });
      } else {
        results.push({ taskId: task.id, success: false, error: "Failed to create event" });
      }
    } catch (error) {
      console.error(`[Microsoft] Error syncing task ${task.id}:`, error);
      results.push({ taskId: task.id, success: false, error: "Sync error" });
    }
  }

  const syncedCount = results.filter((r) => r.success).length;

  // Update last sync time
  await prisma.microsoftConnection.update({
    where: { userId: session.user.id },
    data: { lastCalendarSyncAt: new Date() },
  });

  return NextResponse.json({
    synced: syncedCount,
    total: tasks.length,
    results,
  });
}