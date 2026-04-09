import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, isOrganizationOwner, updateWorkspaceFileAiPrivacy } from "@/lib/data";

export const PATCH = auth(async (request, context) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const workspaceSlug = typeof body.workspaceSlug === "string" ? body.workspaceSlug : "";
  const aiPrivate = typeof body.aiPrivate === "boolean" ? body.aiPrivate : null;

  if (!workspaceSlug || aiPrivate === null) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const workspace = await getAuthorizedWorkspace(workspaceSlug, request.auth.user.email);
  if (!workspace) {
    return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
  }

  const canManageAiPrivacy = await isOrganizationOwner(workspace.organizationSlug, request.auth.user.email);
  if (!canManageAiPrivacy) {
    return NextResponse.json({ error: "Only the organization owner can manage AI privacy" }, { status: 403 });
  }

  try {
    const updated = await updateWorkspaceFileAiPrivacy({
      fileId: context.params.id,
      workspaceSlug: workspace.slug,
      aiPrivate
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update file privacy";
    const status = message === "Workspace file not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
