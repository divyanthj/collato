import { NextResponse } from "next/server";
import { buildKnowledgeText, extractKnowledgeFromFile } from "@/lib/file-ingestion";
import { uploadWorkspaceFileToBlob } from "@/lib/file-storage";
import {
  assertInternalKnowledgeTenant,
  authenticateInternalKnowledgeRequest,
  upsertInternalKnowledgeSource,
} from "@/lib/internal-knowledge";

export async function POST(request) {
  const { credential, error: authError } = await authenticateInternalKnowledgeRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") || "").trim();
    const tenantError = assertInternalKnowledgeTenant(credential, tenantSlug);
    if (tenantError) {
      return tenantError;
    }
    const sourceApp = String(formData.get("sourceApp") || "external").trim();
    const sourceType = String(formData.get("sourceType") || "file").trim();
    const sourceId =
      String(formData.get("sourceId") || "").trim() ||
      `${sourceApp}:file:${Date.now()}`;
    const title = String(formData.get("title") || "").trim();
    const manualNotes = String(formData.get("manualNotes") || "");
    const file = formData.get("file");

    if (!tenantSlug || !(file instanceof File)) {
      return NextResponse.json(
        { error: "tenantSlug and file are required." },
        { status: 400 }
      );
    }

    const [blob, extraction] = await Promise.all([
      uploadWorkspaceFileToBlob({ workspaceSlug: tenantSlug, file }),
      extractKnowledgeFromFile(file),
    ]);
    const knowledgeText = buildKnowledgeText({
      extractedText: extraction.extractedText,
      manualNotes,
    });
    const source = await upsertInternalKnowledgeSource({
      tenantSlug,
      sourceApp,
      sourceType,
      sourceId,
      title: title || String(file.name || "Uploaded file"),
      text: knowledgeText || extraction.extractionSummary,
      metadata: {
        fileName: String(file.name || "Uploaded file"),
        fileType: file.type || "Unknown",
        fileSize: typeof file.size === "number" ? file.size : null,
        extractionStatus: extraction.extractionStatus,
        extractionSummary: extraction.extractionSummary,
        blobUrl: blob.blobUrl,
        blobDownloadUrl: blob.blobDownloadUrl,
        blobPathname: blob.blobPathname,
        blobAccess: blob.blobAccess,
        storageProvider: blob.storageProvider,
      },
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    console.error("Internal knowledge file upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload file." },
      { status: 400 }
    );
  }
}
