import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { auth } from "@/auth";
import { getAuthorizedWorkspaceFileById } from "@/lib/data";

function sanitizeFilename(value) {
  return String(value ?? "file")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim() || "file";
}

export const GET = auth(async (request, context) => {
  if (!request.auth?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = await getAuthorizedWorkspaceFileById(context.params.id, request.auth.user.email);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const blobReference = file.blobPathname || file.blobUrl;
  if (!blobReference) {
    return NextResponse.json({ error: "Original blob is not available for this file" }, { status: 404 });
  }

  try {
    const blobResult = await get(blobReference, {
      access: file.blobAccess === "public" ? "public" : "private"
    });

    if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
      return NextResponse.json({ error: "Could not fetch file content" }, { status: 404 });
    }

    const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
    const contentDispositionType = shouldDownload ? "attachment" : "inline";
    const filename = sanitizeFilename(file.fileName);

    return new NextResponse(blobResult.stream, {
      status: 200,
      headers: {
        "Content-Type": blobResult.blob.contentType || "application/octet-stream",
        "Content-Disposition": `${contentDispositionType}; filename="${filename}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not fetch file content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
