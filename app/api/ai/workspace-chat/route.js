import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizedWorkspace, getWorkspaceChatContext, saveWorkspaceChatMessage } from "@/lib/data";
import { openai } from "@/lib/openai";
import { getDisplayNameFromEmail } from "@/lib/user-display-name";
function buildFallbackFollowUps(question) {
    const trimmed = question.trim();
    return [
        `What evidence supports this?`,
        `What are the open actions related to this?`,
        trimmed ? `What else in the workspace is connected to "${trimmed}"?` : "What else in the workspace is connected to this?"
    ];
}
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const workspaceSlug = String(body.workspaceSlug ?? "");
    const question = String(body.question ?? "");
    if (!workspaceSlug || !question) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const workspace = await getAuthorizedWorkspace(workspaceSlug, request.auth.user.email);
    if (!workspace) {
        return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
    }
    const context = await getWorkspaceChatContext(workspaceSlug, request.auth.user.email, question);
    if (!context) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const encoder = new TextEncoder();
    const stream = await openai.responses.create({
        model: "gpt-5.2",
        stream: true,
        input: [
            {
                role: "system",
                content: [
                    {
                        type: "input_text",
                        text: "You are a workspace knowledge-base assistant. Answer using the retrieved workspace excerpts first, then use the task context only if it helps. Do not invent facts. Some workspace items may be marked private from AI and intentionally excluded from context. If the retrieved context is insufficient, say what is missing clearly."
                    }
                ]
            },
            {
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: `Workspace: ${context.workspace.name}

Retrieved excerpts:
${context.retrievedContext || "No retrieved workspace excerpts were found."}

Tasks:
${context.taskContext || "No tasks available."}

Question:
${question}`
                    }
                ]
            }
        ]
    });
    const readableStream = new ReadableStream({
        async start(controller) {
            try {
                let assistantText = "";
                const sources = (Array.isArray(context.sourceReferences) && context.sourceReferences.length > 0
                    ? context.sourceReferences
                    : context.sourceLabels.map((label) => ({
                        label,
                        sourceType: "",
                        sourceId: "",
                        href: ""
                    }))).slice(0, 4);
                const followUps = buildFallbackFollowUps(question);
                for await (const event of stream) {
                    if (event.type === "response.output_text.delta") {
                        assistantText += event.delta;
                        controller.enqueue(encoder.encode(`${JSON.stringify({
                            type: "delta",
                            text: event.delta
                        })}\n`));
                    }
                }
                await saveWorkspaceChatMessage({
                    workspaceSlug,
                    role: "user",
                    text: question,
                    createdBy: request.auth.user.email,
                    createdByName: getDisplayNameFromEmail(request.auth.user.email, "Signed in user", request.auth.user.name)
                });
                await saveWorkspaceChatMessage({
                    workspaceSlug,
                    role: "assistant",
                    text: assistantText.trim(),
                    sources,
                    followUps,
                    createdBy: request.auth.user.email,
                    createdByName: getDisplayNameFromEmail(request.auth.user.email, "Signed in user", request.auth.user.name)
                });
                controller.enqueue(encoder.encode(`${JSON.stringify({
                    type: "meta",
                    sources,
                    followUps
                })}\n`));
                controller.close();
            }
            catch (error) {
                console.error("Workspace chat stream failed:", error);
                controller.enqueue(encoder.encode(`${JSON.stringify({
                    type: "error",
                    error: "Could not stream workspace answer"
                })}\n`));
                controller.close();
            }
        }
    });
    return new Response(readableStream, {
        headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive"
        }
    });
});
