import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchRecentEmails } from "@/lib/microsoft-graph";
import { runEmailScan } from "@/lib/email-scan";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await runEmailScan(session.user.id);

    const connection = await prisma.microsoftConnection.findUnique({
      where: { userId: session.user.id },
      select: { lastEmailSyncAt: true },
    });

    const unreadEmails = await fetchRecentEmails(session.user.id, {
      top: 250,
      filter: "isRead eq false",
      fetchAll: true,
      maxPages: 5,
    });

    const fixedExcludedUnread = unreadEmails.filter((email) => {
      const sender = email.from?.email?.toLowerCase().trim() ?? "";
      return sender.includes("no-reply") || sender.includes("noreply") || sender.endsWith("@saiogntechnology.com");
    }).length;

    return NextResponse.json({
      success: true,
      syncedAt: connection?.lastEmailSyncAt ?? new Date().toISOString(),
      unreadCount: unreadEmails.length,
      excludedUnreadCount: fixedExcludedUnread,
    });
  } catch (error) {
    console.error("[EmailScan] API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scan emails" },
      { status: 500 }
    );
  }
}
