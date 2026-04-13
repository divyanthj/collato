import SectionTemplate from "./template";

export default function Section2({ id }) {
  return (
    <SectionTemplate
      id={id}
      title="Workspace Setup"
      summary="Set each workspace so people can act fast without asking you for context."
    >
      <h3 className="font-display text-2xl font-semibold text-neutral">What to do</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Write a one-line workspace scope.</li>
        <li>Add the current project stage in the description.</li>
        <li>Upload latest approved files first.</li>
        <li>Create initial tasks for this week only.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Do this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Keep files grouped by purpose: briefs, drawings, approvals, progress.</li>
        <li>Use date/version in file names.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Avoid this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Do not upload outdated drafts as primary files.</li>
        <li>Do not keep vague task titles like &ldquo;follow up&rdquo;.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Example</h3>
      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 text-sm">
        Task title: &ldquo;Submit revised MEP drawing to client by Friday&rdquo; is good. &ldquo;Drawing task&rdquo; is not.
      </div>

      <h3 className="font-display text-2xl font-semibold text-neutral">Common mistakes</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Mixing two unrelated projects in one workspace.</li>
        <li>Adding too many low-priority files on day one.</li>
      </ul>
    </SectionTemplate>
  );
}
