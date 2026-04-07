import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, getWorkspaceDetailData, saveWorkspaceFile } from "@/lib/data";
import { buildKnowledgeText, extractKnowledgeFromFile } from "@/lib/file-ingestion";
import { uploadWorkspaceFileToBlob } from "@/lib/file-storage";
import { buildKnowledgeSummaryFallback, generateWorkspaceKnowledgeSummary, persistWorkspaceKnowledgeSummary } from "@/lib/workspace-summary";
export const POST = auth(async (request) => {
    try {
        if (!request.auth?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const formData = await request.formData();
        const workspaceSlug = String(formData.get("workspaceSlug") ?? "").trim();
        const uploadedFile = formData.get("file");
        const manualNotes = String(formData.get("manualNotes") ?? "");
        if (!workspaceSlug || !(uploadedFile instanceof File)) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        const workspace = await getAuthorizedWorkspace(workspaceSlug, request.auth.user.email);
        if (!workspace) {
            return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
        }
        const blob = await uploadWorkspaceFileToBlob({
            workspaceSlug: workspace.slug,
            file: uploadedFile
        });
        const extraction = await extractKnowledgeFromFile(uploadedFile);
        const knowledgeText = buildKnowledgeText({
            extractedText: extraction.extractedText,
            manualNotes
        });
        const file = await saveWorkspaceFile({
            workspaceSlug: workspace.slug,
            workspaceName: workspace.name,
            fileName: String(uploadedFile.name ?? "Untitled file"),
            fileType: uploadedFile.type ? String(uploadedFile.type) : "Unknown",
            sizeLabel: typeof uploadedFile.size === "number" ? `${uploadedFile.size} B` : "Unknown size",
            knowledgeText,
            extractedText: extraction.extractedText,
            manualNotes,
            extractionStatus: extraction.extractionStatus,
            extractionSummary: extraction.extractionSummary,
            blobUrl: blob.blobUrl,
            blobDownloadUrl: blob.blobDownloadUrl,
            blobPathname: blob.blobPathname,
            blobAccess: blob.blobAccess,
            storageProvider: blob.storageProvider,
            uploadedBy: request.auth.user.email
        });
        let knowledgeSummary = null;
        try {
            const data = await getWorkspaceDetailData(workspace.slug, request.auth.user.email);
            if (data) {
                knowledgeSummary = await generateWorkspaceKnowledgeSummary(data);
                await persistWorkspaceKnowledgeSummary(workspace.slug, knowledgeSummary);
            }
        }
        catch (summaryError) {
            console.error("Workspace knowledge summary generation failed after upload:", summaryError);
            const data = await getWorkspaceDetailData(workspace.slug, request.auth.user.email);
            if (data) {
                knowledgeSummary = buildKnowledgeSummaryFallback(data);
            }
        }
        return NextResponse.json({
            file,
            knowledgeSummary
        }, { status: 201 });
    }
    catch (error) {
        console.error("Workspace file upload failed:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Could not upload file"
        }, { status: 500 });
    }
});
