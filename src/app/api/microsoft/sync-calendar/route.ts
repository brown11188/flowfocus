import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { calendarEvents, microsoftConnections, projects, tasks } from "@/db/schema";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
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
  const [connection] = await db
    .select()
    .from(microsoftConnections)
    .where(eq(microsoftConnections.userId, session.user.id))
    .limit(1);

  if (!connection) {
    return NextResponse.json(
      { error: "Microsoft not connected" },
      { status: 400 }
    );
  }

  // syncCalendarEnabled was removed from the Drizzle schema; skip the guard

  // Get tasks to sync
  const conditions = [
    eq(tasks.userId, session.user.id),
    isNotNull(tasks.dueDate),
    eq(tasks.completed, false),
  ] as const;

  const taskConditions = taskIds && taskIds.length > 0
    ? and(...conditions, inArray(tasks.id, taskIds))
    : and(...conditions);

  const tasksWithProjects = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      notes: tasks.notes,
      dueDate: tasks.dueDate,
      projectName: projects.name,
    })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(taskConditions)
    .limit(syncAll ? 50 : 10);

  if (tasksWithProjects.length === 0) {
    return NextResponse.json({
      synced: 0,
      message: "No tasks with due dates to sync",
    });
  }

  const results: { taskId: string; success: boolean; eventId?: string; error?: string }[] = [];

  for (const task of tasksWithProjects) {
    if (!task.dueDate) continue;

    // Check if already synced
    const [existingEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.linkedTaskId, task.id))
      .limit(1);

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
        location: task.projectName ?? undefined,
      });

      if (event) {
        // Store event in database
        await db.insert(calendarEvents).values({
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

  return NextResponse.json({
    synced: syncedCount,
    total: tasksWithProjects.length,
    results,
  });
}