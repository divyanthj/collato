import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addWorkspaceMember, removeWorkspaceMember } from "@/lib/data";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const workspaceSlug = String(body.workspaceSlug ?? "").trim();
    const memberEmail = String(body.memberEmail ?? "").trim();
    if (!workspaceSlug || !memberEmail) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    try {
        const workspace = await addWorkspaceMember({
            workspaceSlug,
            requesterEmail: request.auth.user.email,
            memberEmail
        });
        return NextResponse.json(workspace, { status: 200 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not add member";
        const status = message === "Only workspace owners or organization admins can manage workspace access"
            ? 403
            : message === "Workspace not found"
                ? 404
                : 400;
        return NextResponse.json({ error: message }, { status });
    }
});
export const DELETE = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const workspaceSlug = String(body.workspaceSlug ?? "").trim();
    const memberEmail = String(body.memberEmail ?? "").trim();
    if (!workspaceSlug || !memberEmail) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    try {
        const workspace = await removeWorkspaceMember({
            workspaceSlug,
            requesterEmail: request.auth.user.email,
            memberEmail
        });
        return NextResponse.json(workspace, { status: 200 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not remove member";
        const status = message === "Only workspace owners or organization admins can manage workspace access"
            ? 403
            : message === "Workspace not found"
                ? 404
                : 400;
        return NextResponse.json({ error: message }, { status });
    }
});
