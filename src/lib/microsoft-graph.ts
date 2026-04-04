/**
 * Microsoft Graph API Adapter for FlowFocus
 * 
 * Supports:
 * - OAuth token refresh
 * - Email reading (Mail.Read scope)
 * - Calendar sync (Calendars.ReadWrite scope)
 * - Meeting detection
 */

import { db } from "@/lib/db";
import { microsoftConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MicrosoftConnection {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  microsoftId: string;
  email: string | null;
  displayName: string | null;
}

export interface OutlookEmail {
  id: string;
  subject: string | null;
  from: { email: string | null; name: string | null } | null;
  receivedDateTime: Date;
  bodyPreview: string | null;
  bodyContent: string | null;
  webLink: string | null;
  isRead: boolean;
  hasAttachments: boolean;
  importance: "low" | "normal" | "high";
  categories?: string[];
  conversationId: string | null;
}

export interface OutlookCalendarEvent {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  location: { displayName: string | null } | null;
  organizer: { emailAddress: { address: string; name: string } } | null;
  webLink: string | null;
  recurrence: {
    pattern: { type: string };
    range: { type: string };
  } | null;
}

export interface GraphError {
  error: {
    code: string;
    message: string;
  innerError?: { code: string };
  };
}

// ─── Token Management ────────────────────────────────────────────────────────

/**
 * Get a valid access token for the user, refreshing if necessary
 */
export async function getValidAccessToken(
  userId: string
): Promise<{ accessToken: string; connection: MicrosoftConnection } | null> {
  const connection = await db.query.microsoftConnections.findFirst({
    where: (t, { eq: e }) => e(t.userId, userId),
  });

  if (!connection) return null;

  // Check if token needs refresh (5 minute buffer)
  const now = new Date();
  const expiresAt = connection.expiresAt;
  const needsRefresh = !expiresAt || expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

  if (!needsRefresh) {
    return { accessToken: connection.accessToken, connection };
  }

  // Refresh the token
  if (!connection.refreshToken) {
    console.error("[Microsoft] No refresh token available for user", userId);
    return null;
  }

  try {
    const tokenData = await refreshMicrosoftToken(connection.refreshToken);
    if (!tokenData) return null;

    const [updated] = await db.update(microsoftConnections).set({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? connection.refreshToken,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    }).where(eq(microsoftConnections.userId, userId)).returning();

    return {
      accessToken: tokenData.access_token,
      connection: {
        ...updated,
        refreshToken: updated.refreshToken,
        expiresAt: updated.expiresAt,
      },
    };
  } catch (error) {
    console.error("[Microsoft] Token refresh failed:", error);
    return null;
  }
}

/**
 * Refresh Microsoft OAuth token
 */
async function refreshMicrosoftToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
  const tenantId = "common"; // Use "common" for both org + personal accounts (matches Azure app signInAudience)
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[Microsoft] Missing client credentials");
    return null;
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "offline_access User.Read Mail.Read Calendars.ReadWrite",
      }),
    }
  );

  if (!response.ok) {
    const error = (await response.json()) as GraphError;
    console.error("[Microsoft] Token refresh error:", error);
    return null;
  }

  return response.json();
}

// ─── Graph API Helpers ────────────────────────────────────────────────────────

/**
 * Normalize a Graph API datetime string to proper ISO 8601 with Z suffix.
 * Graph API returns bare datetime strings ("2026-03-27T14:00:00.0000000")
 * which JavaScript parses as local time without the Z.
 * When we request events with Prefer: outlook.timezone="UTC", the values
 * ARE UTC but still lack the Z suffix.
 */
function normalizeUtcDt(dt: string): string {
  if (dt.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dt)) return dt;
  return dt.replace(/\.?0+$/, "") + "Z";
}

async function graphFetch<T>(
  accessToken: string,
  endpoint: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T | null> {
  const url = endpoint.startsWith("https")
    ? endpoint
    : `https://graph.microsoft.com/v1.0${endpoint}`;

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let error: unknown;
    try { error = await response.json(); } catch { error = { status: response.status, text: response.statusText }; }
    console.error(`[Microsoft] Graph API error (${endpoint}):`, JSON.stringify(error));
    return null;
  }

  return response.json();
}

// ─── Email Operations ──────────────────────────────────────────────────────────

/**
 * Fetch recent emails from Outlook Inbox
 */
