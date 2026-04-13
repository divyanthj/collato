import SectionTemplate from "./template";

export default function Section5({ id }) {
  return (
    <SectionTemplate
      id={id}
      title="Updates, Tasks & Reports"
      summary="Run this loop every week: update, assign, verify, report."
    >
      <h3 className="font-display text-2xl font-semibold text-neutral">What to do</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Post short updates daily or every other day.</li>
        <li>Convert blockers into tasks with owners and dates.</li>
        <li>Review open tasks weekly.</li>
        <li>Generate one weekly report for stakeholders.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Do this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Write updates using: progress, blocker, next step.</li>
        <li>Keep tasks outcome-based and date-bound.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Avoid this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Do not write vague updates like &ldquo;work in progress&rdquo;.</li>
        <li>Do not create tasks without owners.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Example</h3>
      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 text-sm">
        Update: &ldquo;Slab reinforcement completed for Zone A. Blocker: electrical conduit approval pending. Next
        step: start shuttering after approval by 3 PM tomorrow.&rdquo;
      </div>

      <h3 className="font-display text-2xl font-semibold text-neutral">Why this matters</h3>
      <p>Short structured updates make reports faster and more accurate.</p>
    </SectionTemplate>
  );
}
