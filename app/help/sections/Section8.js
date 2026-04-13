import SectionTemplate from "./template";

export default function Section8({ id }) {
  return (
    <SectionTemplate
      id={id}
      title="Troubleshooting"
      summary="Use this quick checklist before raising support requests."
    >
      <h3 className="font-display text-2xl font-semibold text-neutral">What to do</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Refresh billing status if invites fail.</li>
        <li>Post a fresh update if reports look outdated.</li>
        <li>Upload missing files if chat responses are incomplete.</li>
        <li>Check that the correct workspace is selected.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Do this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Capture exact error text and time.</li>
        <li>Include organization slug and workspace slug in support requests.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Avoid this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Do not report &ldquo;not working&rdquo; without steps to reproduce.</li>
        <li>Do not assume AI can answer without updated workspace context.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Example</h3>
      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 text-sm">
        Useful support message: &ldquo;Invite failed at 10:14 AM IST in org `gsc`, workspace `tower-b`, while adding
        `user@example.com`. Error: Seat limit reached.&rdquo;
      </div>

      <h3 className="font-display text-2xl font-semibold text-neutral">Common mistakes</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Using stale screenshots from old sessions.</li>
        <li>Sending issue reports without workspace identifiers.</li>
      </ul>
    </SectionTemplate>
  );
}
