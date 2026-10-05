import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceDetailData } from "@/lib/data";
import { getDatabase } from "@/lib/mongodb";
import { normalizeDateOnly } from "@/lib/evidence-utils";
export const GET = auth(async request => {
  if (!request.auth?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await getWorkspaceDetailData(new URL(request.url).searchParams.get("workspaceSlug") || "", request.auth.user.email);
  if (!data) return NextResponse.json({ error: "Workspace unavailable" }, { status: 403 });
  const db = await getDatabase();
  const schedule = await db.collection("workspace_report_schedules").findOne({ _id: data.workspace.slug });
  return NextResponse.json({ schedule: { cadence: schedule?.cadence || "none", nextReportDate: schedule?.nextReportDate || "" }, canEdit: data.permissions.canManageWorkspaceMembers });
});
export const POST = auth(async request => {
  if (!request.auth?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json();
  if (!["none", "weekly", "monthly"].includes(input.cadence) || !normalizeDateOnly(input.nextReportDate)) return NextResponse.json({ error: "Choose a valid reporting date and cadence" }, { status: 400 });
  const data = await getWorkspaceDetailData(String(input.workspaceSlug || ""), request.auth.user.email);
  if (!data?.permissions.canManageWorkspaceMembers) return NextResponse.json({ error: "Only workspace administrators can set the reporting schedule" }, { status: 403 });
  const db = await getDatabase();
  await db.collection("workspace_report_schedules").updateOne({ _id: data.workspace.slug }, { $set: { cadence: input.cadence, nextReportDate: input.nextReportDate, updatedAt: new Date(), updatedBy: request.auth.user.email } }, { upsert: true });
  return NextResponse.json({ success: true });
});
