import { NextResponse } from "next/server";
import { signIn } from "@/auth";
import { isResendConfigured } from "@/lib/resend";

export async function POST(request) {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const redirectTo = String(body.redirectTo ?? "/dashboard");
    if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!isResendConfigured()) {
        return NextResponse.json({
            error: "Email sign-in is not configured yet. Add AUTH_RESEND_KEY and AUTH_RESEND_FROM to enable magic links."
        }, { status: 503 });
    }
    try {
        await signIn("resend", {
            email,
            redirect: false,
            redirectTo
        });
        return NextResponse.json({ ok: true }, { status: 200 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not send sign-in email";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

