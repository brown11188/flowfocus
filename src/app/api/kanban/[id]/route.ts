import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.color !== undefined) updates.color = body.color;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

  const col = await prisma.kanbanColumn.update({ where: { id }, data: updates });
  return NextResponse.json(col);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const col = await prisma.kanbanColumn.findUnique({ where: { id } });
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (col.isDefault) return NextResponse.json({ error: "Cannot delete default column" }, { status: 400 });

  // Move tasks in this column to TODO status
  await prisma.task.updateMany({ where: { kanbanColumnId: id }, data: { kanbanColumnId: null, status: "TODO" } });
  await prisma.kanbanColumn.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
