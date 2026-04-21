import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createWorkspaceTask, getAuthorizedWorkspace } from "@/lib/data";
import { getDisplayNameFromEmail } from "@/lib/user-display-name";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const workspaceSlug = String(body.workspaceSlug ?? "").trim();
    const title = String(body.title ?? "").trim();
    if (!workspaceSlug || !title) {
        return NextResponse.json({ error: "Workspace and task title are required" }, { status: 400 });
    }
    const workspace = await getAuthorizedWorkspace(workspaceSlug, request.auth.user.email);
    if (!workspace) {
        return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
    }
    const task = await createWorkspaceTask({
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        title,
        description: String(body.description ?? ""),
        assigneeEmail: String(body.assigneeEmail ?? "").trim().toLowerCase(),
        assigneeName: String(body.assigneeName ?? "").trim(),
        dueDate: body.dueDate ? String(body.dueDate) : null,
        sourceUpdateId: String(body.sourceUpdateId ?? ""),
        createdBy: request.auth.user.email,
        createdByName: getDisplayNameFromEmail(request.auth.user.email, "Signed in user", request.auth.user.name)
    });
    return NextResponse.json(task, { status: 201 });
});
