import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { tasks: { where: { isDeleted: false, completed: false } } } } },
    orderBy: [{ isInbox: "desc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json(projects.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    lastHealthCheckAt: p.lastHealthCheckAt?.toISOString() ?? null,
  })));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, healthStatus, healthScore, healthSummary, name, color } = await req.json();
  if (!id) return NextResponse.json({ error: "Project id required" }, { status: 400 });

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(healthStatus !== undefined ? { healthStatus } : {}),
      ...(healthScore !== undefined ? { healthScore: Number(healthScore) } : {}),
      ...(healthSummary !== undefined ? { healthSummary } : {}),
      ...(healthStatus !== undefined || healthScore !== undefined || healthSummary !== undefined ? { lastHealthCheckAt: new Date() } : {}),
    },
    include: { _count: { select: { tasks: true } } },
  });

  return NextResponse.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    lastHealthCheckAt: project.lastHealthCheckAt?.toISOString() ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, color = "#6366f1", healthStatus, healthScore, healthSummary } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      color,
      userId: session.user.id,
      ...(healthStatus ? { healthStatus } : {}),
      ...(healthScore !== undefined ? { healthScore: Number(healthScore) } : {}),
      ...(healthSummary !== undefined ? { healthSummary } : {}),
      lastHealthCheckAt: healthStatus || healthScore !== undefined || healthSummary !== undefined ? new Date() : null,
    },
    include: { _count: { select: { tasks: true } } },
  });

  return NextResponse.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    lastHealthCheckAt: project.lastHealthCheckAt?.toISOString() ?? null,
  });
}
