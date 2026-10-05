import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace } from "@/lib/data";
import { buildSharePointConnectUrl, buildSharePointState } from "@/lib/sharepoint";

export const GET = auth(async (request) => {
  try {
    if (!request.auth?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceSlug = String(searchParams.get("workspaceSlug") || "").trim();
    if (!workspaceSlug) {
      return NextResponse.json({ error: "Missing workspaceSlug" }, { status: 400 });
    }

    const workspace = await getAuthorizedWorkspace(workspaceSlug, request.auth.user.email);
    if (!workspace) {
      return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
    }

    const state = buildSharePointState({
      workspaceSlug: workspace.slug,
      userId: request.auth.user.id,
      email: request.auth.user.email
    });

    return NextResponse.redirect(buildSharePointConnectUrl(state));
  } catch (error) {
    console.error("SharePoint connect failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not start Microsoft connection"
    }, { status: 500 });
  }
});
