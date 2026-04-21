function extensionFromMimeType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();

  if (normalized === "image/jpeg") {
    return "jpg";
  }
  if (normalized === "image/webp") {
    return "webp";
  }
  if (normalized === "image/gif") {
    return "gif";
  }

  return "png";
}

export function getClipboardImageFile(event, { prefix = "pasted-image" } = {}) {
  const items = Array.from(event?.clipboardData?.items ?? []);
  const imageItem = items.find((item) => item?.kind === "file" && String(item.type || "").startsWith("image/"));
  const imageFile = imageItem?.getAsFile();

  if (!imageFile) {
    return null;
  }

  if (imageFile.name) {
    return imageFile;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = extensionFromMimeType(imageFile.type);

  return new File([imageFile], `${prefix}-${stamp}.${extension}`, {
    type: imageFile.type || "image/png",
  });
}
