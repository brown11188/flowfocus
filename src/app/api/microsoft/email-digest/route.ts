import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { microsoftConnections, emailDigests, actionedEmails } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/microsoft/email-digest
 * Returns the latest email digest for the current user.
 * Also returns recent history (last 7 digests).
 */
export async function GET(req: NextRequest) {
  void req;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await db.select({
    id: microsoftConnections.id,
    email: microsoftConnections.email,
    displayName: microsoftConnections.displayName,
    lastEmailSyncAt: microsoftConnections.lastEmailSyncAt,
    syncEmailsEnabled: microsoftConnections.syncEmailsEnabled,
  }).from(microsoftConnections).where(eq(microsoftConnections.userId, session.user.id)).limit(1).then(r => r[0]);

  if (!connection) {
    return NextResponse.json({ connected: false, digest: null });
  }

  // Latest digest
  const latest = await db.select().from(emailDigests)
    .where(eq(emailDigests.userId, session.user.id))
    .orderBy(desc(emailDigests.createdAt))
    .limit(1).then(r => r[0]);

  // Actioned email IDs (for client-side filtering)
  const actionedRecords = await db.select({ microsoftEmailId: actionedEmails.microsoftEmailId })
    .from(actionedEmails).where(eq(actionedEmails.userId, session.user.id));
  const actionedIds = actionedRecords.map(r => r.microsoftEmailId);

  if (!latest) {
    return NextResponse.json({
      connected: true,
      connection,
      digest: null,
      history: [],
      actionedIds,
    });
  }

  // Parse JSON fields — keep preview arrays for UI, expose true counts separately
  const digest = {
    ...latest,
    // Parse preview arrays
    missedReplies: parseJsonSafe(latest.missedReplies),
    needsReply:    parseJsonSafe(latest.needsReply),
    followUp:      parseJsonSafe(latest.followUp),
    readAgain:     parseJsonSafe(latest.readAgain ?? "[]"),
    // True counts — source of truth for the widget numbers
    missedReplyCount: latest.missedReplyCount ?? 0,
    needsReplyCount:  latest.needsReplyCount  ?? 0,
    followUpCount:    latest.followUpCount    ?? 0,
    readAgainCount:   latest.readAgainCount   ?? 0,
  };

  // Short history (last 7 days - summary only)
  const history = await db.select({
    id: emailDigests.id,
    scanDate: emailDigests.scanDate,
    totalScanned: emailDigests.totalScanned,
    clientEmailCount: emailDigests.clientEmailCount,
    noReplyFiltered: emailDigests.noReplyFiltered,
    missedReplyCount: emailDigests.missedReplyCount,
    needsReplyCount: emailDigests.needsReplyCount,
    followUpCount: emailDigests.followUpCount,
    readAgainCount: emailDigests.readAgainCount,
    aiSummary: emailDigests.aiSummary,
    status: emailDigests.status,
    completedAt: emailDigests.completedAt,
    createdAt: emailDigests.createdAt,
  }).from(emailDigests)
    .where(eq(emailDigests.userId, session.user.id))
    .orderBy(desc(emailDigests.createdAt))
    .limit(7);

  return NextResponse.json({
    connected: true,
    connection,
    digest,
    history,
    actionedIds,
  });
}

function parseJsonSafe(val: string): unknown[] {
  try { return JSON.parse(val); } catch { return []; }
}
