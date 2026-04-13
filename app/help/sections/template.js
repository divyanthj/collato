export default function SectionTemplate({ id, title, summary, children }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24 border-b border-base-300/70 pb-10 last:mb-0 last:border-b-0 last:pb-0">
      <h2 className="font-display text-3xl font-semibold text-neutral lg:text-4xl">{title}</h2>
      {summary ? <p className="mt-3 max-w-4xl text-base leading-8 text-base-content/72">{summary}</p> : null}
      <div className="mt-5 space-y-4 text-base leading-8 text-base-content/82">{children}</div>
    </section>
  );
}
