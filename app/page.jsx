import Image from "next/image";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import logo from "@/app/logo.png";
import appConfig from "@/config/app";
import { AuthEntryPanel } from "@/components/auth-entry-panel";
import { PricingSection } from "@/components/pricing-section";

const pillars = [
  {
    title: "Workspace hubs",
    body: "Give every client, project, or strategic initiative its own focused operating lane with members, history, and context.",
  },
  {
    title: "Knowledge indexing",
    body: "Files, notes, and captured decisions live together so the important details stop hiding in folders, chats, and inboxes.",
  },
  {
    title: "Field updates",
    body: "Teams can log typed or spoken updates and turn raw progress into structured memory without extra admin work.",
  },
  {
    title: "Grounded AI",
    body: "Ask questions, generate reports, and surface next steps from project evidence instead of relying on generic guesses.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-8 lg:px-10">
        <div className="glass-panel relative overflow-hidden rounded-[2.5rem] shadow-soft">
          <div className="absolute inset-0 bg-mesh-glow opacity-95" />
          <div className="absolute -right-10 top-20 h-40 w-40 rounded-full bg-secondary/20 blur-3xl animate-drift" />
          <div className="absolute bottom-6 left-10 h-32 w-32 rounded-full bg-accent/20 blur-3xl animate-drift" />

          <div className="relative px-8 py-8 lg:px-12 lg:py-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="badge badge-outline border-primary/25 bg-base-100/70 px-4 py-4 uppercase tracking-[0.28em] text-primary">
                {appConfig.appName}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="#features" className="btn btn-ghost">
                  Features
                </Link>
                <Link href="#pricing" className="btn btn-ghost">
                  Pricing
                </Link>
                {session?.user ? (
                  <Link href="/dashboard" className="btn btn-primary">
                    Open dashboard
                  </Link>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await signIn("google", {
                        redirectTo: "/dashboard",
                        prompt: "select_account"
                      });
                    }}
                  >
                    <button className="btn btn-primary">Continue with Google</button>
                  </form>
                )}
              </div>
            </div>

            <div className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-8">
                <div className="brand-card inline-flex max-w-[340px] items-center justify-center p-4">
                  <Image
                    src={logo}
                    alt="Collato.io logo"
                    width={520}
                    height={280}
                    priority
                    className="h-auto w-full"
                  />
                </div>

                <div className="space-y-5">
                  <p className="section-kicker">{appConfig.brand.heroKicker}</p>
                  <h1 className="font-display max-w-4xl text-5xl font-semibold leading-[0.92] text-neutral lg:text-7xl">
                    {appConfig.brand.heroHeadline}
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-base-content/72">
                    {appConfig.brand.heroBody}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href="/dashboard" className="btn btn-primary btn-lg">
                    Open dashboard
                  </Link>
                  <a href="#features" className="btn btn-outline btn-lg">
                    Explore the workflow
                  </a>
                </div>
              </div>

              <div className="space-y-5">
                <div className="brand-card overflow-hidden p-6">
                  <div className="rounded-[1.7rem] bg-neutral bg-brand-sheen bg-[length:180%_180%] p-6 text-white animate-shimmer">
                    <div className="text-xs uppercase tracking-[0.24em] text-white/75">Primary outcome</div>
                    <div className="mt-3 text-2xl font-semibold">
                      Institutional memory that keeps the whole delivery team aligned.
                    </div>
                    <p className="mt-3 max-w-md text-sm leading-7 text-white/80">
                      Capture project evidence once, then reuse it for questions, handoffs, reports, and follow-up.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Built for</div>
                      <p className="mt-2 text-sm leading-7 text-base-content/72">
                        Teams managing client work, site updates, project documents, and the small details that are easy to lose.
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Works like</div>
                      <p className="mt-2 text-sm leading-7 text-base-content/72">
                        A clean DaisyUI workspace layer with knowledge capture, update structuring, task tracking, and grounded chat.
                      </p>
                    </div>
                  </div>
                </div>

                {!session?.user ? <AuthEntryPanel /> : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 pb-14 lg:px-10">
        <div className="glass-panel rounded-[2rem] p-8">
          <div className="max-w-3xl">
            <p className="section-kicker">Core capabilities</p>
            <h2 className="font-display mt-2 text-4xl font-semibold text-neutral">
              Four pieces that make the workspace feel cohesive instead of chaotic.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="rounded-[1.6rem] bg-base-100 p-6 shadow-sm">
                <div className="brand-orb h-12 w-12 rounded-2xl opacity-90" />
                <h3 className="font-display mt-5 text-2xl font-semibold text-neutral">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-7 text-base-content/70">{pillar.body}</p>
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
              © {currentYear} {appConfig.appName}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/contact" className="link link-hover text-base-content/75">
                Contact
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

