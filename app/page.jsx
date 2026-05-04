import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import appConfig from "@/config/app";
import { AuthEntryPanel } from "@/components/auth-entry-panel";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { PricingSection } from "@/components/pricing-section";

const pillars = [
  {
    title: "Workspace hubs",
    body: "Give every client, project, or strategic initiative its own focused operating lane with members, history, and context.",
    icon: "folder",
  },
  {
    title: "Knowledge indexing",
    body: "Files, notes, and captured decisions live together so the important details stop hiding in folders, chats, and inboxes.",
    icon: "search",
  },
  {
    title: "Field updates",
    body: "Teams can log typed or spoken updates and turn raw progress into structured memory without extra admin work.",
    icon: "check",
  },
  {
    title: "Grounded AI",
    body: "Ask questions, generate reports, and surface next steps from project evidence instead of relying on generic guesses.",
    icon: "spark",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Create workspace",
    body: "Start one workspace for the client, project, or initiative you need to organize first."
  },
  {
    step: "2",
    title: "Add context",
    body: "Upload files, notes, and screenshots your team usually keeps scattered across tools."
  },
  {
    step: "3",
    title: "Capture updates",
    body: "Turn field notes and team check-ins into structured progress instead of raw fragments."
  },
  {
    step: "4",
    title: "Generate report",
    body: "Use the captured evidence to produce a progress-ready summary without starting from scratch."
  }
];

function FeatureIcon({ type }) {
  if (type === "search") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-current" fill="none" strokeWidth="1.8">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "check") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-current" fill="none" strokeWidth="1.8">
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="m8.5 12 2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "spark") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-current" fill="none" strokeWidth="1.8">
        <path d="M12 3v5M12 16v5M4 12h5M15 12h5M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-current" fill="none" strokeWidth="1.8">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3l1.6 1.8H17.5A2.5 2.5 0 0 1 20 9.3v7.2A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" strokeLinejoin="round" />
    </svg>
  );
}

