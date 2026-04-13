import Link from "next/link";
import appConfig from "@/config/app";

const effectiveDate = "April 13, 2026";
const legalEntity = "SimplySolved tech";
const contactEmail = appConfig?.resend?.replyTo || "support@collato.io";

const sections = [
  {
    title: "Acceptance of Terms",
    body:
      "By accessing or using Collato.io, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the service.",
  },
  {
    title: "Eligibility and Accounts",
    body:
      "You must provide accurate account information and keep your login credentials secure. You are responsible for activity that occurs under your account.",
  },
  {
    title: "Subscriptions and Billing",
    body:
      "Paid plans are billed per member seat on a monthly or annual interval, based on your selected plan. You authorize charges for active seats, and taxes may apply where required.",
  },
  {
    title: "Acceptable Use",
    body:
      "You agree not to misuse the service, interfere with operations, attempt unauthorized access, upload unlawful content, or violate applicable laws while using Collato.io.",
  },
  {
    title: "Intellectual Property",
    body:
      "Collato.io, including its software, branding, and platform design, is owned by SimplySolved tech and protected by applicable intellectual property laws. You retain rights to your own content.",
  },
  {
    title: "Service Availability and Changes",
    body:
      "We may update, improve, suspend, or discontinue parts of the service from time to time. We are not liable for losses caused by planned or unplanned downtime.",
  },
  {
    title: "Disclaimers",
    body:
      "Collato.io is provided on an \"as is\" and \"as available\" basis, without warranties of any kind, whether express or implied, to the maximum extent permitted by law.",
  },
  {
    title: "Limitation of Liability",
    body:
      "To the fullest extent permitted by law, SimplySolved tech will not be liable for indirect, incidental, special, consequential, or punitive damages, or loss of data, revenue, or profits.",
  },
  {
    title: "Termination",
    body:
      "We may suspend or terminate access if these Terms are violated or if required for legal, security, or operational reasons. You may stop using the service at any time.",
  },
  {
    title: "Governing Law and Venue",
    body:
      "These Terms are governed by the laws of India. Any dispute arising from or relating to these Terms or the service will be subject to the competent courts in India.",
  },
  {
    title: "Updates to Terms",
    body:
      "We may revise these Terms periodically. Updated Terms will be posted on this page with a new effective date. Continued use after updates means you accept the revised Terms.",
  },
];

export const metadata = {
  title: `Terms of Service | ${appConfig.appName}`,
  description: "Terms of Service for Collato.io, operated by SimplySolved tech.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen px-4 py-8 lg:px-6">
      <section className="mx-auto max-w-4xl">
        <div className="glass-panel rounded-[2rem] p-8 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-kicker">Legal</p>
              <h1 className="mt-2 text-4xl font-semibold text-neutral lg:text-5xl">Terms of Service</h1>
              <p className="mt-4 text-sm text-base-content/70">Effective Date: {effectiveDate}</p>
            </div>
            <Link href="/" className="btn btn-outline btn-sm">
              Back to site
            </Link>
          </div>

          <div className="mt-6 rounded-[1.25rem] bg-base-100 p-5 text-sm leading-7 text-base-content/75">
            These Terms govern your use of Collato.io, operated by <strong>{legalEntity}</strong>.
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
              For questions about these Terms, contact us at{" "}
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
