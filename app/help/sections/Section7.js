import SectionTemplate from "./template";

export default function Section7({ id }) {
  return (
    <SectionTemplate
      id={id}
      title="Billing & Seats"
      summary="Use seat controls to keep access smooth and avoid invite failures."
    >
      <h3 className="font-display text-2xl font-semibold text-neutral">What to do</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Check seat usage before inviting new members.</li>
        <li>Increase seats before onboarding a new team wave.</li>
        <li>Remove inactive members regularly.</li>
        <li>Review pending seat downgrades before renewal dates.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Do this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Keep a small seat buffer for urgent invites.</li>
        <li>Use the billing page as the single source for seat status.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Avoid this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Do not wait for an invite failure before adjusting seats.</li>
        <li>Do not schedule downgrades without checking current active members.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Example</h3>
      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 text-sm">
        If you plan to add 4 members next week and have 2 seats left, add at least 2 seats now so invites do not block
        rollout.
      </div>

      <h3 className="font-display text-2xl font-semibold text-neutral">Why this matters</h3>
      <p>Seat planning prevents access interruptions during critical project periods.</p>
    </SectionTemplate>
  );
}
