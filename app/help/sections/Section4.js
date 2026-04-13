import SectionTemplate from "./template";

export default function Section4({ id }) {
  return (
    <SectionTemplate
      id={id}
      title="Knowledge Management"
      summary="Treat your knowledge base like a working project file, not a dump folder."
    >
      <h3 className="font-display text-2xl font-semibold text-neutral">What to do</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Upload only current and useful files.</li>
        <li>Replace outdated versions promptly.</li>
        <li>Use clear file names with date/version.</li>
        <li>Keep sensitive material private where needed.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Do this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Keep one latest &ldquo;source of truth&rdquo; per document type.</li>
        <li>Delete duplicates after uploads.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Avoid this</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Do not keep stale drafts in active folders.</li>
        <li>Do not upload files with names like `final2-new-latest`.</li>
      </ul>

      <h3 className="font-display text-2xl font-semibold text-neutral">Example</h3>
      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 text-sm">
        Use `TowerB_Schedule_2026-04-13_v3.pdf` instead of `schedule final final.pdf`.
      </div>

      <h3 className="font-display text-2xl font-semibold text-neutral">Common mistakes</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Bulk uploading everything without cleanup.</li>
        <li>Forgetting to replace superseded files after approvals.</li>
      </ul>
    </SectionTemplate>
  );
}
