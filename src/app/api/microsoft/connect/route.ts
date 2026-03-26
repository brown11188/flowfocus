import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const APP_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID ?? "";
const SCOPES = "openid profile email offline_access User.Read Mail.Read Calendars.ReadWrite";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * GET /api/microsoft/connect
 * Initiates Microsoft OAuth as an INTEGRATION connect — keeps the current
 * NextAuth session intact. Generates PKCE + state, stores them in cookies,
 * then redirects to Microsoft's authorize endpoint.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate PKCE verifier + challenge
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(
    crypto.createHash("sha256").update(verifier).digest()
  );

  // Generate state — encode current userId so callback can verify
  const state = base64url(crypto.randomBytes(16));

  // Build the exact redirect URI that Azure has registered.
  // nginx terminates SSL externally and forwards plain http into the container,
  // so x-forwarded-proto is always "http" here — we CANNOT trust it.
  // AUTH_URL is set correctly in the container (https://...) — use that as source of truth.
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  const proto = authUrl.startsWith("https") ? "https" : "http";
  const rawHost = req.headers.get("x-forwarded-host")?.split(",")[0].trim()
    ?? req.headers.get("host");
  const envHost = authUrl ? new URL(authUrl).host : undefined;
  const host = rawHost ?? envHost ?? "localhost";
  // Use the ALREADY-REGISTERED Azure redirect URI — no Azure Portal change needed.
  // The NextAuth route handler intercepts this callback when ms_connect_userid
  // cookie is present, handling the token exchange without creating a new session.
  const redirectUri = `${proto}://${host}${APP_BASE}/api/auth/callback/microsoft-entra-id`;

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    response_mode: "query",
  });

  const authorizeUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;

  console.log("[MS_CONNECT] Initiating OAuth connect", {
    userId: session.user.id,
    redirectUri,
    state,
    debug: {
      rawXForwardedProto: req.headers.get("x-forwarded-proto"),
      rawXForwardedHost: req.headers.get("x-forwarded-host"),
      rawHost: req.headers.get("host"),
      resolvedProto: proto,
      resolvedHost: host,
      AUTH_URL: process.env.AUTH_URL,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    },
  });

  // Store verifier + state + userId in short-lived cookies
  const response = NextResponse.redirect(authorizeUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: proto === "https",
    sameSite: "lax" as const,
    maxAge: 600, // 10 minutes
    path: "/",
  };
  response.cookies.set("ms_connect_verifier", verifier, cookieOpts);
  response.cookies.set("ms_connect_state", state, cookieOpts);
  response.cookies.set("ms_connect_userid", session.user.id, cookieOpts);

  return response;
}
