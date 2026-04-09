import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addOrganizationMember, removeOrganizationMember } from "@/lib/data";
import { isResendConfigured, sendOrganizationInviteEmail } from "@/lib/resend";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const organizationSlug = String(body.organizationSlug ?? "").trim();
    const memberEmail = String(body.memberEmail ?? "").trim();
    if (!organizationSlug || !memberEmail) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    try {
        const organization = await addOrganizationMember({
            organizationSlug,
            requesterEmail: request.auth.user.email,
            requesterName: request.auth.user.name ?? "",
            memberEmail,
            role: String(body.role ?? "member")
        });
        let inviteEmailWarning = null;
        if (isResendConfigured()) {
            try {
                await sendOrganizationInviteEmail({
                    toEmail: memberEmail.toLowerCase(),
                    organizationName: organization.name,
                    organizationSlug: organization.slug,
                    inviterName: request.auth.user.name ?? "",
                    inviterEmail: request.auth.user.email,
                    role: String(body.role ?? "member")
                });
            }
            catch (emailError) {
                inviteEmailWarning = emailError instanceof Error ? emailError.message : "Could not send invite email";
            }
        }
        return NextResponse.json(inviteEmailWarning ? { ...organization, inviteEmailWarning } : organization, { status: 200 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not add organization member";
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
        const status = message === "Only organization owners can add members"
            ? 403
            : message === "Organization not found"
                ? 404
                : 400;
        return NextResponse.json({
            error: message,
            code,
            upgradePath: "/dashboard/organization#billing"
        }, { status });
    }
});

export const DELETE = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const organizationSlug = String(body.organizationSlug ?? "").trim();
    const memberEmail = String(body.memberEmail ?? "").trim();
    if (!organizationSlug || !memberEmail) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    try {
        const organization = await removeOrganizationMember({
            organizationSlug,
            requesterEmail: request.auth.user.email,
            requesterName: request.auth.user.name ?? "",
            memberEmail
        });
        return NextResponse.json(organization, { status: 200 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not remove organization member";
        const status = message === "Only organization owners can remove members"
            ? 403
            : message === "Organization not found"
                ? 404
                : message === "Organization member not found"
                    ? 404
                : 400;
        return NextResponse.json({ error: message }, { status });
    }
});
