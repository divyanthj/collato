export function buildEvidenceFeed(files = [], updates = []) {
  return [
    ...files.map(file => ({
      ...file, kind: "file", title: file.fileName, contributor: file.uploadedBy,
      summary: file.extractionSummary || "Source saved", text: file.knowledgeText, originalText: file.extractedText || file.knowledgeText,
      date: file.evidenceDate || file.createdAt,
      anchor: `evidence-file-${file.id}`, reviewState: file.reviewState || "recorded"
    })),
    ...updates.map(update => ({
      ...update, kind: "update", title: update.body.slice(0, 90), contributor: update.createdByName,
      summary: update.structured.summary, text: update.body,
      date: update.evidenceDate || update.createdAt,
      anchor: `evidence-update-${update.id}`, reviewState: update.reviewState || "recorded"
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date) || a.id.localeCompare(b.id));
}

export function filterEvidenceFeed(items, { query = "", kind = "all", review = "all" } = {}) {
  const search = query.trim().toLowerCase();
  return items.filter(item => (kind === "all" || item.kind === kind) &&
    (review === "all" || (review === "needs_review" ? item.reviewState === "needs_review" : item.reviewState !== "needs_review")) &&
    (!search || [item.title, item.text, item.summary, item.contributor, ...(item.structured?.keyPoints || [])].join(" ").toLowerCase().includes(search)));
}

export function normalizeDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export function normalizeReportPeriod(input) {
  const start = normalizeDateOnly(input.periodStart);
  const end = normalizeDateOnly(input.periodEnd);
  const reportDate = normalizeDateOnly(input.reportDate);
  if (!start || !end || !reportDate || start > end) throw new Error("Choose a valid reporting period and report date.");
  return { start, end, reportDate };
}

export function evidenceInPeriod(item, period) {
  const day = String(item.evidenceDate || item.createdAt || "").slice(0, 10);
  return day >= period.start && day <= period.end;
}

export function advanceReportDate(value, cadence) {
  const valid = normalizeDateOnly(value);
  if (!valid || cadence === "none") return valid;
  const date = new Date(`${valid}T00:00:00Z`);
  if (cadence === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else if (cadence === "monthly") {
    const day = date.getUTCDate();
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

export function getWorkspaceAttention({ files, updates, tasks }, now = new Date()) {
  const evidence = buildEvidenceFeed(files, updates);
  const today = now.toISOString().slice(0, 10);
  const recentCutoff = now.getTime() - 7 * 86400000;
  return {
    needsReview: evidence.filter(item => item.reviewState === "needs_review"),
    recent: evidence.filter(item => new Date(item.createdAt).getTime() >= recentCutoff),
    overdue: tasks.filter(task => task.status !== "done" && task.dueDate && task.dueDate.slice(0, 10) < today),
    nextTasks: tasks.filter(task => task.status !== "done").sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")).slice(0, 5),
    latest: evidence.slice(0, 5)
  };
}
