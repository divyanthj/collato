import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, isOrganizationOwner, updateWorkspaceUpdateActionState, updateWorkspaceUpdateAiPrivacy } from "@/lib/data";

const ACTION_ITEM_STATES = new Set(["active", "hidden", "suppressed", "archived"]);

export const PATCH = auth(async (request, context) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const workspaceSlug = typeof body.workspaceSlug === "string" ? body.workspaceSlug : "";
  const actionKey = typeof body.actionKey === "string" ? body.actionKey : "";
  const state = typeof body.state === "string" ? body.state : "";
  const aiPrivate = typeof body.aiPrivate === "boolean" ? body.aiPrivate : null;
  const isActionStateMutation = Boolean(actionKey) || Boolean(state);
  const isAiPrivacyMutation = aiPrivate !== null;

  if (!workspaceSlug || (!isActionStateMutation && !isAiPrivacyMutation)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const workspace = await getAuthorizedWorkspace(workspaceSlug, request.auth.user.email);
  if (!workspace) {
    return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
  }

  try {
    if (isAiPrivacyMutation) {
      const canManageAiPrivacy = await isOrganizationOwner(workspace.organizationSlug, request.auth.user.email);
      if (!canManageAiPrivacy) {
        return NextResponse.json({ error: "Only the organization owner can manage AI privacy" }, { status: 403 });
      }

      const updated = await updateWorkspaceUpdateAiPrivacy({
        updateId: context.params.id,
        workspaceSlug: workspace.slug,
        aiPrivate
      });

      return NextResponse.json(updated);
    }

    if (!actionKey || !ACTION_ITEM_STATES.has(state)) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const updated = await updateWorkspaceUpdateActionState({
      updateId: context.params.id,
      workspaceSlug: workspace.slug,
      actionKey,
      state
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update action item";
    const status = message === "Workspace update not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
