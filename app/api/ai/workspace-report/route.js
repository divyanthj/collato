import { textModelOptions } from "@/lib/ai-models";
import { normalizeReportPeriod } from "@/lib/evidence-utils";
import { saveReportVersion } from "@/lib/workspace-reports";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, getWorkspaceProgressReportContext } from "@/lib/data";
import { openai } from "@/lib/openai";

import { getReportTemplateDefinition } from "@/lib/report-templates";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const workspaceSlug = String(body.workspaceSlug ?? "");
    const templateId = String(body.templateId ?? "default-progress");
    const template = getReportTemplateDefinition(templateId);
    const clarificationAnswers = body.clarificationAnswers && typeof body.clarificationAnswers === "object"
        ? body.clarificationAnswers
        : {};
    if (!workspaceSlug) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const workspace = await getAuthorizedWorkspace(workspaceSlug, request.auth.user.email);
    if (!workspace) {
        return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
    }
    let period;
    try { period = normalizeReportPeriod(body); } catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
    const context = await getWorkspaceProgressReportContext(workspaceSlug, request.auth.user.email, period);
    if (!context) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const clarificationContext = Object.entries(clarificationAnswers)
        .map(([questionId, answer]) => `${questionId}: ${String(answer).trim()}`)
        .filter((line) => !line.endsWith(":"))
        .join("\n");
    if (template.id === "collato-monthly-report") {
        const monthlyResponse = await openai.responses.create({
            ...textModelOptions(),
            max_output_tokens: 12000,
            input: [
                {
                    role: "system",
                    content: [
                        {
                            type: "input_text",
                            text: "You create polished monthly project reports using only the supplied context. Follow the required monthly report format carefully. Keep headers concise, keep activity rows concrete, and do not invent missing facts."
                        }
                    ]
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `Workspace: ${context.workspace.name}

Retrieved evidence:
${context.retrievedContext || "No retrieved evidence found."}

Recent updates:
${context.recentUpdates || "No recent updates."}

Tasks:
${context.taskSnapshot || "No tasks."}

Files:
${context.fileSnapshot || "No files."}

Workspace overview:
Channels: ${context.overview.channels.join(", ") || "None"}
Key points: ${context.overview.keyPoints.join("; ") || "None"}
Action items: ${context.overview.actionItems.join("; ") || "None"}
Open task count: ${context.overview.openTaskCount}

Clarification answers:
${clarificationContext || "None provided."}

Template guidance:
${template.promptGuidance}`
                        }
                    ]
                }
            ],
            text: {
                format: {
                    type: "json_schema",
                    name: "monthly_workspace_progress_report",
                    schema: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            overview: { type: "string" },
                            reportDate: { type: "string" },
                            preparedBy: { type: "string" },
                            reportNo: { type: "string" },
                            monthOf: { type: "string" },
                            queryContacts: {
                                type: "array",
                                items: { type: "string" }
                            },
                            projectAssociate: { type: "string" },
                            statusSummary: {
                                type: "array",
                                items: { type: "string" }
                            },
                            projectOverviewRows: {
                                type: "array",
                                items: {
                                    type: "object",
                                    additionalProperties: false,
                                    properties: {
                                        description: { type: "string" },
                                        date: { type: "string" }
                                    },
                                    required: ["description", "date"]
                                }
                            },
                            otherInfoRows: {
                                type: "array",
                                items: {
                                    type: "object",
                                    additionalProperties: false,
                                    properties: {
                                        description: { type: "string" },
                                        date: { type: "string" }
                                    },
                                    required: ["description", "date"]
                                }
                            },
                            generalInstructions: {
                                type: "array",
                                items: { type: "string" }
                            },
                            sourceHighlights: {
                                type: "array",
                                items: { type: "string" }
                            }
                        },
                        required: [
                            "overview",
                            "reportDate",
                            "preparedBy",
                            "reportNo",
                            "monthOf",
                            "queryContacts",
                            "projectAssociate",
                            "statusSummary",
                            "projectOverviewRows",
                            "otherInfoRows",
                            "generalInstructions",
                            "sourceHighlights"
                        ]
                    }
                }
            }
        });
        const report = JSON.parse(monthlyResponse.output_text);
        const normalizedReport = {
            templateId: "collato-monthly-report",
            ...report,
            reportDate: period.reportDate,
            monthOf: `${period.start} to ${period.end}`,
            sourceHighlights: report.sourceHighlights.length > 0 ? report.sourceHighlights : context.sourceLabels.slice(0, 5)
        };
        const saved = await saveReportVersion({ workspace: { ...context.workspace, ...context.counts }, report: { ...normalizedReport, period, sources: context.sources, coverage: context.coverage }, email: request.auth.user.email });
        return NextResponse.json(saved, { status: 200 });
    }
    const response = await openai.responses.create({
        ...textModelOptions(),
            max_output_tokens: 12000,
        input: [
            {
                role: "system",
                content: [
                    {
                        type: "input_text",
                        text: "You create crisp, professional progress summaries for project workspaces. Use only the provided context. Keep it practical, specific, and suitable for a first internal/client-ready draft."
                    }
                ]
            },
            {
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: `Workspace: ${context.workspace.name}

Retrieved evidence:
${context.retrievedContext || "No retrieved evidence found."}

Recent updates:
${context.recentUpdates || "No recent updates."}

Tasks:
${context.taskSnapshot || "No tasks."}

Files:
${context.fileSnapshot || "No files."}

Workspace overview:
Channels: ${context.overview.channels.join(", ") || "None"}
Key points: ${context.overview.keyPoints.join("; ") || "None"}
Action items: ${context.overview.actionItems.join("; ") || "None"}
Open task count: ${context.overview.openTaskCount}

Clarification answers:
${clarificationContext || "None provided."}

Template guidance:
${template.promptGuidance}`
                    }
                ]
            }
        ],
        text: {
            format: {
                type: "json_schema",
                name: "workspace_progress_report",
                schema: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        overview: { type: "string" },
                        accomplishments: {
                            type: "array",
                            items: { type: "string" }
                        },
                        currentFocus: {
                            type: "array",
                            items: { type: "string" }
                        },
                        risks: {
                            type: "array",
                            items: { type: "string" }
                        },
                        nextSteps: {
                            type: "array",
                            items: { type: "string" }
                        },
                        sourceHighlights: {
                            type: "array",
                            items: { type: "string" }
                        }
                    },
                    required: ["overview", "accomplishments", "currentFocus", "risks", "nextSteps", "sourceHighlights"]
                }
            }
        }
    });
    const report = JSON.parse(response.output_text);
    const normalizedReport = {
        ...report,
        sourceHighlights: report.sourceHighlights.length > 0 ? report.sourceHighlights : context.sourceLabels.slice(0, 5)
    };
    const saved = await saveReportVersion({ workspace: { ...context.workspace, ...context.counts }, report: { ...normalizedReport, templateId: template.id, period, sources: context.sources, coverage: context.coverage }, email: request.auth.user.email });
    return NextResponse.json(saved, { status: 200 });
});
