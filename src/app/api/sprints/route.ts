import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serializeSprint(s: Record<string, unknown>) {
  return {
    ...s,
    startDate: s.startDate instanceof Date ? (s.startDate as Date).toISOString() : s.startDate,
    endDate: s.endDate instanceof Date ? (s.endDate as Date).toISOString() : s.endDate,
    createdAt: s.createdAt instanceof Date ? (s.createdAt as Date).toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? (s.updatedAt as Date).toISOString() : s.updatedAt,
  };
}

// GET /api/sprints?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const sprints = await prisma.sprint.findMany({
    where: { projectId, project: { userId: session.user.id } },
    include: { _count: { select: { tasks: true } } },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json(sprints.map((s) => serializeSprint(s as unknown as Record<string, unknown>)));
}

// POST /api/sprints
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, goal, startDate, endDate, projectId } = await req.json();
  if (!name?.trim() || !startDate || !endDate || !projectId) {
    return NextResponse.json({ error: "name, startDate, endDate, projectId required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const sprint = await prisma.sprint.create({
    data: { name: name.trim(), goal, startDate: new Date(startDate), endDate: new Date(endDate), projectId },
    include: { _count: { select: { tasks: true } } },
  });

  return NextResponse.json(serializeSprint(sprint as unknown as Record<string, unknown>));
}
