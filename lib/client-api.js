export async function readResponsePayload(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  const condensedText = text
    .replace(/\s+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .trim()
    .slice(0, 240);

  return {
    error: condensedText || "Unexpected server response",
  };
}
