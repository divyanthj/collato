import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, getWorkspaceDetailData, saveWorkspaceFile } from "@/lib/data";
import { buildKnowledgeText, extractKnowledgeFromFile } from "@/lib/file-ingestion";
import { uploadWorkspaceFileToBlob } from "@/lib/file-storage";
import {
  buildKnowledgeSummaryFallback,
  generateWorkspaceKnowledgeSummary,
  persistWorkspaceKnowledgeSummary
} from "@/lib/workspace-summary";
import { getSharePointConnectionWithAccessToken } from "@/lib/sharepoint-connection";
import {
  downloadSharePointDriveItem,
  getSharePointDriveItem
} from "@/lib/sharepoint";

function formatBytes(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "Unknown size";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildExternalPath(metadata) {
  const parentPath = String(metadata.parentReference?.path || "").split("root:").pop() || "";
  return `${parentPath}/${metadata.name || "Untitled"}`.replace(/\/+/g, "/");
}

async function refreshWorkspaceSummary(workspaceSlug, userEmail) {
  try {
    const data = await getWorkspaceDetailData(workspaceSlug, userEmail);
    if (!data) {
      return null;
    }
    const knowledgeSummary = await generateWorkspaceKnowledgeSummary(data);
    await persistWorkspaceKnowledgeSummary(workspaceSlug, knowledgeSummary);
    return knowledgeSummary;
  } catch (error) {
    console.error("Workspace knowledge summary generation failed after SharePoint import:", error);
    const data = await getWorkspaceDetailData(workspaceSlug, userEmail);
    return data ? buildKnowledgeSummaryFallback(data) : null;
  }
}

export const POST = auth(async (request) => {
  try {
    if (!request.auth?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const workspaceSlug = String(body.workspaceSlug || "").trim();
    const driveId = String(body.driveId || "").trim();
    const siteId = String(body.siteId || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!workspaceSlug || !driveId || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const workspace = await getAuthorizedWorkspace(workspaceSlug, request.auth.user.email);
    if (!workspace) {
      return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
    }

    const { connection, accessToken } = await getSharePointConnectionWithAccessToken({
      workspaceSlug: workspace.slug,
      userEmail: request.auth.user.email
    });

    const imported = [];
    const failed = [];

    for (const item of items) {
      const itemId = String(item.id || "").trim();
      if (!itemId) {
        continue;
      }

      try {
        const metadata = await getSharePointDriveItem(accessToken, driveId, itemId);
        if (!metadata.file) {
          throw new Error("Only files can be imported.");
        }

        const download = await downloadSharePointDriveItem(accessToken, driveId, itemId);
        const arrayBuffer = await download.arrayBuffer();
        const fileType = metadata.file?.mimeType || download.headers.get("content-type") || "application/octet-stream";
        const importedFile = new File([arrayBuffer], metadata.name || "SharePoint file", {
          type: fileType
        });

        const blob = await uploadWorkspaceFileToBlob({
          workspaceSlug: workspace.slug,
          file: importedFile
        });
        const extraction = await extractKnowledgeFromFile(importedFile);
        const knowledgeText = buildKnowledgeText({
          extractedText: extraction.extractedText,
          manualNotes: ""
        });

        const file = await saveWorkspaceFile({
          workspaceSlug: workspace.slug,
          workspaceName: workspace.name,
          fileName: metadata.name || "SharePoint file",
          fileType,
          sizeLabel: formatBytes(metadata.size),
          knowledgeText,
          extractedText: extraction.extractedText,
          manualNotes: "",
          extractionStatus: extraction.extractionStatus,
          extractionSummary: extraction.extractionSummary,
          blobUrl: blob.blobUrl,
          blobDownloadUrl: blob.blobDownloadUrl,
          blobPathname: blob.blobPathname,
          blobAccess: blob.blobAccess,
          storageProvider: blob.storageProvider,
          externalProvider: "sharepoint",
          externalAccountEmail: connection.microsoftAccountEmail,
          externalSiteId: siteId,
          externalSiteName: String(body.siteName || ""),
          externalDriveId: driveId,
          externalDriveName: String(body.driveName || ""),
          externalItemId: metadata.id,
          externalPath: buildExternalPath(metadata),
          externalWebUrl: metadata.webUrl || "",
          externalETag: metadata.eTag || "",
          externalSyncedAt: new Date(),
          uploadedBy: request.auth.user.email
        });

        imported.push(file);
      } catch (error) {
        failed.push({
          id: itemId,
          name: String(item.name || "SharePoint file"),
          error: error instanceof Error ? error.message : "Could not import file"
        });
      }
    }

    const knowledgeSummary = imported.length > 0
      ? await refreshWorkspaceSummary(workspace.slug, request.auth.user.email)
      : null;

    return NextResponse.json({
      imported,
      failed,
      knowledgeSummary
    }, { status: imported.length > 0 ? 201 : 400 });
  } catch (error) {
    console.error("SharePoint import failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not import SharePoint files"
    }, { status: 500 });
  }
});
