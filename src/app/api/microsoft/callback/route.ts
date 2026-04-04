import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { microsoftConnections } from "@/lib/db/schema";
import { createId } from "@paralleldrive/cuid2";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const APP_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID ?? "";
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET ?? "";

/**
 * GET /api/microsoft/callback
 * Receives the OAuth code from Microsoft, exchanges it for tokens,
 * fetches the Graph profile, and upserts MicrosoftConnection for the
 * ORIGINAL logged-in user (from the ms_connect_userid cookie).
 * Does NOT touch the NextAuth session — the user stays logged in as-is.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  const redirectBase = `${APP_BASE}/microsoft`;

  // ── 1. Check for Microsoft error response
  if (errorParam) {
    console.error("[MS_CALLBACK] Microsoft returned error", { errorParam, errorDesc });
    return NextResponse.redirect(
      new URL(`${redirectBase}?microsoft_error=${encodeURIComponent(errorParam)}`, req.url)
    );
  }

  // ── 2. Validate state cookie
  const savedState = req.cookies.get("ms_connect_state")?.value;
  const verifier = req.cookies.get("ms_connect_verifier")?.value;
  const userId = req.cookies.get("ms_connect_userid")?.value;

  console.log("[MS_CALLBACK] Received callback", {
    hasCode: !!code,
    hasState: !!state,
    stateMatch: state === savedState,
    hasVerifier: !!verifier,
    hasUserId: !!userId,
  });

  if (!code || !state || !savedState || state !== savedState || !verifier || !userId) {
    console.error("[MS_CALLBACK] Invalid state or missing cookies", {
      hasCode: !!code,
      stateMatch: state === savedState,
      hasVerifier: !!verifier,
      hasUserId: !!userId,
    });
    const resp = NextResponse.redirect(
      new URL(`${redirectBase}?microsoft_error=invalid_state`, req.url)
    );
    clearCookies(resp);
    return resp;
  }

  // ── 3. Build redirect_uri (must exactly match what /connect sent)
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost";
  const redirectUri = `${proto}://${host}${APP_BASE}/api/microsoft/callback`;

  // ── 4. Exchange code for tokens
  let tokenData: Record<string, unknown>;
  try {
    const tokenRes = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: MS_CLIENT_ID,
          client_secret: MS_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code_verifier: verifier,
        }),
      }
    );
    tokenData = await tokenRes.json() as Record<string, unknown>;

    if (tokenData.error) {
      console.error("[MS_CALLBACK] Token exchange failed", {
        error: tokenData.error,
        error_description: tokenData.error_description,
        error_codes: tokenData.error_codes,
      });
      const resp = NextResponse.redirect(
        new URL(`${redirectBase}?microsoft_error=${encodeURIComponent(String(tokenData.error))}`, req.url)
      );
      clearCookies(resp);
      return resp;
    }

    console.log("[MS_CALLBACK] Token exchange success", {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      hasIdToken: !!tokenData.id_token,
      scope: tokenData.scope,
    });
  } catch (e) {
    console.error("[MS_CALLBACK] Token exchange threw", e);
    const resp = NextResponse.redirect(
      new URL(`${redirectBase}?microsoft_error=token_exchange_failed`, req.url)
    );
    clearCookies(resp);
    return resp;
  }

  // ── 5. Fetch Microsoft Graph profile
  let graphProfile: Record<string, unknown> = {};
  try {
    const graphRes = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,displayName",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    if (graphRes.ok) {
      graphProfile = await graphRes.json() as Record<string, unknown>;
      console.log("[MS_CALLBACK] Graph profile fetched", {
        hasId: !!graphProfile.id,
        hasMail: !!graphProfile.mail,
        hasUPN: !!graphProfile.userPrincipalName,
      });
    } else {
      console.error("[MS_CALLBACK] Graph API failed", { status: graphRes.status });
    }
  } catch (e) {
    console.error("[MS_CALLBACK] Graph API threw", e);
  }

  // ── 6. Upsert MicrosoftConnection for the ORIGINAL userId (current session)
  const microsoftId = (graphProfile.id ?? "") as string;
  const email = (graphProfile.mail ?? graphProfile.userPrincipalName ?? "") as string;
  const displayName = (graphProfile.displayName ?? "") as string;
  const accessToken = tokenData.access_token as string;
  const refreshToken = (tokenData.refresh_token as string | undefined) ?? null;
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + (tokenData.expires_in as number) * 1000)
    : null;
  const scopes = (tokenData.scope as string | undefined) ?? null;

  try {
    await db.insert(microsoftConnections)
      .values({ id: createId(), userId, microsoftId, email, displayName, accessToken, refreshToken, expiresAt, scopes, accountType: "work" })
      .onConflictDoUpdate({ target: microsoftConnections.userId, set: { microsoftId, email, displayName, accessToken, refreshToken, expiresAt, scopes } });
    console.log("[MS_CALLBACK] MicrosoftConnection saved", { userId, email });
  } catch (e) {
    console.error("[MS_CALLBACK] DB upsert failed", e);
    const resp = NextResponse.redirect(
      new URL(`${redirectBase}?microsoft_error=db_save_failed`, req.url)
    );
    clearCookies(resp);
    return resp;
  }

  // ── 7. Success — redirect back to /microsoft page, session UNCHANGED
  const resp = NextResponse.redirect(
    new URL(`${redirectBase}?microsoft_connected=true`, req.url)
  );
  clearCookies(resp);
  return resp;
}

function clearCookies(resp: NextResponse) {
  resp.cookies.set("ms_connect_verifier", "", { maxAge: 0, path: "/" });
  resp.cookies.set("ms_connect_state", "", { maxAge: 0, path: "/" });
  resp.cookies.set("ms_connect_userid", "", { maxAge: 0, path: "/" });
}
