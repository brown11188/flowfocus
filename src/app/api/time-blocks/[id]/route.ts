import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { timeBlocks } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(timeBlocks).where(eq(timeBlocks.id, id)).limit(1);
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [block] = await db.update(timeBlocks).set({
    ...(body.title !== undefined && { title: body.title }),
    ...(body.startTime !== undefined && { startTime: body.startTime }),
    ...(body.endTime !== undefined && { endTime: body.endTime }),
    ...(body.date !== undefined && { date: body.date }),
    ...(body.color !== undefined && { color: body.color }),
    ...(body.note !== undefined && { note: body.note }),
    ...(body.taskId !== undefined && { taskId: body.taskId }),
  }).where(eq(timeBlocks.id, id)).returning();
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
