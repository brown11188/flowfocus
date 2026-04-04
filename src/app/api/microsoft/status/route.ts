import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { microsoftConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/microsoft/status
 * Check if user has connected their Microsoft account
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [connection] = await db
    .select({
      id: microsoftConnections.id,
      microsoftId: microsoftConnections.microsoftId,
      email: microsoftConnections.email,
      displayName: microsoftConnections.displayName,
      accountType: microsoftConnections.accountType,
      syncEmailsEnabled: microsoftConnections.syncEmailsEnabled,
      syncCalendarEnabled: microsoftConnections.syncCalendarEnabled,
      lastEmailSyncAt: microsoftConnections.lastEmailSyncAt,
      lastCalendarSyncAt: microsoftConnections.lastCalendarSyncAt,
      createdAt: microsoftConnections.createdAt,
    })
    .from(microsoftConnections)
    .where(eq(microsoftConnections.userId, session.user.id))
    .limit(1);

  return NextResponse.json({
    connected: !!connection,
    connection: connection ?? null,
  });
}

/**
 * DELETE /api/microsoft/status
 * Disconnect Microsoft account
 */
export async function DELETE(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.delete(microsoftConnections).where(eq(microsoftConnections.userId, session.user.id)).catch(() => {});

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/microsoft/status
 * Update sync settings
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { syncEmailsEnabled, syncCalendarEnabled } = body;

  const data: Partial<typeof microsoftConnections.$inferInsert> = {};
  if (syncEmailsEnabled !== undefined) data.syncEmailsEnabled = syncEmailsEnabled;
  if (syncCalendarEnabled !== undefined) data.syncCalendarEnabled = syncCalendarEnabled;

  const [connection] = await db
    .update(microsoftConnections)
    .set(data)
    .where(eq(microsoftConnections.userId, session.user.id))
    .returning();

  return NextResponse.json({ success: true, connection });
}
