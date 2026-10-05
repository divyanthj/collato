import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSharePointConnectionWithAccessToken } from "@/lib/sharepoint-connection";
import { listSharePointSites } from "@/lib/sharepoint";

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

    const { accessToken } = await getSharePointConnectionWithAccessToken({
      workspaceSlug,
      userEmail: request.auth.user.email
    });
    const sites = await listSharePointSites(accessToken);

    return NextResponse.json({
      sites: sites.map((site) => ({
        id: site.id,
        name: site.name || site.displayName || site.webUrl,
        displayName: site.displayName || site.name || "SharePoint site",
        webUrl: site.webUrl || ""
      }))
    });
  } catch (error) {
    console.error("SharePoint site listing failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not list SharePoint sites"
    }, { status: 500 });
  }
});
