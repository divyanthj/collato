import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, updateWorkspaceTask } from "@/lib/data";
const ALLOWED_STATUSES = ["open", "in_progress", "done"];
export async function PATCH(request, context) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const workspaceSlug = String(body.workspaceSlug ?? "").trim();
    if (!workspaceSlug) {
        return NextResponse.json({ error: "Workspace slug is required" }, { status: 400 });
    }
    const workspace = await getAuthorizedWorkspace(workspaceSlug, session.user.email);
    if (!workspace) {
        return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
    }
    try {
        const status = typeof body.status === "string" && ALLOWED_STATUSES.includes(body.status)
            ? body.status
            : undefined;
        const task = await updateWorkspaceTask({
            taskId: context.params.id,
            workspaceSlug,
            status,
            assigneeEmail: typeof body.assigneeEmail === "string" ? body.assigneeEmail : undefined,
            assigneeName: typeof body.assigneeName === "string" ? body.assigneeName : undefined,
            dueDate: body.dueDate === null || typeof body.dueDate === "string" ? body.dueDate : undefined,
            title: typeof body.title === "string" ? body.title : undefined,
            description: typeof body.description === "string" ? body.description : undefined
        });
        return NextResponse.json(task, { status: 200 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not update task";
        const statusCode = message === "Task not found" ? 404 : 400;
        return NextResponse.json({ error: message }, { status: statusCode });
    }
}
