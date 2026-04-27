import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import appConfig from "@/config/app";

const DASHBOARD_CALLBACK_URL = "/dashboard?authSuccess=1";
const SIGN_IN_URL = `/sign-in?callbackUrl=${encodeURIComponent(DASHBOARD_CALLBACK_URL)}`;

const PRIMARY_NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" }
];

const SECONDARY_NAV_LINKS = [
  { label: "Help", href: "/help" },
  { label: "Contact", href: "/contact" }
];

export async function SiteNav() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 max-w-full overflow-hidden border-b border-white/70 bg-base-100/78 px-3 py-3 shadow-[0_14px_44px_rgba(17,53,84,0.08)] backdrop-blur-2xl sm:px-4 lg:px-8">
      <nav className="mx-auto flex max-w-[1500px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" aria-label="Primary navigation">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm transition group-hover:-translate-y-0.5 sm:h-11 sm:w-11">
            <Image
              src="/collato-logo.jpg"
              alt={`${appConfig.appName} logo`}
              width={80}
              height={80}
              className="h-8 w-8 object-contain sm:h-10 sm:w-10"
              priority
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-semibold leading-none text-neutral sm:text-xl">
              {appConfig.appName}
            </span>
            <span className="hidden text-xs uppercase tracking-[0.2em] text-primary/60 sm:block">
              Project memory hub
            </span>
          </span>
        </Link>

        {!session?.user ? (
          <div className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:pb-0 lg:justify-center">
            {PRIMARY_NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full px-3 py-2 text-xs font-medium text-base-content/72 transition hover:bg-white/80 hover:text-neutral sm:text-sm"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={SIGN_IN_URL}
              className="shrink-0 rounded-full px-3 py-2 text-xs font-medium text-base-content/72 transition hover:bg-white/80 hover:text-neutral sm:text-sm"
            >
              Dashboard
            </Link>
            {SECONDARY_NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full px-3 py-2 text-xs font-medium text-base-content/72 transition hover:bg-white/80 hover:text-neutral sm:text-sm"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {session?.user ? (
            <>
              <span className="hidden max-w-[220px] truncate rounded-full bg-white/70 px-3 py-2 text-sm text-base-content/65 xl:block">
                {session.user.name || session.user.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="btn btn-outline btn-sm">Sign out</button>
              </form>
            </>
          ) : (
            <Link href={SIGN_IN_URL} className="btn btn-primary btn-sm">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
