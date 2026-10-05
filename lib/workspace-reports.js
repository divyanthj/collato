import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { buildWorkspaceProgressReportHtml } from "@/lib/report-html";
import { validateWorkspaceReportResult } from "@/lib/client-report-validation";
import { sanitizeReportCitations } from "@/lib/report-citations";

export function reportSections(report) {
  const keys = report.templateId === "collato-monthly-report" ? ["overview", "reportDate", "preparedBy", "reportNo", "monthOf", "projectAssociate", "statusSummary", "queryContacts", "generalInstructions", "projectOverviewRows", "otherInfoRows", "sourceHighlights"] : ["overview", "accomplishments", "currentFocus", "risks", "nextSteps", "sourceHighlights"];
  return keys.map(key => ({ key, title: key.replace(/([A-Z])/g, " $1").replace(/^./, char => char.toUpperCase()), text: Array.isArray(report[key]) ? report[key].map(item => typeof item === "string" ? item : `${item.date}: ${item.description}`).join("\n") : String(report[key] || "") }));
}

export async function saveReportVersion({ workspace, report, email, parent = null }) {
  validateWorkspaceReportResult({ ...report, status: "ready", html: "server-generated" }, report.templateId);
  const rawContent = Object.fromEntries(reportSections(report).map(({ key }) => [key, report[key]]));
  const sources = parent?.sources || report.sources || [];
  const { content, unmatched } = sanitizeReportCitations(rawContent, sources);
  const generatedAt = new Date();
  const workspaceSnapshot = parent?.workspaceSnapshot || workspace;
  const document = { workspaceSlug: workspace.slug, organizationSlug: workspace.organizationSlug, templateId: report.templateId, ...content, period: parent?.period || report.period, sources: parent?.sources || report.sources || [], coverage: parent?.coverage || report.coverage, workspaceSnapshot, state: "draft", createdBy: email, createdAt: generatedAt, parentId: parent ? String(parent._id) : null, seriesId: parent?.seriesId || new ObjectId().toString() };
  document.html = buildWorkspaceProgressReportHtml({ workspace: workspaceSnapshot, report: document, generatedAt });
  if (unmatched) {
    document.coverage += " Unmatched citations were marked as unavailable. Verify and correct these statements before approval.";
    document.html = buildWorkspaceProgressReportHtml({ workspace: workspaceSnapshot, report: document, generatedAt });
  }
  const db = await getDatabase();
  const result = await db.collection("workspace_reports").insertOne(document);
  return { ...document, _id: undefined, id: String(result.insertedId), status: "ready", createdAt: generatedAt.toISOString() };
}

export async function canReadSavedReport(report, data) {
  if (report.workspaceSlug !== data.workspace.slug) return false;
  if (data.permissions.organizationRole === "owner") return true;
  const db = await getDatabase();
  for (const source of report.sources || []) {
    if (!["file", "update", "task"].includes(source.sourceType) || !ObjectId.isValid(source.sourceId)) return false;
    const collection = source.sourceType === "file" ? "workspace_files" : source.sourceType === "task" ? "workspace_tasks" : "workspace_updates";
    const item = await db.collection(collection).findOne({ _id: new ObjectId(source.sourceId), workspaceSlug: data.workspace.slug, aiPrivate: { $ne: true } }, { projection: { _id: 1 } });
    if (!item) return false;
  }
  return true;
}

export async function listWorkspaceReports(slug, data) {
  const db = await getDatabase();
  const reports = await db.collection("workspace_reports").find({ workspaceSlug: slug }).sort({ createdAt: -1 }).limit(50).toArray();
  const readable = await Promise.all(reports.map(async report => await canReadSavedReport(report, data) ? report : null));
  return readable.filter(Boolean).map(report => ({ ...report, _id: undefined, id: String(report._id), status: "ready", createdAt: report.createdAt.toISOString(), approvedAt: report.approvedAt?.toISOString() || null }));
}
