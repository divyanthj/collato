import { NextResponse } from "next/server";
import {
  assertInternalKnowledgeTenant,
  authenticateInternalKnowledgeRequest,
  listInternalKnowledgeSources,
  upsertInternalKnowledgeSource,
} from "@/lib/internal-knowledge";

export async function GET(request) {
  const { credential, error: authError } = await authenticateInternalKnowledgeRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug");
    const tenantError = assertInternalKnowledgeTenant(credential, tenantSlug);
    if (tenantError) {
      return tenantError;
    }
    const sources = await listInternalKnowledgeSources({
      tenantSlug,
      sourceApp: searchParams.get("sourceApp"),
      limit: searchParams.get("limit"),
    });

    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not list sources." },
      { status: 400 }
    );
  }
}

export async function POST(request) {
  const { credential, error: authError } = await authenticateInternalKnowledgeRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const tenantError = assertInternalKnowledgeTenant(credential, body.tenantSlug);
    if (tenantError) {
      return tenantError;
    }
    const source = await upsertInternalKnowledgeSource(body);
    return NextResponse.json({ source });
  } catch (error) {
    console.error("Internal knowledge source upsert failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not index source." },
      { status: 400 }
    );
  }
}
