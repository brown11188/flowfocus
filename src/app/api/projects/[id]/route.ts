import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const [updated] = await db.update(projects)
    .set({ name: body.name, color: body.color })
    .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))
    .returning();
  const [{ cnt }] = await db.select({ cnt: count() }).from(tasks).where(eq(tasks.projectId, id));
  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    _count: { tasks: cnt },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))
    .limit(1);
  if (!project || project.isInbox) return NextResponse.json({ error: "Cannot delete" }, { status: 400 });

  const [inbox] = await db.select().from(projects)
    .where(and(eq(projects.userId, session.user.id), eq(projects.isInbox, true)))
    .limit(1);
  if (inbox) {
    await db.update(tasks)
      .set({ projectId: inbox.id })
      .where(and(eq(tasks.projectId, id), eq(tasks.userId, session.user.id)));
  }
  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ success: true });
}
