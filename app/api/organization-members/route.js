import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addOrganizationMember } from "@/lib/data";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const memberEmail = String(body.memberEmail ?? "").trim();
    if (!memberEmail) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    try {
        const organization = await addOrganizationMember({
            requesterEmail: request.auth.user.email,
            memberEmail,
            role: String(body.role ?? "member")
        });
        return NextResponse.json(organization, { status: 200 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not add organization member";
        const status = message === "Only organization owners or admins can add members"
            ? 403
            : message === "Organization not found"
                ? 404
                : 400;
        return NextResponse.json({ error: message }, { status });
    }
});
