import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceDetailData } from "@/lib/data";
import { generateWorkspaceKnowledgeSummary, persistWorkspaceKnowledgeSummary } from "@/lib/workspace-summary";

export const POST = auth(async (request) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const workspaceSlug = String(body.workspaceSlug ?? "").trim();

  if (!workspaceSlug) {
    return NextResponse.json({ error: "Workspace slug is required" }, { status: 400 });
  }

  const data = await getWorkspaceDetailData(workspaceSlug, request.auth.user.email);

  if (!data) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const summary = await generateWorkspaceKnowledgeSummary(data);
  await persistWorkspaceKnowledgeSummary(workspaceSlug, summary);

  return NextResponse.json(summary, { status: 200 });
});
