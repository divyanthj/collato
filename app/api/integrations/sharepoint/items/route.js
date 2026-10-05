import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSharePointConnectionWithAccessToken } from "@/lib/sharepoint-connection";
import { listSharePointItems } from "@/lib/sharepoint";

export const GET = auth(async (request) => {
  try {
    if (!request.auth?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceSlug = String(searchParams.get("workspaceSlug") || "").trim();
    const driveId = String(searchParams.get("driveId") || "").trim();
    const itemId = String(searchParams.get("itemId") || "").trim();
    if (!workspaceSlug || !driveId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { accessToken } = await getSharePointConnectionWithAccessToken({
      workspaceSlug,
      userEmail: request.auth.user.email
    });
    const items = await listSharePointItems(accessToken, driveId, itemId);

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        name: item.name || "Untitled",
        webUrl: item.webUrl || "",
        eTag: item.eTag || "",
        size: item.size || 0,
        folder: Boolean(item.folder),
        file: Boolean(item.file),
        mimeType: item.file?.mimeType || "",
        parentReference: {
          path: item.parentReference?.path || ""
        },
        lastModifiedDateTime: item.lastModifiedDateTime || ""
      }))
    });
  } catch (error) {
    console.error("SharePoint item listing failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not list SharePoint files"
    }, { status: 500 });
  }
});
