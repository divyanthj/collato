import SectionTemplate from "./template";

export default function Section3({ id }) {
  return (
    <SectionTemplate
      id={id}
      title="Members & Access"
      summary="Give access based on contribution, not hierarchy."
    >
      <h3 className="font-display text-2xl font-semibold text-neutral">What to do</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Add members who post updates or complete tasks weekly.</li>
        <li>Review member list every week.</li>
        <li>Remove inactive users quickly.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Do this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Keep decision makers and execution owners in the same workspace.</li>
        <li>Use fewer members at first, then expand if needed.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Avoid this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Do not invite read-only observers who never act.</li>
        <li>Do not keep former team members active.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Example</h3>
      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 text-sm">
        Good first team: Owner, project manager, site lead, reporting lead. Add finance or procurement only if they
        actively use updates/tasks.
      </div>

      <h3 className="font-display text-2xl font-semibold text-neutral">Why this matters</h3>
      <p>A tight member list keeps updates focused and reduces seat waste.</p>
    </SectionTemplate>
  );
}
