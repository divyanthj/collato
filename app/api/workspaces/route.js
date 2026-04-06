import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createWorkspace } from "@/lib/data";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    if (!name || !description) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    try {
        const workspace = await createWorkspace({
            name,
            description,
            ownerName: request.auth.user.name ?? "Workspace owner",
            ownerEmail: request.auth.user.email,
            memberEmails: Array.isArray(body.memberEmails) ? body.memberEmails.map((item) => String(item)) : []
        });
        return NextResponse.json(workspace, { status: 201 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not create workspace";
        const status = message === "You do not have permission to create workspaces" ? 403 : 400;
        return NextResponse.json({ error: message }, { status });
    }
});
