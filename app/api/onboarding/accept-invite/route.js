import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { acceptOrganizationInvite, acceptWorkspaceInvite } from "@/lib/data";

export const POST = auth(async (request) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const type = String(body.type ?? "");

  try {
    if (type === "organization") {
      await acceptOrganizationInvite({
        organizationSlug: String(body.organizationSlug ?? "").trim(),
        userEmail: request.auth.user.email
      });

      return NextResponse.json({ message: "Organization invite accepted." }, { status: 200 });
    }

    if (type === "workspace") {
      await acceptWorkspaceInvite({
        workspaceSlug: String(body.workspaceSlug ?? "").trim(),
        userEmail: request.auth.user.email
      });

      return NextResponse.json({ message: "Workspace invite accepted." }, { status: 200 });
    }

    return NextResponse.json({ error: "Unsupported invite type" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not accept invite";
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    const status = message === "Organization not found" || message === "Workspace not found" ? 404 : 400;
    return NextResponse.json({ error: message, code, upgradePath: "/dashboard/organization#billing" }, { status });
  }
});
