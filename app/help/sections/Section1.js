import SectionTemplate from "./template";

export default function Section1({ id }) {
  return (
    <SectionTemplate
      id={id}
      title="Getting Started"
      summary="Start here if you are opening Collato for the first time."
    >
      <h3 className="font-display text-2xl font-semibold text-neutral">What to do</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Create your organization.</li>
        <li>Create one workspace for one project.</li>
        <li>Invite only the core project team first.</li>
        <li>Upload 3-5 key project files.</li>
        <li>Post one update and generate one report.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Do this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Use a clear workspace name: `Client - Project`.</li>
        <li>Set a weekly reporting rhythm from day one.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Avoid this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Do not create multiple test workspaces for the same project.</li>
        <li>Do not invite everyone before your structure is ready.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Example</h3>
      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 text-sm">
        First hour setup: `GSC - Tower B` workspace, upload latest BOQ + schedule + meeting notes, invite PM + site lead,
        add first update, generate first weekly report.
      </div>

      <h3 className="font-display text-2xl font-semibold text-neutral">Why this matters</h3>
      <p>Early structure prevents messy context and bad reports later.</p>
    </SectionTemplate>
  );
}
