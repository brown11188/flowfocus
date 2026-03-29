import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetOtp } from "@/lib/email";

export const dynamic = "force-dynamic";

// Rate-limit map: email -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(email, { count: 1, resetAt: now + 60 * 60 * 1000 }); // 1h window
    return true;
  }
  if (entry.count >= 3) return false; // max 3 requests/hour
  entry.count++;
  return true;
}

// Generate a 6-digit numeric OTP
function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();

    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    // Always respond with success to prevent user enumeration
    // (don't reveal whether an email exists or not)
    const genericOk = NextResponse.json({
      message: "If an account with that email exists, an OTP has been sent.",
    });

    // Rate limit
    if (!checkRateLimit(email)) {
      // Return generic OK to prevent enumeration even on rate limit
      return genericOk;
    }

    // Look up user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return genericOk;

    // Users who signed up via OAuth only (no password) cannot reset via credentials
    // but we still return generic OK for security
    if (!user.password) return genericOk;

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate any previous unexpired tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    // Create new token
    await prisma.passwordResetToken.create({
      data: { userId: user.id, email, otp, expiresAt },
    });

    // Send email
    await sendPasswordResetOtp({ to: email, name: user.name, otp });

    return genericOk;
  } catch (err) {
    console.error("[forgot-password] Error:", err);
    return NextResponse.json(
      { error: "Failed to process request. Please try again." },
      { status: 500 }
    );
  }
}
