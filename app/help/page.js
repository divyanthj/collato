import Section1 from "./sections/Section1";
import Section2 from "./sections/Section2";
import Section3 from "./sections/Section3";
import Section4 from "./sections/Section4";
import Section5 from "./sections/Section5";
import Section6 from "./sections/Section6";
import Section7 from "./sections/Section7";
import Section8 from "./sections/Section8";
import Link from "next/link";

export default function HelpPage() {
  return (
    <div>
      <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7 text-base-content/80">
        <strong>How to use this guide:</strong> start with Getting Started and Workspace Setup, then move to Updates,
        AI, and Billing once your team is live.
      </div>

      <Section1 id="getting-started" />
      <Section2 id="workspace-setup" />
      <Section3 id="member-access" />
      <Section4 id="knowledge-management" />
      <Section5 id="updates-tasks" />
      <Section6 id="ai-best-practices" />
      <Section7 id="billing-seats" />
      <Section8 id="troubleshooting" />

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="section-kicker">Developer integrations</p>
        <h2 className="font-display mt-2 text-3xl font-semibold text-neutral">Use Collato inside another app</h2>
        <p className="mt-3 max-w-3xl text-base leading-8 text-base-content/72">
          Read the internal knowledge API docs, AI-agent playbook, copy-paste integration examples, and security
          checklist for connecting Collato to a customer&apos;s own admin panel.
        </p>
        <Link href="/help/integrations" className="btn btn-primary mt-4">
          Open integration docs
        </Link>
      </section>
    </div>
  );
}
