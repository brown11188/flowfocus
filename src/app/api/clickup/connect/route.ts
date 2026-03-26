/**
 * GET /api/clickup/connect
 * Initiates the ClickUp OAuth2 flow (relay-based workaround).
 *
 * ClickUp only accepts a bare domain as redirect_uri, so we:
 *  1. Set redirect_uri = <rootDomain>/clickup-relay.html
 *  2. Encode the real callback path inside `state` (delimited by "|")
 *  3. The relay page forwards the browser to /api/clickup/callback
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAuthorizationUrl, buildRelayUri } from "@/lib/clickup";
import { randomBytes } from "crypto";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // state = userId:random  (path is appended inside buildAuthorizationUrl)
    const state  = `${session.user.id}:${randomBytes(16).toString("hex")}`;
    const authUrl = buildAuthorizationUrl(state);

    console.log("[ClickUp Connect] relay_uri =", buildRelayUri());
    console.log("[ClickUp Connect] auth_url  =", authUrl);

    // Store the short state (without path) in a cookie for CSRF verification
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("clickup_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: BASE_PATH || "/",
    });
    return response;
  } catch (error) {
    console.error("[ClickUp Connect]", error);
    const msg = error instanceof Error ? error.message : "ClickUp not configured";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
