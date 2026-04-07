import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { openai } from "@/lib/openai";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const workspaceName = String(body.workspaceName ?? "");
    const channel = String(body.channel ?? "");
    const rawNote = String(body.rawNote ?? "");
    if (!workspaceName || !channel || !rawNote) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const response = await openai.responses.create({
        model: "gpt-5.2",
        input: [
            {
                role: "system",
                content: [
                    {
                        type: "input_text",
                        text: "You convert casual team updates into reusable workspace knowledge. Return clean JSON with a concise summary, the main key points, up to 2 optional follow-up suggestions, and one sentence explaining how this update improves the knowledge base. Follow-ups must be lightweight and non-prescriptive; if none are clearly needed, return an empty array."
                    }
                ]
            },
            {
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: `Workspace: ${workspaceName}
Channel: ${channel}
Raw update: ${rawNote}`
                    }
                ]
            }
        ],
        text: {
            format: {
                type: "json_schema",
                name: "structured_workspace_update",
                schema: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        summary: { type: "string" },
                        keyPoints: {
                            type: "array",
                            items: { type: "string" }
                        },
                        actionItems: {
                            type: "array",
                            items: { type: "string" },
                            maxItems: 2
                        },
                        knowledgeContribution: { type: "string" }
                    },
                    required: ["summary", "keyPoints", "actionItems", "knowledgeContribution"]
                }
            }
        }
    });
    const parsed = JSON.parse(response.output_text);

    return NextResponse.json({
        ...parsed,
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 2) : []
    });
});
