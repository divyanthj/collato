import Link from "next/link";
import Sidebar from "./sidebar";

const links = [
  { href: "#getting-started", label: "Getting Started" },
  { href: "#workspace-setup", label: "Workspace Setup" },
  { href: "#member-access", label: "Members & Access" },
  { href: "#knowledge-management", label: "Knowledge Management" },
  { href: "#updates-tasks", label: "Updates, Tasks & Reports" },
  { href: "#ai-best-practices", label: "AI Best Practices" },
  { href: "#billing-seats", label: "Billing & Seats" },
  { href: "#troubleshooting", label: "Troubleshooting" }
];

export const metadata = {
  title: "Help | Collato.io",
  description: "Complete help center for Collato.io workspace setup, collaboration, AI reports, and billing."
};

export default function HelpLayout({ children }) {
  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-7xl px-6 pb-5 pt-8 lg:px-10">
        <div className="glass-panel rounded-[2rem] p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="section-kicker">Help Center</p>
              <h1 className="font-display mt-2 text-4xl font-semibold text-neutral lg:text-5xl">Collato documentation</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-base-content/70">
                Everything your team needs to set up projects, collect updates, use AI safely, and manage billing without
                confusion.
              </p>
            </div>
            <Link href="/" className="btn btn-outline">
              Back to home
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 lg:px-10">
        <div className="mb-4 lg:hidden">
          <Sidebar links={links} compact />
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <Sidebar links={links} />
            </div>
          </aside>

          <div className="glass-panel rounded-[2rem] p-6 lg:p-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
