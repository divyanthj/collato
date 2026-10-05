function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isReportRowArray(value) {
  return Array.isArray(value) && value.every((row) => row && typeof row === "object" && typeof row.description === "string" && typeof row.date === "string");
}

// A 200 response is not enough to render or count a generated report. Validate
// the API contract so malformed/partial replies enter the ordinary failure path.
export function validateWorkspaceReportResult(result, templateId) {
  const invalid = () => { throw new Error("The report response was incomplete. Please try again."); };
  if (!result || typeof result !== "object" || Array.isArray(result)) return invalid();
  if (result.status === "needs_clarification") {
    const questions = result.missingQuestions;
    if (!Array.isArray(questions) || questions.length === 0 || !questions.every((item) =>
      item && typeof item.id === "string" && item.id.trim() && typeof item.question === "string" && item.question.trim() && typeof item.reason === "string"
    ) || new Set(questions.map((item) => item.id)).size !== questions.length) return invalid();
    return "needs_clarification";
  }
  if (result.status !== "ready" || result.templateId !== templateId || typeof result.html !== "string" || !result.html.trim() ||
    typeof result.overview !== "string" || !isStringArray(result.sourceHighlights)) return invalid();
  if (templateId === "default-progress") {
    if (!["accomplishments", "currentFocus", "risks", "nextSteps"].every((key) => isStringArray(result[key]))) return invalid();
  } else if (templateId === "collato-monthly-report") {
    if (!["reportDate", "preparedBy", "reportNo", "monthOf", "projectAssociate"].every((key) => typeof result[key] === "string") ||
      !["statusSummary", "queryContacts", "generalInstructions"].every((key) => isStringArray(result[key])) ||
      !["projectOverviewRows", "otherInfoRows"].every((key) => isReportRowArray(result[key]))) return invalid();
  } else return invalid();
  return "ready";
}
