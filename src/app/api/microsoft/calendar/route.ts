import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { microsoftConnections, calendarEvents, tasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  fetchCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/microsoft-graph";

export const dynamic = "force-dynamic";

/**
 * GET /api/microsoft/calendar
 * Fetch calendar events for a date range
 * Query params: startDate, endDate (ISO strings)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");

  // Default to next 30 days
  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  const endDate = endDateStr
    ? new Date(endDateStr)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const connection = await db.select().from(microsoftConnections)
    .where(eq(microsoftConnections.userId, session.user.id))
    .limit(1)
    .then(r => r[0]);

  if (!connection) {
    return NextResponse.json({ error: "Microsoft not connected" }, { status: 400 });
  }

  // Fetch events from Microsoft Graph
  const events = await fetchCalendarEvents(session.user.id, startDate, endDate);

  // Sync events to database
  for (const event of events) {
    const startDateTime = new Date(event.start.dateTime);
    const endDateTime = new Date(event.end.dateTime);

    await db.insert(calendarEvents).values({
      id: createId(),
      connectionId: connection.id,
      userId: session.user.id,
      microsoftId: event.id,
      subject: event.subject,
      bodyPreview: event.bodyPreview,
      startDateTime,
      endDateTime,
      isAllDay: event.isAllDay,
      location: event.location?.displayName ?? null,
      organizerEmail: event.organizer?.emailAddress.address ?? null,
      webLink: event.webLink,
      isRecurring: !!event.recurrence,
      recurrencePattern: event.recurrence ? JSON.stringify(event.recurrence) : null,
    }).onConflictDoUpdate({
      target: calendarEvents.microsoftId,
      set: {
        subject: event.subject,
        bodyPreview: event.bodyPreview,
        startDateTime,
        endDateTime,
        isAllDay: event.isAllDay,
        location: event.location?.displayName ?? null,
        organizerEmail: event.organizer?.emailAddress.address ?? null,
        webLink: event.webLink,
        isRecurring: !!event.recurrence,
        recurrencePattern: event.recurrence ? JSON.stringify(event.recurrence) : null,
        lastSyncedAt: new Date(),
      },
    }).catch(() => {});
  }

  // Update last sync time
  await db.update(microsoftConnections)
    .set({ lastCalendarSyncAt: new Date() })
    .where(eq(microsoftConnections.userId, session.user.id));

  return NextResponse.json({
    events,
    count: events.length,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
}

/**
 * POST /api/microsoft/calendar
 * Create a calendar event from a task
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestBody = await req.json();
  const { taskId, subject, body: eventBody, start, end, isAllDay, location } = requestBody;

  if (!taskId || !subject || !start) {
    return NextResponse.json(
      { error: "Missing required fields: taskId, subject, start" },
      { status: 400 }
    );
  }

  // Verify task belongs to user
  const task = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))
    .limit(1)
    .then(r => r[0]);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Create event in Outlook
  const event = await createCalendarEvent(session.user.id, {
    subject,
    body: eventBody,
    start: new Date(start),
    end: end ? new Date(end) : new Date(new Date(start).getTime() + 60 * 60 * 1000),
    isAllDay,
    location,
  });

  if (!event) {
    return NextResponse.json(
      { error: "Failed to create calendar event" },
      { status: 500 }
    );
  }

  // Get connection for database record
  const connection = await db.select().from(microsoftConnections)
    .where(eq(microsoftConnections.userId, session.user.id))
    .limit(1)
    .then(r => r[0]);

  if (!connection) {
    return NextResponse.json({ error: "Microsoft not connected" }, { status: 400 });
  }

  // Store event in database and link to task
  const [calendarEvent] = await db.insert(calendarEvents).values({
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
    organizerEmail: event.organizer?.emailAddress.address ?? null,
    webLink: event.webLink,
    linkedTaskId: taskId,
    syncDirection: "toCalendar",
  }).returning();

  return NextResponse.json({
    success: true,
    event: calendarEvent,
    outlookLink: event.webLink,
  });
}

/**
 * DELETE /api/microsoft/calendar
 * Delete a calendar event
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  // Delete from Outlook
  const deleted = await deleteCalendarEvent(session.user.id, eventId);

  // Delete from database
  await db.delete(calendarEvents)
    .where(and(eq(calendarEvents.userId, session.user.id), eq(calendarEvents.microsoftId, eventId)))
    .catch(() => {});

  return NextResponse.json({ success: deleted });
}
