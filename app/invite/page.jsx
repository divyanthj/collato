import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AlertBanner } from "@/components/alert-banner";
import { InviteAcceptLanding } from "@/components/invite-accept-landing";
import { acceptOrganizationInvite, acceptWorkspaceInviteSmart } from "@/lib/data";

function readSearchParam(value) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }

  return typeof value === "string" ? value : "";
}

export default async function InvitePage({ searchParams }) {
  const session = await auth();
  const type = readSearchParam(searchParams?.type);
  const organizationSlug = readSearchParam(searchParams?.organizationSlug);
  const workspaceSlug = readSearchParam(searchParams?.workspaceSlug);
  const organizationName = readSearchParam(searchParams?.organizationName);
  const name = readSearchParam(searchParams?.name);
  const role = readSearchParam(searchParams?.role);

  if (session?.user?.email) {
    try {
      if (type === "organization" && organizationSlug) {
        await acceptOrganizationInvite({
          organizationSlug,
          userEmail: session.user.email,
        });
        redirect(`/dashboard?org=${encodeURIComponent(organizationSlug)}&inviteAccepted=1`);
      }

      if (type === "workspace" && workspaceSlug) {
        await acceptWorkspaceInviteSmart({
          workspaceSlug,
          userEmail: session.user.email,
        });
        redirect(`/dashboard/${encodeURIComponent(workspaceSlug)}?inviteAccepted=1`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not accept invitation";

      return (
        <main className="min-h-screen px-4 py-8 lg:px-6">
          <section className="mx-auto max-w-3xl">
            <div className="glass-panel rounded-[2.25rem] p-8 lg:p-10">
              <p className="section-kicker">Invitation</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-neutral">We couldn&apos;t accept this invitation</h1>
              <AlertBanner tone="error" className="mt-6">{message}</AlertBanner>
            </div>
          </section>
        </main>
      );
    }
  }

  return (
    <InviteAcceptLanding
      searchParams={new URLSearchParams({
        type,
        organizationSlug,
        workspaceSlug,
        organizationName,
        name,
        role,
      })}
    />
  );
}
