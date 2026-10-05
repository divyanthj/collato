// Text/vision workloads share one explicit model. Audio and embeddings remain
// dedicated models so changing report quality does not change those contracts.
export const AI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-6.1-sol";
export function textModelOptions() {
  return { model: AI_TEXT_MODEL, reasoning: { effort: "low" } };
}
