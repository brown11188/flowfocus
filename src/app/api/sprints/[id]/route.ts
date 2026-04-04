import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { sprints, tasks } from "@/db/schema";
import { eq, and, ne, count } from "drizzle-orm";

function serializeSprint(s: Record<string, unknown>) {
  return {
    ...s,
    startDate: s.startDate instanceof Date ? (s.startDate as Date).toISOString() : s.startDate,
    endDate: s.endDate instanceof Date ? (s.endDate as Date).toISOString() : s.endDate,
    createdAt: s.createdAt instanceof Date ? (s.createdAt as Date).toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? (s.updatedAt as Date).toISOString() : s.updatedAt,
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.goal !== undefined) updates.goal = body.goal;
  if (body.startDate !== undefined) updates.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) updates.endDate = new Date(body.endDate);
  if (body.isActive !== undefined) {
    updates.isActive = body.isActive;
    // Deactivate other sprints in same project if activating this one
    if (body.isActive) {
      const [sprint] = await db.select().from(sprints).where(eq(sprints.id, id)).limit(1);
      if (sprint) {
        await db.update(sprints).set({ isActive: false }).where(and(eq(sprints.projectId, sprint.projectId), ne(sprints.id, id)));
      }
    }
  }

  const [sprint] = await db.update(sprints).set(updates).where(eq(sprints.id, id)).returning();
  const [{ value: taskCount }] = await db.select({ value: count() }).from(tasks).where(eq(tasks.sprintId, id));
  return NextResponse.json(serializeSprint({ ...sprint, _count: { tasks: taskCount } } as unknown as Record<string, unknown>));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Remove tasks from sprint before deleting
  await db.update(tasks).set({ sprintId: null }).where(eq(tasks.sprintId, id));
  await db.delete(sprints).where(eq(sprints.id, id));
  return NextResponse.json({ success: true });
}
