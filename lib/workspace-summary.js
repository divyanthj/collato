import { getDatabase } from "@/lib/mongodb";
import { openai } from "@/lib/openai";
import { compactText, isPlaceholderKnowledgeText } from "@/lib/knowledge-summary";

function normalizeSummaryArray(items, maxItems) {
  return Array.isArray(items)
    ? items.map((item) => compactText(item)).filter(Boolean).slice(0, maxItems)
    : [];
}

function normalizeStoredSummary(summary) {
  const item = summary && typeof summary === "object" ? summary : {};

  return {
    overview: compactText(item.overview),
    knownPoints: normalizeSummaryArray(item.knownPoints, 4),
    actionItems: normalizeSummaryArray(item.actionItems, 2),
    status: compactText(item.status) || "insufficient_context",
    updatedAt: item.updatedAt ? new Date(String(item.updatedAt)).toISOString() : null,
  };
}

export function readStoredWorkspaceKnowledgeSummary(value) {
  const summary = normalizeStoredSummary(value);

  if (!summary.overview && summary.knownPoints.length === 0 && summary.actionItems.length === 0) {
    return null;
  }

  return summary;
}

export function buildKnowledgeSummaryFallback(data) {
  const meaningfulFiles = data.files.filter((file) => {
    const sourceText = file.extractedText || file.manualNotes || file.knowledgeText;
    return !isPlaceholderKnowledgeText(sourceText);
  });

  if (meaningfulFiles.length === 0 && data.updates.length === 0 && data.tasks.length === 0) {
    return {
      overview: "No knowledge has been captured yet.",
      knownPoints: [],
      actionItems: [],
      status: "insufficient_context",
      updatedAt: null,
    };
  }

  return {
    overview:
      meaningfulFiles.length > 0
        ? `${meaningfulFiles.length} ${meaningfulFiles.length === 1 ? "file is" : "files are"} ready. The saved workspace brief will update automatically as new knowledge is added.`
        : "Knowledge exists in this workspace, but the saved brief is still limited.",
    knownPoints: meaningfulFiles
      .slice(0, 4)
      .map((file) => `${file.fileName}: ${file.extractionSummary || "Knowledge captured."}`),
    actionItems: meaningfulFiles.length > 0 ? ["Upload more context or updates to improve the workspace brief."] : [],
    status: "partial_context",
    updatedAt: null,
  };
}

function buildKnowledgeContext(data) {
  const fileContext = data.files
    .map((file) => {
      const sourceText = file.extractedText || file.manualNotes || file.knowledgeText;

      if (isPlaceholderKnowledgeText(sourceText)) {
        return null;
      }

      return `File: ${file.fileName}
Type: ${file.fileType}
Content: ${compactText(sourceText).slice(0, 6000)}`;
    })
    .filter(Boolean)
    .slice(0, 8)
    .join("\n\n");

  const updateContext = data.updates
    .map(
      (update) =>
        `Update: ${update.createdByName}\nSummary: ${compactText(update.structured.summary)}\nKey points: ${update.structured.keyPoints.join("; ")}\nActions: ${update.structured.actionItems.join("; ")}`
    )
    .slice(0, 8)
    .join("\n\n");

  const taskContext = data.tasks
    .map(
      (task) =>
        `Task: ${task.title}\nStatus: ${task.status}\nAssignee: ${task.assigneeName || task.assigneeEmail || "Unassigned"}`
    )
    .slice(0, 10)
    .join("\n\n");

  return {
    fileContext,
    updateContext,
    taskContext,
    hasMeaningfulFileContext: Boolean(fileContext),
  };
}

export async function generateWorkspaceKnowledgeSummary(data) {
  const context = buildKnowledgeContext(data);

  if (!context.fileContext && !context.updateContext && !context.taskContext) {
    return {
      overview: "There is not enough extracted workspace knowledge to summarize yet.",
      knownPoints: [],
      actionItems: [],
      status: "insufficient_context",
      updatedAt: new Date().toISOString(),
    };
  }

  const response = await openai.responses.create({
    model: "gpt-5.2",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "You summarize workspace knowledge into a very concise project brief. Use only the provided file content, update summaries, and tasks. Keep the overview to 2-3 short sentences max. Keep knownPoints to at most 4 bullets, each one sentence. Keep actionItems to at most 2 short, optional next steps. Do not dump raw notes or copy long source passages. If the context is thin, say so plainly. Return strict JSON.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Workspace: ${data.workspace.name}

Files:
${context.fileContext || "No meaningful file text extracted yet."}

Updates:
${context.updateContext || "No updates yet."}

Tasks:
${context.taskContext || "No tasks yet."}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "workspace_knowledge_summary",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            overview: { type: "string" },
            knownPoints: {
              type: "array",
              items: { type: "string" },
            },
            actionItems: {
              type: "array",
              items: { type: "string" },
              maxItems: 2,
            },
          },
          required: ["overview", "knownPoints", "actionItems"],
        },
      },
    },
  });

  return normalizeStoredSummary({
    ...JSON.parse(response.output_text),
    status: context.hasMeaningfulFileContext ? "ready" : "partial_context",
    updatedAt: new Date().toISOString(),
  });
}

export async function persistWorkspaceKnowledgeSummary(workspaceSlug, summary) {
  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");

  await workspacesCollection.updateOne(
    { slug: workspaceSlug },
    {
      $set: {
        knowledgeSummary: normalizeStoredSummary(summary),
      },
    }
  );
}
