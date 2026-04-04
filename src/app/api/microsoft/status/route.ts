import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { microsoftConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/microsoft/status
 * Check if user has connected their Microsoft account
 */
export async function GET(req: NextRequest) {
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
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .delete(microsoftConnections)
    .where(eq(microsoftConnections.userId, session.user.id))
    .catch(() => {
      // Ignore if not found
    });

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/microsoft/status
 * Update sync settings (syncEmailsEnabled/syncCalendarEnabled were removed from schema)
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // syncEmailsEnabled and syncCalendarEnabled no longer exist in the schema
  return NextResponse.json(
    { error: "Sync settings are not configurable" },
    { status: 410 }
  );
}
