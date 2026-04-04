import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { meetingNotes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

function serialize(item: Record<string, unknown>) {
  return {
    ...item,
    meetingDate: item.meetingDate instanceof Date ? item.meetingDate.toISOString() : item.meetingDate,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [item] = await db.select().from(meetingNotes).where(and(eq(meetingNotes.id, id), eq(meetingNotes.userId, session.user.id))).limit(1);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serialize(item as unknown as Record<string, unknown>));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [existing] = await db.select().from(meetingNotes).where(and(eq(meetingNotes.id, id), eq(meetingNotes.userId, session.user.id))).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) data.title = String(body.title);
  if (body.rawNotes !== undefined) data.content = String(body.rawNotes);
  if (body.content !== undefined) data.content = String(body.content);

  const [updated] = await db.update(meetingNotes).set(data).where(eq(meetingNotes.id, id)).returning();
  return NextResponse.json(serialize(updated as unknown as Record<string, unknown>));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [existing] = await db.select().from(meetingNotes).where(and(eq(meetingNotes.id, id), eq(meetingNotes.userId, session.user.id))).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(meetingNotes).where(eq(meetingNotes.id, id));
  return NextResponse.json({ success: true });
}
