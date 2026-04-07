import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertUserCanCreateOrganization } from "@/lib/billing";
import { createOrganization } from "@/lib/data";

export const POST = auth(async (request) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();

  try {
    await assertUserCanCreateOrganization(request.auth.user.email);

    const organization = await createOrganization({
      name,
      ownerName: request.auth.user.name ?? "Organization owner",
      ownerEmail: request.auth.user.email
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create organization";
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    const status = message === "You already own an organization" ? 409 : 400;
    return NextResponse.json({ error: message, code, upgradePath: "/dashboard#access-gateway-billing" }, { status });
  }
});
