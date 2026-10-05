import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSharePointConnectionWithAccessToken } from "@/lib/sharepoint-connection";
import { listSharePointDrives } from "@/lib/sharepoint";

export const GET = auth(async (request) => {
  try {
    if (!request.auth?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceSlug = String(searchParams.get("workspaceSlug") || "").trim();
    const siteId = String(searchParams.get("siteId") || "").trim();
    if (!workspaceSlug || !siteId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { accessToken } = await getSharePointConnectionWithAccessToken({
      workspaceSlug,
      userEmail: request.auth.user.email
    });
    const drives = await listSharePointDrives(accessToken, siteId);

    return NextResponse.json({
      drives: drives.map((drive) => ({
        id: drive.id,
        name: drive.name || "Documents",
        driveType: drive.driveType || "",
        webUrl: drive.webUrl || ""
      }))
    });
  } catch (error) {
    console.error("SharePoint drive listing failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not list SharePoint libraries"
    }, { status: 500 });
  }
});
