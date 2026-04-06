import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, saveWorkspaceFile } from "@/lib/data";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    if (!body.workspaceSlug || !body.workspaceName || !body.fileName || !body.knowledgeText) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const workspace = await getAuthorizedWorkspace(String(body.workspaceSlug), request.auth.user.email);
    if (!workspace) {
        return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
    }
    const file = await saveWorkspaceFile({
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        fileName: String(body.fileName),
        fileType: body.fileType ? String(body.fileType) : "Unknown",
        sizeLabel: body.sizeLabel ? String(body.sizeLabel) : "Unknown size",
        knowledgeText: String(body.knowledgeText),
        uploadedBy: request.auth.user.email
    });
    return NextResponse.json(file, { status: 201 });
});
