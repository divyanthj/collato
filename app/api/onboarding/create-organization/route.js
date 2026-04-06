import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createOrganization } from "@/lib/data";

export const POST = auth(async (request) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();

  try {
    const organization = await createOrganization({
      name,
      ownerName: request.auth.user.name ?? "Organization owner",
      ownerEmail: request.auth.user.email
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create organization";
    const status = message === "You already own an organization" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
