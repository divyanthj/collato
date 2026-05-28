import { NextResponse } from "next/server";
import {
  assertInternalKnowledgeTenant,
  authenticateInternalKnowledgeRequest,
  deleteInternalKnowledgeSource,
} from "@/lib/internal-knowledge";

export async function DELETE(request, { params }) {
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
    const deleted = await deleteInternalKnowledgeSource({
      tenantSlug,
      sourceApp: searchParams.get("sourceApp"),
      sourceType: searchParams.get("sourceType"),
      sourceId: decodeURIComponent(params.id),
    });

    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("Internal knowledge source delete failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete source." },
      { status: 400 }
    );
  }
}
