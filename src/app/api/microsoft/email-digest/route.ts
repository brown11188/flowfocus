import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const connection = await prisma.microsoftConnection.findUnique({
    where: { userId: session.user.id },
    select: { id: true, email: true, displayName: true, lastEmailSyncAt: true, syncEmailsEnabled: true },
  });

  if (!connection) {
    return NextResponse.json({ connected: false, digest: null });
  }

  // Latest digest
  const latest = await prisma.emailDigest.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return NextResponse.json({
      connected: true,
      connection,
      digest: null,
      history: [],
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
  const history = await prisma.emailDigest.findMany({
    where: { userId: session.user.id, status: "done" },
    orderBy: { createdAt: "desc" },
    take: 7,
    select: {
      id: true,
      scanDate: true,
      totalScanned: true,
      clientEmailCount: true,
      noReplyFiltered: true,
      missedReplyCount: true,
      needsReplyCount: true,
      followUpCount: true,
      readAgainCount: true,
      aiSummary: true,
      status: true,
      completedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    connected: true,
    connection,
    digest,
    history,
  });
}

function parseJsonSafe(val: string): unknown[] {
  try { return JSON.parse(val); } catch { return []; }
}
