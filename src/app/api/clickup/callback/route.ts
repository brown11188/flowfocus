/**
 * GET /api/clickup/callback
 * Handles the OAuth2 callback forwarded by /clickup-relay.html.
 *
 * Flow:
 *  ClickUp → <rootDomain>/clickup-relay.html?code=&state=userId:random|/path
 *  relay.html strips the path suffix, reconstructs short state, then redirects:
 *  → /apps/.../api/clickup/callback?code=&state=userId:random
 *
 * After successful OAuth, redirects to settings with available workspaces
 * for the user to select which ones to connect.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeCodeForToken, ClickUpClient } from "@/lib/clickup";
import { prisma } from "@/lib/prisma";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export async function GET(req: NextRequest) {
  const session = await auth();
  const { searchParams } = req.nextUrl;

  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = (suffix: string) =>
    new URL(`${BASE_PATH}/settings?tab=integrations${suffix}`, req.nextUrl.origin);

  if (error) {
    return NextResponse.redirect(settingsUrl(`&clickup_error=${encodeURIComponent(error)}`));
  }
  if (!code) {
    return NextResponse.redirect(settingsUrl("&clickup_error=missing_code"));
  }

  // CSRF: verify state cookie against state param
  const storedState = req.cookies.get("clickup_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    console.warn("[ClickUp Callback] state mismatch", { storedState, state });
    return NextResponse.redirect(settingsUrl("&clickup_error=invalid_state"));
  }

  // Extract userId from state prefix (format: userId:random)
  const stateUserId   = state?.split(":")[0];
  const sessionUserId = session?.user?.id;
  if (!sessionUserId || stateUserId !== sessionUserId) {
    return NextResponse.redirect(settingsUrl("&clickup_error=unauthorized"));
  }

  try {
    // 1. Exchange code → access token
    const tokenData = await exchangeCodeForToken(code);

    // 2. Fetch all available workspaces
    const client     = new ClickUpClient(tokenData.access_token);
    const workspaces = await client.getWorkspaces();
    if (workspaces.length === 0) {
      return NextResponse.redirect(settingsUrl("&clickup_error=no_workspace"));
    }

    // 3. Upsert ClickUpConnection (holds the token)
    const connection = await prisma.clickUpConnection.upsert({
      where:  { userId: sessionUserId },
      create: {
        userId:      sessionUserId,
        accessToken: tokenData.access_token,
        tokenType:   tokenData.token_type ?? "Bearer",
      },
      update: {
        accessToken: tokenData.access_token,
        tokenType:   tokenData.token_type ?? "Bearer",
        updatedAt:   new Date(),
      },
    });

    // 4. If only one workspace, auto-connect it
    //    Otherwise, redirect to settings with workspace selection UI
    if (workspaces.length === 1) {
      const ws = workspaces[0];
      await prisma.clickUpWorkspaceConnection.upsert({
        where: { userId_teamId: { userId: sessionUserId, teamId: ws.id } },
        create: {
          connectionId: connection.id,
          userId:       sessionUserId,
          teamId:       ws.id,
          teamName:     ws.name,
          isActive:     true,
          syncEnabled:  true,
        },
        update: {
          teamName:  ws.name,
          isActive:  true,
          updatedAt: new Date(),
        },
      });

      const response = NextResponse.redirect(settingsUrl("&clickup_success=1"));
      response.cookies.delete("clickup_oauth_state");
      return response;
    }

    // 5. Multiple workspaces: encode them in URL for the UI to display
    const workspacesParam = encodeURIComponent(
      JSON.stringify(workspaces.map((ws) => ({ id: ws.id, name: ws.name })))
    );
    const response = NextResponse.redirect(
      settingsUrl(`&clickup_success=1&clickup_select_workspaces=${workspacesParam}`)
    );
    response.cookies.delete("clickup_oauth_state");
    return response;
  } catch (err) {
    console.error("[ClickUp Callback]", err);
    const msg = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.redirect(settingsUrl(`&clickup_error=${encodeURIComponent(msg)}`));
  }
}
