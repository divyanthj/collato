import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, getWorkspaceDetailData, saveWorkspaceFile } from "@/lib/data";
import {
  buildKnowledgeSummaryFallback,
  generateWorkspaceKnowledgeSummary,
  persistWorkspaceKnowledgeSummary
} from "@/lib/workspace-summary";

function buildNoteFileName(inputMethod) {
  const prefix = inputMethod === "voice" ? "Voice transcript" : "Knowledge note";
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  return `${prefix} (${stamp})`;
}

export const POST = auth(async (request) => {
  try {
    if (!request.auth?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const workspaceSlug = String(body.workspaceSlug ?? "").trim();
    const noteText = String(body.body ?? "").trim();
    const inputMethod = body.inputMethod === "voice" ? "voice" : "typed";

    if (!workspaceSlug || !noteText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const workspace = await getAuthorizedWorkspace(workspaceSlug, request.auth.user.email);
    if (!workspace) {
      return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
    }

    const file = await saveWorkspaceFile({
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
      fileName: buildNoteFileName(inputMethod),
      fileType: "text/plain",
      sizeLabel: `${noteText.length} chars`,
      knowledgeText: noteText,
      extractedText: noteText,
      manualNotes: "",
      extractionStatus: "extracted",
      extractionSummary: inputMethod === "voice" ? "Knowledge captured from voice transcript." : "Knowledge captured from typed entry.",
      uploadedBy: request.auth.user.email
    });

    let knowledgeSummary = null;
    try {
      const data = await getWorkspaceDetailData(workspace.slug, request.auth.user.email);
      if (data) {
        knowledgeSummary = await generateWorkspaceKnowledgeSummary(data);
        await persistWorkspaceKnowledgeSummary(workspace.slug, knowledgeSummary);
      }
    } catch (summaryError) {
      console.error("Workspace knowledge summary generation failed after note save:", summaryError);
      const data = await getWorkspaceDetailData(workspace.slug, request.auth.user.email);
      if (data) {
        knowledgeSummary = buildKnowledgeSummaryFallback(data);
      }
    }

    return NextResponse.json({ file, knowledgeSummary }, { status: 201 });
  } catch (error) {
    console.error("Workspace knowledge note save failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not save knowledge note"
      },
      { status: 500 }
    );
  }
});