export async function fetchRecentEmails(
  userId: string,
  options: { top?: number; filter?: string; fetchAll?: boolean; maxPages?: number } = {}
): Promise<OutlookEmail[]> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult) return [];

  const { top = 50, filter, fetchAll = false, maxPages = 10 } = options;
  const select = "id,subject,from,receivedDateTime,bodyPreview,body,webLink,isRead,hasAttachments,importance,categories,conversationId";
  // Use /me/mailFolders/inbox/messages to scope to Inbox only.
  // Do NOT add parentFolderId to the $filter — it is unsupported on this endpoint
  // and causes the Graph API to silently return 0 results.
  let endpoint = `/me/mailFolders/inbox/messages?$top=${top}&$orderby=receivedDateTime desc&$select=${select}`;

  if (filter) {
    endpoint += `&$filter=${encodeURIComponent(filter)}`;
  }

  console.log(`[GraphAPI] fetchRecentEmails endpoint: ${endpoint}`);

  const allMessages: Record<string, unknown>[] = [];
  let nextUrl: string | null = endpoint;
  let pageCount = 0;

  while (nextUrl && pageCount < maxPages) {
    const pageData: { value: unknown[]; "@odata.nextLink"?: string } | null = await graphFetch(
      tokenResult.accessToken,
      nextUrl
    );

    if (!pageData) {
      console.warn(`[GraphAPI] fetchRecentEmails page ${pageCount + 1} returned null — stopping pagination`);
      break;
    }
    if (!pageData.value?.length) {
      console.log(`[GraphAPI] fetchRecentEmails page ${pageCount + 1} returned 0 messages — done`);
      break;
    }

    console.log(`[GraphAPI] fetchRecentEmails page ${pageCount + 1}: ${pageData.value.length} messages`);
    allMessages.push(...(pageData.value as Record<string, unknown>[]));
    pageCount += 1;

    if (!fetchAll) break;
    nextUrl = pageData["@odata.nextLink"] ?? null;
  }

  console.log(`[GraphAPI] fetchRecentEmails total: ${allMessages.length} messages (${pageCount} pages)`);


  return allMessages.map((m) => ({
    id: m.id as string,
    subject: m.subject as string | null,
    from: m.from
      ? {
          email: (m.from as Record<string, unknown>).emailAddress
            ? ((m.from as Record<string, unknown>).emailAddress as Record<string, unknown>).address as string
            : null,
          name: (m.from as Record<string, unknown>).emailAddress
            ? ((m.from as Record<string, unknown>).emailAddress as Record<string, unknown>).name as string
            : null,
        }
      : null,
    receivedDateTime: new Date(m.receivedDateTime as string),
    bodyPreview: m.bodyPreview as string | null,
    bodyContent:
      m.body && typeof m.body === "object" && "content" in m.body
        ? (m.body as Record<string, unknown>).content as string
        : null,
    webLink: m.webLink as string | null,
    isRead: m.isRead as boolean,
    hasAttachments: m.hasAttachments as boolean,
    importance: m.importance as "low" | "normal" | "high",
    categories: Array.isArray(m.categories) ? (m.categories as string[]) : [],
    conversationId: (m.conversationId as string | null) ?? null,
  }));
}

/**
 * Fetch a single email by ID
 */
export async function fetchEmailById(
  userId: string,
  emailId: string
): Promise<OutlookEmail | null> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult) return null;

  const data = await graphFetch<Record<string, unknown>>(
    tokenResult.accessToken,
    `/me/messages/${emailId}?$select=id,subject,from,receivedDateTime,bodyPreview,body,webLink,isRead,hasAttachments,importance`
  );

  if (!data) return null;

  return {
    id: data.id as string,
    subject: data.subject as string | null,
    from: data.from
      ? {
          email: (data.from as Record<string, unknown>).emailAddress
            ? ((data.from as Record<string, unknown>).emailAddress as Record<string, unknown>).address as string
            : null,
          name: (data.from as Record<string, unknown>).emailAddress
            ? ((data.from as Record<string, unknown>).emailAddress as Record<string, unknown>).name as string
            : null,
        }
      : null,
    receivedDateTime: new Date(data.receivedDateTime as string),
    bodyPreview: data.bodyPreview as string | null,
    bodyContent:
      data.body && typeof data.body === "object" && "content" in data.body
        ? (data.body as Record<string, unknown>).content as string
        : null,
    webLink: data.webLink as string | null,
    isRead: data.isRead as boolean,
    hasAttachments: data.hasAttachments as boolean,
    importance: data.importance as "low" | "normal" | "high",
    conversationId: (data.conversationId as string | null) ?? null,
  };
}

// ─── Calendar Operations ─────────────────────────────────────────────────────────

/**
 * Fetch calendar events for a date range
 */
export async function fetchCalendarEvents(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<OutlookCalendarEvent[]> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult) return [];

  const start = startDate.toISOString();
  const end = endDate.toISOString();

  // Request events in UTC so dateTime strings are always UTC-based.
  // Without this header, Graph returns times in the mailbox's default timezone
  // as bare datetime strings (no Z suffix), which JavaScript parses as local time.
  const data = await graphFetch<{ value: unknown[] }>(
    tokenResult.accessToken,
    `/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$orderby=start/dateTime&$select=id,subject,bodyPreview,start,end,isAllDay,location,organizer,webLink,recurrence`,
    { headers: { "Prefer": 'outlook.timezone="UTC"' } }
  );

  if (!data?.value) return [];

  return data.value.map((evt: unknown) => {
    const e = evt as Record<string, unknown>;
    const startRaw = e.start as { dateTime: string; timeZone: string };
    const endRaw = e.end as { dateTime: string; timeZone: string };

    // Ensure dateTime strings are proper ISO 8601 with Z suffix so
    // `new Date(dt)` always interprets them as UTC on the client side.

    return {
      id: e.id as string,
      subject: e.subject as string | null,
      bodyPreview: e.bodyPreview as string | null,
      start: { dateTime: normalizeUtcDt(startRaw.dateTime), timeZone: "UTC" },
      end: { dateTime: normalizeUtcDt(endRaw.dateTime), timeZone: "UTC" },
      isAllDay: e.isAllDay as boolean,
      location: e.location as { displayName: string | null } | null,
      organizer: e.organizer as { emailAddress: { address: string; name: string } } | null,
      webLink: e.webLink as string | null,
      recurrence: e.recurrence as { pattern: { type: string }; range: { type: string } } | null,
    };
  });
}

