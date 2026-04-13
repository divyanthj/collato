export default function Sidebar({ links, compact = false }) {
  if (compact) {
    return (
      <div className="rounded-[1.4rem] border border-base-300 bg-base-100 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">On this page</div>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-xl border border-base-300 px-3 py-1.5 text-sm text-base-content/80 transition hover:border-primary/40 hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.4rem] border border-base-300 bg-base-100 p-3">
      <div className="px-3 pt-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">On this page</div>
      <ul className="menu rounded-box w-full">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
