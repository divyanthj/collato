export function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function isPlaceholderKnowledgeText(value) {
  const normalized = compactText(value).toLowerCase();

  return (
    !normalized ||
    normalized === "a summary of everything done so far" ||
    normalized === "summary of everything done so far" ||
    normalized === "summary of everything done so far." ||
    normalized === "a summary of everything done so far."
  );
}
