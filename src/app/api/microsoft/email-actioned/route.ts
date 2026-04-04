import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { actionedEmails } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/microsoft/email-actioned
 * Mark an email as actioned (hide from future scan results).
 * Body: { microsoftEmailId: string, subject?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const microsoftEmailId = body.microsoftEmailId;
    const subject = body.subject ?? null;

    if (!microsoftEmailId || typeof microsoftEmailId !== "string") {
      return NextResponse.json({ error: "microsoftEmailId is required" }, { status: 400 });
    }

    // Upsert — idempotent (marking same email twice is fine)
    const [existing] = await db
      .select()
      .from(actionedEmails)
      .where(
        and(
          eq(actionedEmails.userId, session.user.id),
          eq(actionedEmails.microsoftEmailId, microsoftEmailId)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(actionedEmails)
        .set({ actionedAt: new Date() })
        .where(eq(actionedEmails.id, existing.id));
    } else {
      await db.insert(actionedEmails).values({
        userId: session.user.id,
        microsoftEmailId,
        subject,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[email-actioned] POST error:", err);
    return NextResponse.json({ error: "Failed to mark email as actioned" }, { status: 500 });
  }
}

/**
 * DELETE /api/microsoft/email-actioned
 * Undo actioned status (un-snooze an email back into scan results).
 * Body: { microsoftEmailId: string }
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const microsoftEmailId = body.microsoftEmailId;

    if (!microsoftEmailId || typeof microsoftEmailId !== "string") {
      return NextResponse.json({ error: "microsoftEmailId is required" }, { status: 400 });
    }

    await db
      .delete(actionedEmails)
      .where(
        and(
          eq(actionedEmails.userId, session.user.id),
          eq(actionedEmails.microsoftEmailId, microsoftEmailId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[email-actioned] DELETE error:", err);
    return NextResponse.json({ error: "Failed to undo actioned status" }, { status: 500 });
  }
}

/**
 * GET /api/microsoft/email-actioned
 * Return all actioned email IDs for the current user.
 */
export async function GET(req: NextRequest) {
  void req;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const actioned = await db
      .select({
        microsoftEmailId: actionedEmails.microsoftEmailId,
        subject: actionedEmails.subject,
        actionedAt: actionedEmails.actionedAt,
      })
      .from(actionedEmails)
      .where(eq(actionedEmails.userId, session.user.id))
      .orderBy(actionedEmails.actionedAt);

    return NextResponse.json({ actioned });
  } catch (err) {
    console.error("[email-actioned] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch actioned emails" }, { status: 500 });
  }
}
