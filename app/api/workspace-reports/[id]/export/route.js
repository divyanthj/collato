import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceDetailData } from "@/lib/data";
import { getDatabase } from "@/lib/mongodb";
import { canReadSavedReport, reportSections } from "@/lib/workspace-reports";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
export const runtime = "nodejs";

export const GET = auth(async (request, { params }) => {
  const email = request.auth?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = await getDatabase();
  const report = await db.collection("workspace_reports").findOne({ _id: new ObjectId(params.id) });
  const data = report && await getWorkspaceDetailData(report.workspaceSlug, email);
  if (!data) return NextResponse.json({ error: "Report unavailable" }, { status: 403 });
  if (!await canReadSavedReport(report, data)) return NextResponse.json({ error: "Report source access has changed" }, { status: 403 });
  const format = new URL(request.url).searchParams.get("format");
  if (!["pdf", "docx"].includes(format)) return NextResponse.json({ error: "Choose PDF or DOCX" }, { status: 400 });
  const heading = `${data.workspace.name} — Progress report`;
  const sections = [{ title: "Reporting period", text: `${report.period.start} to ${report.period.end}\nReport date: ${report.period.reportDate}\nStatus: ${report.state}` }, ...reportSections(report), { title: "Evidence coverage", text: report.coverage || "" }, { title: "Sources", text: report.sources.map(source => `[${source.ref}] ${source.label}\nhttps://collato.io${source.href}`).join("\n\n") }];
  let buffer;
  if (format === "docx") {
    const children = [new Paragraph({ text: heading, heading: HeadingLevel.TITLE }), ...sections.flatMap(section => [new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }), ...section.text.split("\n").map(text => new Paragraph({ children: [new TextRun(text)] }))])];
    buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  } else {
    const document = new PDFDocument({ size: "A4", margin: 50, info: { Title: heading } });
    const output = new Promise((resolve, reject) => { const chunks = []; document.on("data", chunk => chunks.push(chunk)); document.on("end", () => resolve(Buffer.concat(chunks))); document.on("error", reject); });
    document.fontSize(20).text(heading).moveDown();
    for (const section of sections) { document.fontSize(13).text(section.title).moveDown(0.4); document.fontSize(10).text(section.text || "Not provided", { lineGap: 4 }).moveDown(); }
    document.end(); buffer = await output;
  }
  return new Response(buffer, { headers: { "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="collato-report-${params.id}.${format}"`, "Cache-Control": "private, no-store" } });
});
