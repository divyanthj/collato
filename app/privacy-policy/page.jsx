import Link from "next/link";
import appConfig from "@/config/app";

const effectiveDate = "April 13, 2026";
const legalEntity = "SimplySolved tech";
const contactEmail = appConfig?.resend?.replyTo || "support@collato.io";

const sections = [
  {
    title: "Information We Collect",
    body:
      "We collect information you provide directly, such as name, email, account details, workspace content, uploaded files, team updates, and communications you send to us.",
  },
  {
    title: "How We Use Information",
    body:
      "We use information to provide and improve Collato.io, operate workspaces, authenticate users, process billing, support collaboration features, respond to requests, and maintain platform security.",
  },
  {
    title: "Service Providers",
    body:
      "We work with trusted providers to run the product, including authentication, infrastructure, billing, and email delivery providers. These providers process data on our behalf under contractual controls.",
  },
  {
    title: "AI and Workspace Content",
    body:
      "Workspace files, updates, and notes may be processed to generate structured summaries and assistant responses. Access controls and workspace settings are used to limit who can view project information.",
  },
  {
    title: "Cookies and Similar Technologies",
    body:
      "We use cookies and similar technologies for login sessions, security, and core product functionality. Additional analytics usage may be added over time with updates to this policy.",
  },
  {
    title: "Data Retention",
    body:
      "We retain data for as long as needed to provide the service, comply with legal obligations, resolve disputes, and enforce agreements. Retention periods may vary by data type and account status.",
  },
  {
    title: "Security",
    body:
      "We use reasonable technical and organizational measures to protect information. No method of storage or transmission is fully secure, and we cannot guarantee absolute security.",
  },
  {
    title: "Your Choices and Rights",
    body:
      "You can request access, correction, or deletion of personal information by contacting us. We will review and respond in line with applicable law and operational requirements.",
  },
  {
    title: "Children's Privacy",
    body:
      "Collato.io is not intended for children under 13, and we do not knowingly collect personal information from children under 13.",
  },
  {
    title: "International Data Transfers",
    body:
      "Your information may be processed in countries other than your own. Where applicable, we use safeguards designed to protect data in cross-border processing scenarios.",
  },
  {
    title: "Policy Updates",
    body:
      "We may update this Privacy Policy from time to time. Updated versions will be posted on this page with a revised effective date.",
  },
];

export const metadata = {
  title: `Privacy Policy | ${appConfig.appName}`,
  description: "Privacy Policy for Collato.io, operated by SimplySolved tech.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen px-4 py-8 lg:px-6">
      <section className="mx-auto max-w-4xl">
        <div className="glass-panel rounded-[2rem] p-8 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-kicker">Legal</p>
              <h1 className="mt-2 text-4xl font-semibold text-neutral lg:text-5xl">Privacy Policy</h1>
              <p className="mt-4 text-sm text-base-content/70">Effective Date: {effectiveDate}</p>
            </div>
            <Link href="/" className="btn btn-outline btn-sm">
              Back to site
            </Link>
          </div>

          <div className="mt-6 rounded-[1.25rem] bg-base-100 p-5 text-sm leading-7 text-base-content/75">
            This Privacy Policy explains how <strong>{legalEntity}</strong> collects, uses, and protects personal
            information when you use Collato.io.
          </div>

          <div className="mt-8 space-y-6">
            {sections.map((section) => (
              <section key={section.title} className="rounded-[1.25rem] bg-base-100 p-6">
                <h2 className="text-2xl font-semibold text-neutral">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-base-content/75">{section.body}</p>
              </section>
            ))}
          </div>

          <section className="mt-6 rounded-[1.25rem] bg-base-100 p-6">
            <h2 className="text-2xl font-semibold text-neutral">Contact</h2>
            <p className="mt-3 text-sm leading-7 text-base-content/75">
              For privacy requests or questions, contact{" "}
              <a href={`mailto:${contactEmail}`} className="link link-primary">
                {contactEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
