import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/microsoft/status
 * Check if user has connected their Microsoft account
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.microsoftConnection.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      microsoftId: true,
      email: true,
      displayName: true,
      accountType: true,
      syncEmailsEnabled: true,
      syncCalendarEnabled: true,
      lastEmailSyncAt: true,
      lastCalendarSyncAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    connected: !!connection,
    connection: connection ?? null,
  });
}

/**
 * DELETE /api/microsoft/status
 * Disconnect Microsoft account
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.microsoftConnection.delete({
    where: { userId: session.user.id },
  }).catch(() => {
    // Ignore if not found
  });

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/microsoft/status
 * Update sync settings
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { syncEmailsEnabled, syncCalendarEnabled } = body;

  const connection = await prisma.microsoftConnection.update({
    where: { userId: session.user.id },
    data: {
      ...(syncEmailsEnabled !== undefined && { syncEmailsEnabled }),
      ...(syncCalendarEnabled !== undefined && { syncCalendarEnabled }),
    },
  });

  return NextResponse.json({ success: true, connection });
}
