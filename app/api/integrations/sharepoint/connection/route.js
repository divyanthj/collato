import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { disconnectSharePointConnection, getActiveSharePointConnection } from "@/lib/data";
import { summarizeSharePointConnection } from "@/lib/sharepoint-connection";

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

    const connection = await getActiveSharePointConnection({
      workspaceSlug,
      userEmail: request.auth.user.email
    });

    return NextResponse.json({
      connection: summarizeSharePointConnection(connection)
    });
  } catch (error) {
    console.error("SharePoint connection lookup failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not read SharePoint connection"
    }, { status: 500 });
  }
});

export const DELETE = auth(async (request) => {
  try {
    if (!request.auth?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const workspaceSlug = String(body.workspaceSlug || "").trim();
    if (!workspaceSlug) {
      return NextResponse.json({ error: "Missing workspaceSlug" }, { status: 400 });
    }

    await disconnectSharePointConnection({
      workspaceSlug,
      userEmail: request.auth.user.email
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("SharePoint disconnect failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not disconnect SharePoint"
    }, { status: 500 });
  }
});
