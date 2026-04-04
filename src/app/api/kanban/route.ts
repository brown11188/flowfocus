import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projects, kanbanColumns } from "@/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";

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

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let columns = await db
    .select()
    .from(kanbanColumns)
    .where(eq(kanbanColumns.projectId, projectId))
    .orderBy(asc(kanbanColumns.sortOrder));

  // Auto-create default columns if none exist
  if (columns.length === 0) {
    await db.insert(kanbanColumns).values(DEFAULT_COLUMNS.map((c) => ({ ...c, projectId })));
    columns = await db
      .select()
      .from(kanbanColumns)
      .where(eq(kanbanColumns.projectId, projectId))
      .orderBy(asc(kanbanColumns.sortOrder));
  }

  return NextResponse.json(columns);
}

// POST /api/kanban — create custom column
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, name, color } = await req.json();
  if (!projectId || !name?.trim()) return NextResponse.json({ error: "projectId and name required" }, { status: 400 });

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [maxResult] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${kanbanColumns.sortOrder}), 0)` })
    .from(kanbanColumns)
    .where(eq(kanbanColumns.projectId, projectId));

  const [column] = await db
    .insert(kanbanColumns)
    .values({ name: name.trim(), color: color ?? "#6366f1", projectId, sortOrder: (maxResult.maxOrder ?? 0) + 1, isDefault: false })
    .returning();

  return NextResponse.json(column);
}
