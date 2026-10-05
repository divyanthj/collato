import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { ObjectId } from "mongodb";
import PDFDocument from "pdfkit";
import * as docx from "docx";

const source = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const load = async path => import(`data:text/javascript;base64,${Buffer.from(await source(path)).toString("base64")}`);
const evidence = await load("lib/evidence-utils.js");
const validation = await load("lib/client-report-validation.js");
const html = await load("lib/report-html.js");
async function module(path, mocks) {
  const context = vm.createContext({ console, Date, Buffer, Response, URL });
  const mod = new vm.SourceTextModule(await source(path), { context });
  await mod.link(specifier => {
    assert.ok(mocks[specifier], `Missing mock: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(mocks[specifier]), function () { for (const [key, value] of Object.entries(mocks[specifier])) this.setExport(key, value); }, { context });
  });
  await mod.evaluate(); return mod.namespace;
}
const json = { json: (body, options = {}) => ({ body, status: options.status || 200 }) };
const request = (body = {}, authenticated = true) => ({ auth: authenticated ? { user: { email: "member@example.test" } } : null, json: async () => body, url: "https://collato.test/api?workspaceSlug=sample" });
const workspaceData = { workspace: { slug: "sample", name: "Sample", organizationSlug: "org" }, updates: [], permissions: { canManageWorkspaceMembers: false } };
const draft = { templateId: "default-progress", overview: "Inspection completed [S1].", accomplishments: ["Inspection completed [S1]."], currentFocus: [], risks: ["Approval unknown."], nextSteps: [], sourceHighlights: ["[S1] Inspection"], period: { start: "2026-10-01", end: "2026-10-05", reportDate: "2026-10-05" }, sources: [{ ref: "S1", label: "Inspection", href: "/dashboard/sample/evidence#evidence-update-123" }], coverage: "One source supplied." };

test("evidence searches files and notes together and orders chronologically", () => {
  const items = evidence.buildEvidenceFeed([{ id: "f", fileName: "Drawing", knowledgeText: "foundation", createdAt: "2026-10-01", uploadedBy: "Team" }], [{ id: "u", body: "Inspection complete", structured: { summary: "Reviewed foundation", keyPoints: [] }, createdAt: "2026-10-03", createdByName: "Team", reviewState: "needs_review" }]);
  assert.deepEqual(items.map(item => item.id), ["u", "f"]);
  assert.equal(evidence.filterEvidenceFeed(items, { query: "foundation" }).length, 2);
  assert.equal(evidence.filterEvidenceFeed(items, { review: "needs_review" })[0].id, "u");
});
test("report dates reject invalid calendar days and reversed periods; period boundaries are inclusive", () => {
  assert.equal(evidence.normalizeDateOnly("2026-02-30"), null);
  assert.throws(() => evidence.normalizeReportPeriod({ periodStart: "2026-10-06", periodEnd: "2026-10-05", reportDate: "2026-10-05" }));
  assert.equal(evidence.evidenceInPeriod({ createdAt: "2026-10-05T23:59:59Z" }, draft.period), true);
  assert.equal(evidence.evidenceInPeriod({ createdAt: "2026-09-30T23:59:59Z" }, draft.period), false);
});
test("Overview excludes completed overdue tasks", () => {
  const result = evidence.getWorkspaceAttention({ files: [], updates: [], tasks: [{ id: "1", status: "done", dueDate: "2026-10-01" }, { id: "2", status: "open", dueDate: "2026-10-01" }] }, new Date("2026-10-05"));
  assert.equal(result.overdue.length, 1);
});
test("AI outage preserves saved original evidence and cannot mutate its body", async () => {
  let saved;
  const api = await module("app/api/workspace-evidence/route.js", {
    "next/server": { NextResponse: json }, "mongodb": { ObjectId }, "@/auth": { auth: handler => handler },
    "@/lib/data": { getWorkspaceDetailData: async () => workspaceData, saveWorkspaceUpdate: async input => { saved = input; return { ...input, id: new ObjectId().toString() }; } },
    "@/lib/mongodb": { getDatabase: async () => { throw new Error("Unexpected mutation"); } },
    "@/lib/openai": { openai: { responses: { create: async () => { throw new Error("Model unavailable"); } } } },
    "@/lib/ai-models": { textModelOptions: () => ({ model: "gpt-6.1-sol" }) }, "@/lib/rag": { indexWorkspaceUpdate: async () => {}, indexWorkspaceFile: async () => {} },
    "@/lib/user-display-name": { getDisplayNameFromEmail: () => "Member" }
  });
  const result = await api.POST(request({ workspaceSlug: "sample", body: "Original finding" }));
  assert.equal(result.status, 201); assert.equal(saved.body, "Original finding"); assert.equal(saved.reviewState, "needs_review");
  assert.equal((await api.POST(request({}, false))).status, 401);
  assert.equal((await api.PATCH(request({ workspaceSlug: "sample", id: new ObjectId().toString(), summary: "Unauthorized edit" }))).status, 403);
});
test("report edits create a new draft and preserve server period, sources, and approved parent", async () => {
  let inserted;
  const library = await module("lib/workspace-reports.js", {
    mongodb: { ObjectId }, "@/lib/mongodb": { getDatabase: async () => ({ collection: () => ({ insertOne: async item => { inserted = item; return { insertedId: new ObjectId() }; } }) }) },
    "@/lib/report-html": html, "@/lib/client-report-validation": validation
  });
  const parent = { ...draft, _id: new ObjectId(), state: "approved", seriesId: "series" };
  const result = await library.saveReportVersion({ workspace: workspaceData.workspace, report: { ...draft, overview: "<script>unsafe()</script>", sources: [{ href: "https://evil.test" }], period: {} }, parent, email: "member@example.test" });
  assert.equal(result.state, "draft"); assert.equal(parent.state, "approved"); assert.equal(inserted.period, parent.period); assert.equal(inserted.sources, parent.sources);
  assert.match(inserted.html, /&lt;script&gt;/); assert.doesNotMatch(inserted.html, /<script>/);
});
test("members cannot approve reports; unauthenticated history is rejected", async () => {
  const api = await module("app/api/workspace-reports/route.js", {
    "next/server": { NextResponse: json }, mongodb: { ObjectId }, "@/auth": { auth: handler => handler },
    "@/lib/data": { getWorkspaceDetailData: async () => workspaceData },
    "@/lib/mongodb": { getDatabase: async () => ({ collection: () => ({ findOne: async query => query.workspaceSlug === "sample" ? { ...draft, _id: query._id } : null }) }) },
    "@/lib/evidence-utils": evidence, "@/lib/report-html": html,
    "@/lib/workspace-reports": { canReadSavedReport: async () => true, listWorkspaceReports: async () => [], saveReportVersion: async () => { throw new Error("Must not save"); } }
  });
  assert.equal((await api.POST(request({ workspaceSlug: "sample", id: new ObjectId().toString(), action: "approve" }))).status, 403);
  assert.equal((await api.GET(request({}, false))).status, 401);
});
test("saved report access is revoked when a source becomes private or belongs to another workspace", async () => {
  let sourceVisible = false;
  const library = await module("lib/workspace-reports.js", {
    mongodb: { ObjectId }, "@/lib/mongodb": { getDatabase: async () => ({ collection: () => ({ findOne: async query => { assert.equal(query.workspaceSlug, "sample"); assert.deepEqual(query.aiPrivate.$ne, true); return sourceVisible ? { _id: query._id } : null; } }) }) },
    "@/lib/report-html": html, "@/lib/client-report-validation": validation
  });
  const report = { ...draft, workspaceSlug: "sample", sources: [{ sourceType: "file", sourceId: new ObjectId().toString() }] };
  assert.equal(await library.canReadSavedReport(report, workspaceData), false);
  sourceVisible = true;
  assert.equal(await library.canReadSavedReport(report, workspaceData), true);
  assert.equal(await library.canReadSavedReport({ ...report, workspaceSlug: "foreign" }, workspaceData), false);
});

test("report context excludes outside-period and AI-private evidence and marks unreviewed interpretations", async () => {
  const dataSource = await source("lib/data.js");
  const visibleStart = dataSource.indexOf("function getAiVisibleWorkspaceInputs");
  const visibleEnd = dataSource.indexOf("function mapWorkspaceTask", visibleStart);
  const contextStart = dataSource.indexOf("export async function getWorkspaceProgressReportContext");
  const contextEnd = dataSource.indexOf("export async function getWorkspaceBySlug", contextStart);
  const data = { ...workspaceData, files: [{ id: "old", fileName: "Old file", createdAt: "2026-09-30", knowledgeText: "OUTSIDE PERIOD" }, { id: "private", fileName: "Private", aiPrivate: true, createdAt: "2026-10-04", knowledgeText: "PRIVATE CONTENT" }], updates: [{ id: "note", createdByName: "Member", createdAt: "2026-10-03", body: "Original evidence", reviewState: "needs_review", structured: { summary: "UNREVIEWED CLAIM", actionItems: [], keyPoints: [] } }], tasks: [] };
  const context = vm.createContext({ getWorkspaceDetailData: async () => data });
  const mod = new vm.SourceTextModule(dataSource.slice(visibleStart, visibleEnd) + dataSource.slice(contextStart, contextEnd), { context });
  await mod.link(() => { throw new Error("Unexpected import"); }); await mod.evaluate();
  const result = await mod.namespace.getWorkspaceProgressReportContext("sample", "member@example.test", draft.period);
  assert.match(result.retrievedContext, /Original evidence/);
  assert.doesNotMatch(result.retrievedContext, /PRIVATE CONTENT|OUTSIDE PERIOD|UNREVIEWED CLAIM/);
  assert.equal(result.counts.fileCount, 0); assert.equal(result.counts.updateCount, 1);
});
test("exports produce actual PDF and DOCX bytes from saved server content", async () => {
  const api = await module("app/api/workspace-reports/[id]/export/route.js", {
    mongodb: { ObjectId }, "next/server": { NextResponse: json }, "@/auth": { auth: handler => handler },
    "@/lib/data": { getWorkspaceDetailData: async () => workspaceData }, "@/lib/mongodb": { getDatabase: async () => ({ collection: () => ({ findOne: async () => ({ ...draft, workspaceSlug: "sample", state: "draft" }) }) }) },
    "@/lib/workspace-reports": { canReadSavedReport: async () => true, reportSections: report => [{ title: "Overview", text: report.overview }] }, pdfkit: { default: PDFDocument }, docx
  });
  for (const format of ["pdf", "docx"]) {
    const req = request(); req.url = `https://collato.test/api?format=${format}`;
    const response = await api.GET(req, { params: { id: new ObjectId().toString() } });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, format === "pdf" ? 4 : 2).toString(), format === "pdf" ? "%PDF" : "PK");
    assert.ok(bytes.length > 1000);
  }
});

test("report cadence clamps month-end dates and advances weekly", () => {
  assert.equal(evidence.advanceReportDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(evidence.advanceReportDate("2026-12-28", "weekly"), "2027-01-04");
});
