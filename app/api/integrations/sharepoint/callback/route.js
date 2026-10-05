import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, upsertSharePointConnection } from "@/lib/data";
import {
  encryptSharePointToken,
  exchangeSharePointCode,
  getSharePointProfile,
  readSharePointState
} from "@/lib/sharepoint";

function buildRedirect(requestUrl, workspaceSlug, params = {}) {
  const url = new URL(`/dashboard/${encodeURIComponent(workspaceSlug)}/knowledge`, requestUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

export const GET = auth(async (request) => {
  const { searchParams } = new URL(request.url);
  let workspaceSlug = "";

  try {
    if (!request.auth?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const error = searchParams.get("error");
    if (error) {
      throw new Error(searchParams.get("error_description") || error);
    }

    const code = String(searchParams.get("code") || "");
    const state = readSharePointState(searchParams.get("state"));
    workspaceSlug = state.workspaceSlug;

    if (state.userId !== request.auth.user.id || state.email !== request.auth.user.email) {
      throw new Error("Microsoft connection must be completed by the same Collato user.");
    }

    const workspace = await getAuthorizedWorkspace(workspaceSlug, request.auth.user.email);
    if (!workspace) {
      throw new Error("You do not have access to this workspace.");
    }
    if (!code) {
      throw new Error("Microsoft did not return an authorization code.");
    }

    const token = await exchangeSharePointCode(code);
    const profile = await getSharePointProfile(token.access_token);
    const microsoftEmail = profile.mail || profile.userPrincipalName || "";

    await upsertSharePointConnection({
      workspaceSlug: workspace.slug,
      userId: request.auth.user.id,
      userEmail: request.auth.user.email,
      microsoftAccountEmail: microsoftEmail,
      microsoftDisplayName: profile.displayName || microsoftEmail,
      microsoftAccountId: profile.id,
      encryptedRefreshToken: encryptSharePointToken(token.refresh_token),
      encryptedAccessToken: encryptSharePointToken(token.access_token),
      accessTokenExpiresAt: new Date(Date.now() + Number(token.expires_in || 3600) * 1000),
      scope: token.scope
    });

    return NextResponse.redirect(buildRedirect(request.url, workspace.slug, {
      sharepoint: "connected"
    }));
  } catch (error) {
    console.error("SharePoint callback failed:", error);
    const fallbackSlug = workspaceSlug || "workspace";
    return NextResponse.redirect(buildRedirect(request.url, fallbackSlug, {
      sharepoint: "error",
      message: error instanceof Error ? error.message : "Could not connect Microsoft"
    }));
  }
});
