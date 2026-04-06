import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, getWorkspaceProgressReportContext } from "@/lib/data";
import { openai } from "@/lib/openai";
import { buildWorkspaceProgressReportHtml } from "@/lib/report-html";
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
    const context = await getWorkspaceProgressReportContext(workspaceSlug, request.auth.user.email);
    if (!context) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const clarificationContext = Object.entries(clarificationAnswers)
        .map(([questionId, answer]) => `${questionId}: ${String(answer).trim()}`)
        .filter((line) => !line.endsWith(":"))
        .join("\n");
    const gapResponse = await openai.responses.create({
        model: "gpt-5.2",
        input: [
            {
                role: "system",
                content: [
                    {
                        type: "input_text",
                        text: "You review workspace evidence before report generation. Identify only the most important missing information that would materially improve a professional progress report. If the report can proceed, return no questions. Focus on missing project facts like date range, client commitments, status updates, blockers, approvals, deliverables, risks, or next steps. Return strict JSON."
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

Existing clarification answers:
${clarificationContext || "None provided."}

Selected template:
${template.name}

Template guidance:
${template.promptGuidance}`
                    }
                ]
            }
        ],
        text: {
            format: {
                type: "json_schema",
                name: "workspace_report_gap_check",
                schema: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        canGenerate: { type: "boolean" },
                        missingQuestions: {
                            type: "array",
                            items: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    id: { type: "string" },
                                    question: { type: "string" },
                                    reason: { type: "string" }
                                },
                                required: ["id", "question", "reason"]
                            }
                        }
                    },
                    required: ["canGenerate", "missingQuestions"]
                }
            }
        }
    });
    const gapCheck = JSON.parse(gapResponse.output_text);
    const normalizedQuestions = gapCheck.missingQuestions.slice(0, 4);
    if (!gapCheck.canGenerate && normalizedQuestions.length > 0) {
        return NextResponse.json({
            status: "needs_clarification",
            missingQuestions: normalizedQuestions
        }, { status: 200 });
    }
    if (template.id === "collato-monthly-report") {
        const monthlyResponse = await openai.responses.create({
            model: "gpt-5.2",
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
            sourceHighlights: report.sourceHighlights.length > 0 ? report.sourceHighlights : context.sourceLabels.slice(0, 5)
        };
        return NextResponse.json({
            status: "ready",
            ...normalizedReport,
            html: buildWorkspaceProgressReportHtml({
                workspace: {
                    ...context.workspace,
                    fileCount: context.counts.fileCount,
                    updateCount: context.counts.updateCount,
                    taskCount: context.counts.taskCount
                },
                report: normalizedReport,
                generatedAt: new Date()
            })
        }, { status: 200 });
    }
    const response = await openai.responses.create({
        model: "gpt-5.2",
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
    return NextResponse.json({
        status: "ready",
        templateId: template.id,
        ...normalizedReport,
        html: buildWorkspaceProgressReportHtml({
            workspace: {
                ...context.workspace,
                fileCount: context.counts.fileCount,
                updateCount: context.counts.updateCount,
                taskCount: context.counts.taskCount
            },
            report: normalizedReport,
            generatedAt: new Date()
        })
    }, { status: 200 });
});

