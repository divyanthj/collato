import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, saveWorkspaceUpdate } from "@/lib/data";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    if (!body.workspaceSlug || !body.workspaceName || !body.channel || !body.body || !body.structured) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const workspace = await getAuthorizedWorkspace(String(body.workspaceSlug), request.auth.user.email);
    if (!workspace) {
        return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
    }
    const update = await saveWorkspaceUpdate({
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        channel: String(body.channel),
        inputMethod: body.inputMethod === "voice" ? "voice" : "typed",
        body: String(body.body),
        createdBy: request.auth.user.email,
        createdByName: request.auth.user.name ?? "Signed in user",
        structured: body.structured
    });
    return NextResponse.json(update, { status: 201 });
});