function ProductPreview() {
  return (
    <div className="brand-card relative overflow-hidden p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(91,94,247,0.18),transparent_22%),radial-gradient(circle_at_25%_90%,rgba(16,183,165,0.08),transparent_18%)]" />
      <div className="relative grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[1.7rem] border border-white/8 bg-black/18 p-5">
          <div className="flex items-center gap-3">
            <Image
              src="/collato-logo.jpg"
              alt="Collato.io logo"
              width={44}
              height={44}
              className="h-9 w-9 rounded-xl object-cover"
            />
            <div className="text-lg font-semibold text-neutral">{appConfig.appName}</div>
          </div>

          <div className="mt-6 space-y-3">
            {["Files & documents", "Field updates", "Team decisions", "Client communications", "AI answers"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-base-content/82">
                {item}
              </div>
            ))}
          </div>

          <div className="mx-auto mt-6 max-w-[190px] rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-neutral">
            Progress summary
            <div className="text-xs text-base-content/64">(ready to share)</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.7rem] border border-white/10 bg-brand-sheen bg-[length:180%_180%] p-6 text-white animate-shimmer">
            <div className="text-xs uppercase tracking-[0.24em] text-white/78">Primary outcome</div>
            <div className="mt-3 text-2xl font-semibold leading-tight">
              A workspace that turns scattered inputs into a report-ready operating picture.
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/80">
              Capture project evidence once, then reuse it for answers, handoffs, follow-ups, and client-facing summaries.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/80">Built for teams</div>
              <p className="mt-3 text-sm leading-7 text-base-content/74">
                Managing client work, site visits, project documents, and the small details that usually get lost between updates.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/80">First-run promise</div>
              <p className="mt-3 text-sm leading-7 text-base-content/74">
                Start with one workspace and one clear path: context in, updates captured, report out.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const session = await auth();
  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-8 lg:px-10">
        <div className="glass-panel relative overflow-hidden rounded-[2.5rem] shadow-soft">
          <div className="absolute inset-0 bg-mesh-glow opacity-90" />
          <div className="absolute -right-10 top-20 h-40 w-40 rounded-full bg-primary/18 blur-3xl animate-drift" />
          <div className="absolute bottom-6 left-10 h-32 w-32 rounded-full bg-secondary/16 blur-3xl animate-drift" />

          <div className="relative px-8 py-8 lg:px-12 lg:py-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="badge badge-outline border-primary/30 px-4 py-4 uppercase tracking-[0.28em] text-primary">
                Project memory hub
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="#features" className="btn btn-ghost">
                  Features
                </Link>
                <Link href="#how-it-works" className="btn btn-ghost">
                  How it works
                </Link>
                <Link href="#pricing" className="btn btn-ghost">
                  Pricing
                </Link>
                {session?.user ? (
                  <Link href="/dashboard" className="btn btn-primary">
                    Go to dashboard
                  </Link>
                ) : (
                  <GoogleSignInButton
                    className="btn btn-primary"
                    label="Go to dashboard"
                    callbackUrl="/dashboard?authSuccess=1"
                    analyticsSource="landing_header"
                  />
                )}
              </div>
            </div>

            <div className="mt-12 grid gap-10 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-8">
                <div className="space-y-5">
                  <p className="inline-flex rounded-full border border-primary/18 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Project memory hub
                  </p>
                  <h1 className="font-display max-w-4xl text-5xl font-semibold leading-[0.95] text-neutral lg:text-7xl">
                    {appConfig.brand.heroHeadline}
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-base-content/74">
                    {appConfig.brand.heroBody}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {session?.user ? (
                    <Link href="/dashboard" className="btn btn-primary btn-lg">
                      Go to dashboard
                    </Link>
                  ) : (
                    <GoogleSignInButton
                      className="btn btn-primary btn-lg"
                      label="Go to dashboard"
                      callbackUrl="/dashboard?authSuccess=1"
                      analyticsSource="landing_hero"
                    />
                  )}
                  <a href="#how-it-works" className="btn btn-outline btn-lg">
                    See how it works
                  </a>
                </div>

                <div className="flex items-center gap-3 text-sm text-base-content/72">
                  <span className="text-primary">Check</span>
                  <span>No credit card required</span>
                </div>
              </div>

              <div className="space-y-5">
                <ProductPreview />
                {!session?.user ? <AuthEntryPanel /> : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 pb-14 lg:px-10">
        <div className="glass-panel rounded-[2rem] p-8">
          <div className="text-center">
            <p className="section-kicker">Core capabilities</p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-6 shadow-sm">
                <div className="brand-orb flex h-12 w-12 items-center justify-center rounded-2xl text-white opacity-95">
                  <FeatureIcon type={pillar.icon} />
                </div>
                <h3 className="font-display mt-5 text-2xl font-semibold text-neutral">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-7 text-base-content/72">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 pb-14 lg:px-10">
        <div className="glass-panel rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(124,77,255,0.12),transparent_34%),linear-gradient(180deg,rgba(12,18,32,0.94),rgba(10,14,24,0.96))] p-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="section-kicker">How it works</p>
            <h2 className="font-display mt-2 text-4xl font-semibold text-neutral">
              A simple four-step path to your first usable project summary.
            </h2>
            <p className="mt-4 text-sm leading-7 text-base-content/72">
              Collato works best when the first session feels guided instead of open-ended. Start small, then expand once the team sees value.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {howItWorks.map((item) => (
              <div key={item.step} className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/18 text-sm font-semibold text-neutral">
                  {item.step}
                </div>
                <h3 className="font-display mt-4 text-2xl font-semibold text-neutral">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-base-content/72">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection pricing={appConfig.pricing} isAuthenticated={Boolean(session?.user)} />

      <section className="mx-auto max-w-7xl px-6 pb-12 lg:px-10">
        <div className="glass-panel rounded-[2rem] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-base-content/70">
            <div>
              {"\u00A9"} {currentYear} {appConfig.appName}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/contact" className="link link-hover text-base-content/75">
                Contact
              </Link>
              <Link href="/help" className="link link-hover text-base-content/75">
                Help
              </Link>
              <Link href="/tos" className="link link-hover text-base-content/75">
                Terms of Service
              </Link>
              <Link href="/privacy-policy" className="link link-hover text-base-content/75">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