/**
 * Create a calendar event
 */
export async function createCalendarEvent(
  userId: string,
  event: {
    subject: string;
    body?: string;
    start: Date;
    end: Date;
    isAllDay?: boolean;
    location?: string;
  }
): Promise<OutlookCalendarEvent | null> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult) return null;

  const data = await graphFetch<Record<string, unknown>>(
    tokenResult.accessToken,
    `/me/calendar/events`,
    {
      method: "POST",
      body: {
        subject: event.subject,
        body: event.body ? { contentType: "text", content: event.body } : undefined,
        start: { dateTime: event.start.toISOString(), timeZone: "UTC" },
        end: { dateTime: event.end.toISOString(), timeZone: "UTC" },
        isAllDay: event.isAllDay ?? false,
        location: event.location ? { displayName: event.location } : undefined,
      },
    }
  );

  if (!data) return null;

  // Normalize returned datetime strings to include Z suffix
  const startData = data.start as { dateTime: string; timeZone: string };
  const endData = data.end as { dateTime: string; timeZone: string };

  return {
    id: data.id as string,
    subject: data.subject as string | null,
    bodyPreview: data.bodyPreview as string | null,
    start: { dateTime: normalizeUtcDt(startData.dateTime), timeZone: "UTC" },
    end: { dateTime: normalizeUtcDt(endData.dateTime), timeZone: "UTC" },
    isAllDay: data.isAllDay as boolean,
    location: data.location as { displayName: string | null } | null,
    organizer: data.organizer as { emailAddress: { address: string; name: string } } | null,
    webLink: data.webLink as string | null,
    recurrence: data.recurrence as { pattern: { type: string }; range: { type: string } } | null,
  };
}

/**
 * Update a calendar event
 */
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  updates: {
    subject?: string;
    body?: string;
    start?: Date;
    end?: Date;
    isAllDay?: boolean;
    location?: string;
  }
): Promise<boolean> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult) return false;

  const body: Record<string, unknown> = {};
  if (updates.subject) body.subject = updates.subject;
  if (updates.body) body.body = { contentType: "text", content: updates.body };
  if (updates.start) body.start = { dateTime: updates.start.toISOString(), timeZone: "UTC" };
  if (updates.end) body.end = { dateTime: updates.end.toISOString(), timeZone: "UTC" };
  if (updates.isAllDay !== undefined) body.isAllDay = updates.isAllDay;
  if (updates.location) body.location = { displayName: updates.location };

  const result = await graphFetch<Record<string, unknown>>(
    tokenResult.accessToken,
    `/me/calendar/events/${eventId}`,
    { method: "PATCH", body }
  );

  return result !== null;
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult) return false;

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    }
  );

  return response.ok;
}

// ─── User Profile ──────────────────────────────────────────────────────────────

/**
 * Get Microsoft user profile
 */
export async function getMicrosoftProfile(
  userId: string
): Promise<{ id: string; email: string; displayName: string } | null> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult) return null;

  const data = await graphFetch<Record<string, unknown>>(
    tokenResult.accessToken,
    "/me?$select=id,mail,userPrincipalName,displayName"
  );

  if (!data) return null;

  return {
    id: data.id as string,
    email: (data.mail ?? data.userPrincipalName) as string,
    displayName: data.displayName as string,
  };
}

// ─── Meeting Detection ─────────────────────────────────────────────────────────

/**
 * Detect meeting invites in emails
 */
export function isMeetingInvite(email: OutlookEmail): boolean {
  const subject = email.subject?.toLowerCase() ?? "";
  const body = email.bodyContent?.toLowerCase() ?? "";

  // Check for meeting-related keywords
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

/**
 * Extract meeting details from email
 */
export function extractMeetingDetails(
  email: OutlookEmail
): { title: string; date?: string; time?: string; location?: string } | null {
  if (!isMeetingInvite(email)) return null;

  const subject = email.subject ?? "Untitled Meeting";
  const body = email.bodyContent ?? "";

  // Simple extraction - could be enhanced with AI
  const titleMatch = subject.match(/(?:meeting|call|sync)[:\s]+(.+)/i);
  const title = titleMatch ? titleMatch[1].trim() : subject.replace(/^(re|fwd):\s*/i, "");

  // Try to extract date/time from body
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
