// Server-side only. The browser receives the category, never the email/list.
export function getAnalyticsCohort(email, internalEmails = process.env.ANALYTICS_INTERNAL_EMAILS || "") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return "anonymous";
  const excludedEmails = String(internalEmails).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  // An unconfigured pilot list cannot support an external-user claim.
  if (excludedEmails.length === 0) return "unknown";
  return excludedEmails.includes(normalizedEmail) ? "internal_pilot" : "external";
}
