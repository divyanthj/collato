import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import appConfig from "@/config/app";
import { AuthEntryPanel } from "@/components/auth-entry-panel";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

function readSearchParam(value) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }
  return typeof value === "string" ? value : "";
}

function getSafeCallbackUrl(value) {
  const fallback = "/dashboard?authSuccess=1";
  const callbackUrl = readSearchParam(value);

  if (!callbackUrl) {
    return fallback;
  }

  if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }

  try {
    const parsedUrl = new URL(callbackUrl);
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || fallback;
  } catch {
    return fallback;
  }
}

export default async function SignInPage({ searchParams }) {
  const session = await auth();
  const callbackUrl = getSafeCallbackUrl(searchParams?.callbackUrl);

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <main className="min-h-screen px-4 py-10 lg:px-8">
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="glass-panel rounded-[2rem] p-6">
          <div className="brand-card overflow-hidden p-5">
            <Image
              src="/collato-logo.jpg"
              alt={`${appConfig.appName} logo`}
              width={520}
              height={280}
              priority
              className="h-auto w-full rounded-[1.4rem] object-contain"
            />
          </div>
          <p className="section-kicker mt-6">Welcome back</p>
          <h1 className="font-display mt-2 text-4xl font-semibold leading-tight text-neutral">
            Sign in to open your project memory hub.
          </h1>
          <p className="mt-4 text-sm leading-7 text-base-content/70">
            Use the same email address your workspace invite was sent to, or continue with Google if that is how your account was created.
          </p>
        </div>

        <div className="glass-panel rounded-[2rem] p-6">
          <div className="rounded-[1.6rem] border border-base-300 bg-base-100 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Sign in</div>
            <h2 className="mt-2 text-2xl font-semibold text-neutral">Choose your sign-in method</h2>
            <p className="mt-2 text-sm leading-7 text-base-content/70">
              Email magic link works for non-Google accounts. Google sign-in is available if your account uses Google.
            </p>

            <div className="mt-6 space-y-4">
              <AuthEntryPanel mode="compact" redirectTo={callbackUrl} />

              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-base-content/45">
                <span className="h-px flex-1 bg-base-300" />
                Or
                <span className="h-px flex-1 bg-base-300" />
              </div>

              <GoogleSignInButton
                className="btn btn-primary w-full"
                label="Continue with Google"
                callbackUrl={callbackUrl}
                analyticsSource="custom_sign_in"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-base-content/65">
            <Link href="/" className="link link-hover">
              Back to home
            </Link>
            <Link href="/contact" className="link link-hover">
              Need help?
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
