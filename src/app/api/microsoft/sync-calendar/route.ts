import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { microsoftConnections, calendarEvents, tasks, projects } from "@/lib/db/schema";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
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
  const connection = await db.select().from(microsoftConnections)
    .where(eq(microsoftConnections.userId, session.user.id))
    .limit(1)
    .then(r => r[0]);

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
  const baseConditions = and(
    eq(tasks.userId, session.user.id),
    isNotNull(tasks.dueDate),
    eq(tasks.completed, false),
    ...(taskIds && taskIds.length > 0 ? [inArray(tasks.id, taskIds as string[])] : []),
  );

  const tasksWithProjects = await db
    .select({ task: tasks, project: projects })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(baseConditions)
    .limit(syncAll ? 50 : 10);

  if (tasksWithProjects.length === 0) {
    return NextResponse.json({
      synced: 0,
      message: "No tasks with due dates to sync",
    });
  }

  const results: { taskId: string; success: boolean; eventId?: string; error?: string }[] = [];

  for (const { task, project } of tasksWithProjects) {
    if (!task.dueDate) continue;

    // Check if already synced
    const existingEvent = await db.select().from(calendarEvents)
      .where(eq(calendarEvents.linkedTaskId, task.id))
      .limit(1)
      .then(r => r[0]);

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
        location: project?.name ?? undefined,
      });

      if (event) {
        // Store event in database
        await db.insert(calendarEvents).values({
          id: createId(),
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

  // Update last sync time
  await db.update(microsoftConnections)
    .set({ lastCalendarSyncAt: new Date() })
    .where(eq(microsoftConnections.userId, session.user.id));

  return NextResponse.json({
    synced: syncedCount,
    total: tasksWithProjects.length,
    results,
  });
}