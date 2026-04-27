import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createWorkspace, deleteWorkspace } from "@/lib/data";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const organizationSlug = String(body.organizationSlug ?? "").trim();
    if (!name || !organizationSlug) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    try {
        const workspace = await createWorkspace({
            name,
            description: description || "Workspace created to collect project context, updates, and next steps.",
            organizationSlug,
            ownerName: request.auth.user.name ?? "Workspace owner",
            ownerEmail: request.auth.user.email,
            memberEmails: Array.isArray(body.memberEmails) ? body.memberEmails.map((item) => String(item)) : []
        });
        return NextResponse.json(workspace, { status: 201 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not create workspace";
        const status = message === "You do not have permission to create workspaces" || message === "You do not have access to this organization"
            ? 403
            : message === "Organization not found"
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
    if (!workspaceSlug) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    try {
        const result = await deleteWorkspace({
            workspaceSlug,
            requesterEmail: request.auth.user.email
        });
        return NextResponse.json(result, { status: 200 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not delete workspace";
        const status = message === "Only workspace owners or organization admins can delete workspaces"
            ? 403
            : message === "Workspace not found"
                ? 404
                : 400;
        return NextResponse.json({ error: message }, { status });
    }
});
