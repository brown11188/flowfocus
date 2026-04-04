import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { kanbanColumns, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.color !== undefined) updates.color = body.color;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

  const [col] = await db.update(kanbanColumns).set(updates).where(eq(kanbanColumns.id, id)).returning();
  return NextResponse.json(col);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [col] = await db.select().from(kanbanColumns).where(eq(kanbanColumns.id, id)).limit(1);
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (col.isDefault) return NextResponse.json({ error: "Cannot delete default column" }, { status: 400 });

  // Move tasks in this column to TODO status
  await db.update(tasks).set({ kanbanColumnId: null, status: "TODO" }).where(eq(tasks.kanbanColumnId, id));
  await db.delete(kanbanColumns).where(eq(kanbanColumns.id, id));
  return NextResponse.json({ success: true });
}
