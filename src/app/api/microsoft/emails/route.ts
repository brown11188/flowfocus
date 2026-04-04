import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { emailTasks, microsoftConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getValidAccessToken,
  fetchRecentEmails,
  type OutlookEmail,
} from "@/lib/microsoft-graph";

export const dynamic = "force-dynamic";

/**
 * GET /api/microsoft/emails
 * Fetch recent emails from Outlook
 * Query params: top (default 20), unread (boolean)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const top = parseInt(searchParams.get("top") ?? "20");
  const unread = searchParams.get("unread") === "true";

  // Check connection
  const [connection] = await db
    .select()
    .from(microsoftConnections)
    .where(eq(microsoftConnections.userId, session.user.id))
    .limit(1);

  if (!connection) {
    return NextResponse.json({ error: "Microsoft not connected" }, { status: 400 });
  }

  // Fetch emails from Microsoft Graph
  const emails = await fetchRecentEmails(session.user.id, {
    top,
    filter: unread ? "isRead eq false" : undefined,
  });

  // Process emails - detect meetings and store for task conversion
  const processedEmails = emails.map((email) => ({
    ...email,
    isMeetingInvite: isMeetingInvite(email),
    meetingDetails: extractMeetingDetails(email),
  }));

  // Store emails for task conversion (upsert)
  for (const email of processedEmails.slice(0, 10)) {
    // Only store first 10 to avoid overwhelming
    await db
      .insert(emailTasks)
      .values({
        connectionId: connection.id,
        userId: session.user.id,
        microsoftId: email.id,
        subject: email.subject,
        fromEmail: email.from?.email ?? null,
        fromName: email.from?.name ?? null,
        receivedAt: email.receivedDateTime,
        preview: email.bodyPreview?.slice(0, 500) ?? null,
        webLink: email.webLink,
        status: "pending",
      })
      .onConflictDoUpdate({
        target: emailTasks.microsoftId,
        set: {
          subject: email.subject,
          fromEmail: email.from?.email ?? null,
          fromName: email.from?.name ?? null,
          receivedAt: email.receivedDateTime,
          preview: email.bodyPreview?.slice(0, 500) ?? null,
          webLink: email.webLink,
        },
      })
      .catch(() => {
        // Ignore duplicate errors
      });
  }

  return NextResponse.json({
    emails: processedEmails,
    count: processedEmails.length,
    lastSync: null,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function isMeetingInvite(email: OutlookEmail): boolean {
  const subject = email.subject?.toLowerCase() ?? "";
  const body = email.bodyContent?.toLowerCase() ?? "";

  const meetingKeywords = [
    "meeting invite",
    "meeting invitation",
    "you have been invited to a meeting",
    "calendar invite",
    "accept/decline",
    "proposed meeting",
  ];

  return meetingKeywords.some((kw) => subject.includes(kw) || body.includes(kw));
}

function extractMeetingDetails(
  email: OutlookEmail
): { title: string; date?: string; time?: string; location?: string } | null {
  if (!isMeetingInvite(email)) return null;

  const subject = email.subject ?? "Untitled Meeting";
  const body = email.bodyContent ?? "";

  const titleMatch = subject.match(/(?:meeting|call|sync)[:\s]+(.+)/i);
  const title = titleMatch ? titleMatch[1].trim() : subject.replace(/^(re|fwd):\s*/i, "");

  const dateMatch = body.match(/date[:\s]+([^\n]+)/i);
  const timeMatch = body.match(/time[:\s]+([^\n]+)/i);
  const locationMatch = body.match(/location[:\s]+([^\n]+)/i);

  return {
    title: title || "Meeting",
    date: dateMatch?.[1]?.trim(),
    time: timeMatch?.[1]?.trim(),
    location: locationMatch?.[1]?.trim(),
  };
}
