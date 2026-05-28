import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createInternalApiKey,
  listInternalApiKeys,
  revokeInternalApiKey,
} from "@/lib/internal-api-keys";

export const GET = auth(async (request) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const organizationSlug = String(searchParams.get("organizationSlug") || "").trim();
    const keys = await listInternalApiKeys({
      organizationSlug,
      userEmail: request.auth.user.email,
    });

    return NextResponse.json({ keys });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list integration keys";
    const status = message.includes("Only the organization owner") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});

export const POST = auth(async (request) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await createInternalApiKey({
      organizationSlug: String(body.organizationSlug || "").trim(),
      label: String(body.label || "").trim(),
      createdByEmail: request.auth.user.email,
      createdByName: request.auth.user.name || "",
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create integration key";
    const status = message.includes("Only the organization owner") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});

export const DELETE = auth(async (request) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const key = await revokeInternalApiKey({
      organizationSlug: String(body.organizationSlug || "").trim(),
      keyId: String(body.keyId || "").trim(),
      revokedByEmail: request.auth.user.email,
    });

    return NextResponse.json({ key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not revoke integration key";
    const status = message.includes("Only the organization owner") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
