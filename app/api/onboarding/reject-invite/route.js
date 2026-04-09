import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rejectOrganizationInvite, rejectWorkspaceInvite } from "@/lib/data";

export const POST = auth(async (request) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const type = String(body.type ?? "");

  try {
    if (type === "organization") {
      const result = await rejectOrganizationInvite({
        organizationSlug: String(body.organizationSlug ?? "").trim(),
        userEmail: request.auth.user.email
      });

      return NextResponse.json(result, { status: 200 });
    }

    if (type === "workspace" || type === "workspace-smart") {
      const result = await rejectWorkspaceInvite({
        workspaceSlug: String(body.workspaceSlug ?? "").trim(),
        userEmail: request.auth.user.email
      });

      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json({ error: "Unsupported invite type" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not decline invite";
    const status = message === "Organization not found" || message === "Workspace not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
