import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { id } = await params;
  const body = await req.json();

  const [updated] = await db
    .update(projects)
    .set({ name: body.name, color: body.color })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();

  const [taskCount] = await db
    .select({ count: count() })
    .from(tasks)
    .where(eq(tasks.projectId, updated.id));

  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    lastHealthCheckAt: updated.lastHealthCheckAt?.toISOString() ?? null,
    _count: { tasks: taskCount.count },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: (p, { eq: e, and: a }) => a(e(p.id, id), e(p.userId, userId)),
  });
  if (!project || project.isInbox) return NextResponse.json({ error: "Cannot delete" }, { status: 400 });

  const inbox = await db.query.projects.findFirst({
    where: (p, { eq: e, and: a }) => a(e(p.userId, userId), e(p.isInbox, true)),
  });
  if (inbox) {
    await db.update(tasks)
      .set({ projectId: inbox.id })
      .where(and(eq(tasks.projectId, id), eq(tasks.userId, userId)));
  }

  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ success: true });
}
