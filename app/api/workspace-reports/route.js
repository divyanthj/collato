import { buildWorkspaceProgressReportHtml } from "@/lib/report-html";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { getWorkspaceDetailData } from "@/lib/data";
import { getDatabase } from "@/lib/mongodb";
import { canReadSavedReport, listWorkspaceReports, saveReportVersion } from "@/lib/workspace-reports";
import { advanceReportDate } from "@/lib/evidence-utils";
import { hasUnknownCitations } from "@/lib/report-citations";

export const GET = auth(async request => {
  const email = request.auth?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await getWorkspaceDetailData(new URL(request.url).searchParams.get("workspaceSlug") || "", email);
  if (!data) return NextResponse.json({ error: "Workspace unavailable" }, { status: 403 });
  return NextResponse.json({ reports: await listWorkspaceReports(data.workspace.slug, data), canApprove: data.permissions.canManageWorkspaceMembers });
});

export const POST = auth(async request => {
  const email = request.auth?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json();
  if (!ObjectId.isValid(input.id) || JSON.stringify(input).length > 100000) return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  const data = await getWorkspaceDetailData(String(input.workspaceSlug || ""), email);
  if (!data) return NextResponse.json({ error: "Workspace unavailable" }, { status: 403 });
  const db = await getDatabase();
  const parent = await db.collection("workspace_reports").findOne({ _id: new ObjectId(input.id), workspaceSlug: data.workspace.slug });
  if (!parent) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (!await canReadSavedReport(parent, data)) return NextResponse.json({ error: "Report source access has changed" }, { status: 403 });
  if (input.action === "approve") {
    if (!data.permissions.canManageWorkspaceMembers) return NextResponse.json({ error: "Workspace administrators approve reports" }, { status: 403 });
    if (hasUnknownCitations(parent)) return NextResponse.json({ error: "Some citations cannot be matched to a source. Correct them in a new draft before approving." }, { status: 400 });
    const approvedHtml = buildWorkspaceProgressReportHtml({ workspace: parent.workspaceSnapshot || data.workspace, report: { ...parent, state: "approved" }, generatedAt: parent.createdAt });
    const approval = await db.collection("workspace_reports").updateOne({ _id: parent._id, state: "draft" }, { $set: { state: "approved", html: approvedHtml, approvedAt: new Date(), approvedBy: email } });
    if (approval.modifiedCount) {
      const schedules = db.collection("workspace_report_schedules");
      const schedule = await schedules.findOne({ _id: data.workspace.slug });
      if (schedule?.cadence !== "none" && schedule?.nextReportDate && schedule.nextReportDate <= parent.period.end) {
        await schedules.updateOne({ _id: data.workspace.slug, nextReportDate: schedule.nextReportDate }, { $set: { nextReportDate: advanceReportDate(schedule.nextReportDate, schedule.cadence) } });
      }
    }
    return NextResponse.json({ ...parent, _id: undefined, id: String(parent._id), status: "ready", state: "approved", html: approvedHtml, createdAt: parent.createdAt.toISOString() });
  }
  try {
    const version = await saveReportVersion({ workspace: data.workspace, report: { ...input.report, templateId: parent.templateId }, parent, email });
    return NextResponse.json(version, { status: 201 });
  } catch { return NextResponse.json({ error: "Report fields are incomplete. Please review them." }, { status: 400 }); }
});
