import { put } from "@vercel/blob";

function sanitizePathSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildBlobPath({ workspaceSlug, fileName }) {
  const safeWorkspaceSlug = sanitizePathSegment(workspaceSlug) || "workspace";
  const safeFileName = String(fileName ?? "upload")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 180);

  return `workspace-files/${safeWorkspaceSlug}/${Date.now()}-${safeFileName || "upload"}`;
}

export async function uploadWorkspaceFileToBlob({ workspaceSlug, file }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  const access =
    String(process.env.BLOB_ACCESS ?? "private").toLowerCase() === "public"
      ? "public"
      : "private";

  const blob = await put(buildBlobPath({ workspaceSlug, fileName: file?.name }), file, {
    access,
    addRandomSuffix: true,
    contentType: file?.type || undefined,
  });

  return {
    blobUrl: blob.url,
    blobDownloadUrl: blob.downloadUrl,
    blobPathname: blob.pathname,
    blobAccess: access,
    storageProvider: "vercel_blob",
  };
}
