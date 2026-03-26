import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serializeMilestone(m: Record<string, unknown>) {
  return {
    ...m,
    targetDate: m.targetDate instanceof Date ? (m.targetDate as Date).toISOString() : m.targetDate,
    createdAt: m.createdAt instanceof Date ? (m.createdAt as Date).toISOString() : m.createdAt,
    updatedAt: m.updatedAt instanceof Date ? (m.updatedAt as Date).toISOString() : m.updatedAt,
    tasks: Array.isArray(m.tasks) ? (m.tasks as Array<Record<string, unknown>>).map((mt) => ({
      ...mt,
      task: mt.task ? serializeTask(mt.task as Record<string, unknown>) : null,
    })) : [],
  };
}

function serializeTask(t: Record<string, unknown>) {
  return {
    ...t,
    dueDate: t.dueDate instanceof Date ? (t.dueDate as Date).toISOString() : (t.dueDate ?? null),
    completedAt: t.completedAt instanceof Date ? (t.completedAt as Date).toISOString() : (t.completedAt ?? null),
    createdAt: t.createdAt instanceof Date ? (t.createdAt as Date).toISOString() : t.createdAt,
    updatedAt: t.updatedAt instanceof Date ? (t.updatedAt as Date).toISOString() : t.updatedAt,
  };
}

const MILESTONE_INCLUDE = {
  tasks: { include: { task: { select: { id: true, title: true, completed: true, priority: true, dueDate: true } } } },
  _count: { select: { tasks: true } },
};

// GET /api/milestones?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const where = projectId
    ? { projectId, project: { userId: session.user.id } }
    : { project: { userId: session.user.id } };

  const milestones = await prisma.milestone.findMany({
    where,
    include: MILESTONE_INCLUDE,
    orderBy: { targetDate: "asc" },
  });

  return NextResponse.json(milestones.map((m) => serializeMilestone(m as unknown as Record<string, unknown>)));
}

// POST /api/milestones
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, targetDate, projectId } = await req.json();
  if (!name?.trim() || !targetDate || !projectId) {
    return NextResponse.json({ error: "name, targetDate, projectId required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const milestone = await prisma.milestone.create({
    data: { name: name.trim(), description, targetDate: new Date(targetDate), projectId },
    include: MILESTONE_INCLUDE,
  });

  return NextResponse.json(serializeMilestone(milestone as unknown as Record<string, unknown>));
}
