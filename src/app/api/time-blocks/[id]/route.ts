import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeBlocks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [existing] = await db.select().from(timeBlocks).where(eq(timeBlocks.id, id)).limit(1);
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Partial<typeof timeBlocks.$inferInsert> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.startTime !== undefined) data.startTime = body.startTime;
  if (body.endTime !== undefined) data.endTime = body.endTime;
  if (body.date !== undefined) data.date = body.date;
  if (body.color !== undefined) data.color = body.color;
  if (body.note !== undefined) data.note = body.note;
  if (body.taskId !== undefined) data.taskId = body.taskId;

  const [block] = await db.update(timeBlocks).set(data).where(eq(timeBlocks.id, id)).returning();
  return NextResponse.json(block);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [existing] = await db.select().from(timeBlocks).where(eq(timeBlocks.id, id)).limit(1);
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(timeBlocks).where(eq(timeBlocks.id, id));
  return NextResponse.json({ success: true });
}
