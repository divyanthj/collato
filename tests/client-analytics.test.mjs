import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";

async function importSource(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const { trackDatafastGoal, sanitizeMetadata, analyticsCountBucket, analyticsHttpFailure, syncAnalyticsCohort } = await importSource("../lib/client-analytics.js");
const { getAnalyticsCohort } = await importSource("../lib/analytics-cohort.js");
const { validateWorkspaceReportResult } = await importSource("../lib/client-report-validation.js");
const originalWindow = globalThis.window;
afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("successful actions queue before the DataFast script loads and preserve order", () => {
  globalThis.window = { collatoAnalyticsCohort: "external" };
  assert.equal(trackDatafastGoal("workspace_created", { source: "workspace_create" }), true);
  const queue = window.datafast.q;
  assert.equal(trackDatafastGoal("report_generated", { template_id: "default-progress" }), true);
  assert.equal(window.datafast.q, queue);
  assert.deepEqual(queue.map((args) => Array.from(args)), [
    ["workspace_created", { cohort: "external", source: "workspace_create" }],
    ["report_generated", { cohort: "external", template_id: "default-progress" }]
  ]);
});

test("loaded SDK gets one call and cannot receive identity or workspace content", () => {
  const calls = [];
  globalThis.window = { datafast: (...args) => calls.push(args), collatoAnalyticsCohort: "internal_pilot" };
  trackDatafastGoal("checkout_redirected", { cohort: "external", source: "marketing_pricing", interval: "year", quantity: 3,
    email: "private@example.com", name: "Private name", workspace_slug: "private-client-project", question: "Private content", url: "https://private.test" });
  assert.deepEqual(calls, [["checkout_redirected", { cohort: "internal_pilot", source: "marketing_pricing", interval: "year", quantity: "2-5" }]]);
});

test("schema rejects arbitrary values and nested payloads; accepts low-cardinality buckets", () => {
  assert.equal(sanitizeMetadata(["unsafe"]), null);
  assert.equal(sanitizeMetadata({ source: "client company", template_id: "client-specific-template", role: { email: "private@example.com" } }), null);
  assert.deepEqual(sanitizeMetadata({ file_type: "application/pdf", question_length: 402, source_count: 4, channel: "Update", has_sources: "yes" }), {
    file_type: "pdf", question_length: "long", source_count: "2-5", channel: "update", has_sources: "yes"
  });
  assert.equal(analyticsCountBucket(0), "0");
  assert.equal(analyticsCountBucket(1), "1");
  assert.equal(analyticsCountBucket(20), "6-20");
  assert.equal(analyticsCountBucket(20000), "21+");
});

test("payload never exceeds ten properties including the protected cohort", () => {
  const calls = [];
  globalThis.window = { datafast: (...args) => calls.push(args) };
  trackDatafastGoal("test_event", { source: "chat", method: "google", interval: "month", mode: "new_subscription", requires_checkout: "yes", has_invites: "yes", has_description: "yes", has_assignee: "no", has_due_date: "no", has_attachments: "yes", has_sources: "yes" });
  assert.equal(Object.keys(calls[0][1]).length, 10);
  assert.equal(calls[0][1].cohort, "unknown");
});

test("invalid/reserved names and SDK failures do not block product actions", () => {
  globalThis.window = { datafast: () => { throw new Error("SDK unavailable"); } };
  assert.equal(trackDatafastGoal("report_generated"), false);
  assert.equal(trackDatafastGoal("identify"), false);
  assert.equal(trackDatafastGoal(""), false);
  delete globalThis.window;
  assert.equal(trackDatafastGoal("report_generated"), false);
});

test("invalid caller cohort cannot discard an otherwise valid event", () => {
  const calls = [];
  globalThis.window = { datafast: (...args) => calls.push(args) };
  assert.equal(trackDatafastGoal("report_generated", { cohort: "private content" }), true);
  assert.deepEqual(calls, [["report_generated", { cohort: "unknown" }]]);
});

test("goal names follow DataFast constraints and preserve colon delimiters", () => {
  const calls = [];
  globalThis.window = { datafast: (...args) => calls.push(args) };
  trackDatafastGoal(" Initiate:Checkout ");
  trackDatafastGoal("a".repeat(80));
  assert.equal(calls[0][0], "initiate:checkout");
  assert.equal(calls[1][0].length, 64);
});

test("cohort configuration classifies without exposing or guessing identities", () => {
  assert.equal(getAnalyticsCohort(null, "owner@example.com"), "anonymous");
  assert.equal(getAnalyticsCohort("customer@example.com", ""), "unknown");
  assert.equal(getAnalyticsCohort(" OWNER@example.com ", "owner@example.com,pilot@example.com"), "internal_pilot");
  assert.equal(getAnalyticsCohort("customer@example.com", "owner@example.com,pilot@example.com"), "external");
});

test("checkout failures distinguish auth, rejection, server and missing-URL cases without error text", () => {
  assert.equal(analyticsHttpFailure(401), "unauthorized");
  assert.equal(analyticsHttpFailure(403), "forbidden");
  assert.equal(analyticsHttpFailure(409), "conflict");
  assert.equal(analyticsHttpFailure(429), "rate_limited");
  assert.equal(analyticsHttpFailure(400), "invalid_request");
  assert.equal(analyticsHttpFailure(502), "server_error");
  assert.equal(analyticsHttpFailure(200), "invalid_response");
  assert.equal(analyticsHttpFailure(undefined), "network_or_client");
});

test("a server session-prop update refreshes cohort on signout without document reload", () => {
  const calls = [];
  globalThis.window = { datafast: (...args) => calls.push(args), collatoAnalyticsCohort: "internal_pilot" };
  trackDatafastGoal("workspace_section_viewed", { section: "hub" });
  syncAnalyticsCohort("anonymous");
  trackDatafastGoal("auth_started", { method: "google" });
  syncAnalyticsCohort("external");
  trackDatafastGoal("workspace_section_viewed", { section: "hub" });
  assert.deepEqual(calls.map((args) => args[1].cohort), ["internal_pilot", "anonymous", "external"]);
});

const defaultReport = {
  status: "ready", templateId: "default-progress", html: "<p>Report</p>", overview: "Overview",
  accomplishments: [], currentFocus: [], risks: [], nextSteps: [], sourceHighlights: []
};

test("a valid ready report satisfies the rendering contract", () => {
  assert.equal(validateWorkspaceReportResult(defaultReport, "default-progress"), "ready");
});

test("HTTP-OK error, partial, wrong-template and non-renderable reports are rejected", () => {
  for (const result of [{ error: "failed" }, {}, { ...defaultReport, status: "error" },
    { ...defaultReport, templateId: "wrong" }, { ...defaultReport, html: "" },
    { ...defaultReport, risks: [null] }, { ...defaultReport, nextSteps: undefined }]) {
    assert.throws(() => validateWorkspaceReportResult(result, "default-progress"), /response was incomplete/);
  }
});

test("clarification requires usable unique questions and cannot be mistaken for a ready report", () => {
  const result = { status: "needs_clarification", missingQuestions: [{ id: "q1", question: "Report date?", reason: "Missing date" }] };
  assert.equal(validateWorkspaceReportResult(result, "default-progress"), "needs_clarification");
  assert.throws(() => validateWorkspaceReportResult({ ...result, missingQuestions: [] }, "default-progress"));
  assert.throws(() => validateWorkspaceReportResult({ ...result, missingQuestions: [result.missingQuestions[0], result.missingQuestions[0]] }, "default-progress"));
  assert.throws(() => validateWorkspaceReportResult({ ...result, missingQuestions: [{ id: "q1" }] }, "default-progress"));
});

test("monthly report headers, list fields and table rows must be renderable", () => {
  const report = { status: "ready", templateId: "collato-monthly-report", html: "<p>Monthly report</p>", overview: "Overview", sourceHighlights: [],
    reportDate: "", preparedBy: "", reportNo: "", monthOf: "", projectAssociate: "", statusSummary: [], queryContacts: [], generalInstructions: [],
    projectOverviewRows: [{ description: "Activity", date: "" }], otherInfoRows: [] };
  assert.equal(validateWorkspaceReportResult(report, "collato-monthly-report"), "ready");
  assert.throws(() => validateWorkspaceReportResult({ ...report, otherInfoRows: [{}] }, "collato-monthly-report"));
  assert.throws(() => validateWorkspaceReportResult({ ...report, reportDate: {} }, "collato-monthly-report"));
});
