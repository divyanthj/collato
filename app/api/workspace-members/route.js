import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addWorkspaceMember, removeWorkspaceMember, updateWorkspaceMemberNotificationPreference } from "@/lib/data";
import { isResendConfigured, sendWorkspaceInviteEmail } from "@/lib/resend";
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
            requesterName: request.auth.user.name ?? "",
            memberEmail
        });
        let inviteEmailWarning = null;
        if (isResendConfigured()) {
            try {
                await sendWorkspaceInviteEmail({
                    toEmail: memberEmail.toLowerCase(),
                    workspaceName: workspace.name,
                    organizationName: workspace.organizationName,
                    workspaceSlug: workspace.slug,
                    role: "member",
                    inviterName: request.auth.user.name ?? "",
                    inviterEmail: request.auth.user.email
                });
            }
            catch (emailError) {
                inviteEmailWarning = emailError instanceof Error ? emailError.message : "Could not send invite email";
            }
        }
        return NextResponse.json(inviteEmailWarning ? { ...workspace, inviteEmailWarning } : workspace, { status: 200 });
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
            requesterName: request.auth.user.name ?? "",
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
                : message === "Workspace member not found"
                    ? 404
                : 400;
        return NextResponse.json({ error: message }, { status });
    }
});

export const PATCH = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const workspaceSlug = String(body.workspaceSlug ?? "").trim();
    const notificationPreference = String(body.notificationPreference ?? "").trim();
    if (!workspaceSlug || !notificationPreference) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    try {
        const result = await updateWorkspaceMemberNotificationPreference({
            workspaceSlug,
            userEmail: request.auth.user.email,
            notificationPreference
        });
        return NextResponse.json(result, { status: 200 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not update notification preference";
        const status = message === "Workspace not found"
            ? 404
            : message === "You do not have access to this workspace"
                ? 403
                : 400;
        return NextResponse.json({ error: message }, { status });
    }
});
