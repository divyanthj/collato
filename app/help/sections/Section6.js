import SectionTemplate from "./template";

export default function Section6({ id }) {
  return (
    <SectionTemplate
      id={id}
      title="AI Best Practices"
      summary="Ask for specific outputs and verify before sharing."
    >
      <h3 className="font-display text-2xl font-semibold text-neutral">What to do</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Ask targeted questions, not broad ones.</li>
        <li>Request summaries with dates and action owners.</li>
        <li>Cross-check numbers and names before sending.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Do this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Use prompts like: &ldquo;Summarize blockers from last 7 days.&rdquo;</li>
        <li>Ask: &ldquo;List pending actions by owner.&rdquo;</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Avoid this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Do not copy AI text directly to clients without review.</li>
        <li>Do not ask for insights when source updates are stale.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Example</h3>
      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 text-sm">
        Prompt: &ldquo;Create a client-ready weekly summary with 3 wins, 2 blockers, and next actions with owners.&rdquo;
      </div>

      <h3 className="font-display text-2xl font-semibold text-neutral">Common mistakes</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Using AI as first source instead of project updates.</li>
        <li>Skipping factual checks on dates and quantities.</li>
      </ul>
    </SectionTemplate>
  );
}
