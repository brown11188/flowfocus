import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const updated = await prisma.project.update({
    where: { id, userId: session.user.id },
    data: { name: body.name, color: body.color },
    include: { _count: { select: { tasks: true } } },
  });
  return NextResponse.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: session.user.id } });
  if (!project || project.isInbox) return NextResponse.json({ error: "Cannot delete" }, { status: 400 });

  const inbox = await prisma.project.findFirst({ where: { userId: session.user.id, isInbox: true } });
  if (inbox) {
    await prisma.task.updateMany({ where: { projectId: id, userId: session.user.id }, data: { projectId: inbox.id } });
  }
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
