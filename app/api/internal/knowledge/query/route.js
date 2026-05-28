import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import {
  assertInternalKnowledgeTenant,
  authenticateInternalKnowledgeRequest,
  queryInternalKnowledge,
} from "@/lib/internal-knowledge";

function buildRetrievedContext(chunks = []) {
  return chunks
    .map((chunk, index) => {
      return `[${index + 1}] ${chunk.sourceLabel}\nTitle: ${chunk.title}\nSource ID: ${chunk.sourceId}\n${chunk.text}`;
    })
    .join("\n\n");
}

export async function POST(request) {
  const { credential, error: authError } = await authenticateInternalKnowledgeRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const tenantError = assertInternalKnowledgeTenant(credential, body.tenantSlug);
    if (tenantError) {
      return tenantError;
    }
    const question = String(body.question || "").trim();
    const chunks = await queryInternalKnowledge(body);
    const sources = chunks.slice(0, 8).map((chunk, index) => ({
      index: index + 1,
      tenantSlug: chunk.tenantSlug,
      sourceApp: chunk.sourceApp,
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      sourceLabel: chunk.sourceLabel,
      title: chunk.title,
      similarity: chunk.similarity,
      metadata: chunk.metadata,
    }));

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        answer: "OpenAI is not configured, but matching sources were retrieved.",
        sources,
      });
    }

    const response = await openai.responses.create({
      model: "gpt-5.2",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are an internal admin knowledge assistant. Answer only from the retrieved excerpts. Include source numbers when making factual claims. If the excerpts are insufficient, say what is missing.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Question:\n${question}\n\nRetrieved excerpts:\n${buildRetrievedContext(chunks) || "No matching excerpts were found."}`,
            },
          ],
        },
      ],
    });

    return NextResponse.json({
      answer: response.output_text,
      sources,
    });
  } catch (error) {
    console.error("Internal knowledge query failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not query knowledge." },
      { status: 400 }
    );
  }
}
