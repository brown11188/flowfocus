import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_COLUMNS = [
  { name: "To Do",      color: "#6366f1", sortOrder: 0, isDefault: true },
  { name: "In Progress",color: "#f59e0b", sortOrder: 1, isDefault: true },
  { name: "Review",     color: "#8b5cf6", sortOrder: 2, isDefault: true },
  { name: "Done",       color: "#10b981", sortOrder: 3, isDefault: true },
];

// GET /api/kanban?projectId=xxx — get or auto-create columns
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let columns = await prisma.kanbanColumn.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
  });

  // Auto-create default columns if none exist
  if (columns.length === 0) {
    await prisma.kanbanColumn.createMany({
      data: DEFAULT_COLUMNS.map((c) => ({ ...c, projectId })),
    });
    columns = await prisma.kanbanColumn.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
    });
  }

  return NextResponse.json(columns);
}

// POST /api/kanban — create custom column
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, name, color } = await req.json();
  if (!projectId || !name?.trim()) return NextResponse.json({ error: "projectId and name required" }, { status: 400 });

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const maxOrder = await prisma.kanbanColumn.aggregate({ where: { projectId }, _max: { sortOrder: true } });
  const column = await prisma.kanbanColumn.create({
    data: { name: name.trim(), color: color ?? "#6366f1", projectId, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1, isDefault: false },
  });

  return NextResponse.json(column);
}
