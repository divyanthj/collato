import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import logo from "@/app/logo.png";
import appConfig from "@/config/app";
import { AccessGateway } from "@/components/access-gateway";
import { AuthEntryPanel } from "@/components/auth-entry-panel";
import { CreateOrganizationButton } from "@/components/create-organization-button";
import { InviteInbox } from "@/components/invite-inbox";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { OrganizationMemberManager } from "@/components/organization-member-manager";
import { AlertBanner } from "@/components/alert-banner";
import { assertUserCanCreateOrganization } from "@/lib/billing";
import { createOrganization, getWorkspaceDashboardData } from "@/lib/data";

function readSearchParam(value) {
    if (Array.isArray(value)) {
        return String(value[0] ?? "");
    }
    return typeof value === "string" ? value : "";
}

export default async function WorkspacePage({ searchParams }) {
    const session = await auth();
    const postCheckoutCreateOrg = readSearchParam(searchParams?.postCheckoutCreateOrg) === "1";
    const postCheckoutOrgName = readSearchParam(searchParams?.postCheckoutOrgName);
    let postCheckoutError = "";
    if (session?.user?.email && postCheckoutCreateOrg) {
        try {
            await assertUserCanCreateOrganization(session.user.email);
            const organization = await createOrganization({
                name: postCheckoutOrgName || `${session.user.name?.trim() || "My"} Organization`,
                ownerName: session.user.name ?? "Organization owner",
                ownerEmail: session.user.email
            });
            redirect(`/dashboard?org=${encodeURIComponent(organization.slug)}&orgCreated=1`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "";
            if (message === "You already own an organization") {
                redirect("/dashboard");
            }
            postCheckoutError = message || "We could not finish organization creation after checkout. Please try again.";
        }
    }
    const selectedOrganizationSlug = readSearchParam(searchParams?.org);
    const orgCreated = readSearchParam(searchParams?.orgCreated) === "1";
    const inviteAccepted = readSearchParam(searchParams?.inviteAccepted) === "1";
    const blockedWorkspaceSlug = readSearchParam(searchParams?.workspace);
    const blockedWorkspaceName = readSearchParam(searchParams?.workspaceName);
    const blockedWorkspaceReason = readSearchParam(searchParams?.workspaceReason);
    const { organization, organizations, workspaces, permissions, accessGate, pendingOrganizationInvites, pendingWorkspaceInvites, fallbackFromGatedOrg } = await getWorkspaceDashboardData(session?.user?.email, session?.user?.name, selectedOrganizationSlug);
    const organizationQuery = organization?.slug ? `?org=${encodeURIComponent(organization.slug)}` : "";
    const workspaceBlockedMessage = blockedWorkspaceSlug
        ? blockedWorkspaceReason === "subscription_required"
            ? `${blockedWorkspaceName || blockedWorkspaceSlug} cannot be opened yet because this organization needs an active subscription.`
            : blockedWorkspaceReason === "workspace_access_denied"
                ? `${blockedWorkspaceName || blockedWorkspaceSlug} cannot be opened from this account.`
                : `${blockedWorkspaceName || blockedWorkspaceSlug} is not available right now.`
        : "";
    const stats = [
        { label: "Organization", value: organization?.name ?? "None yet", note: organization ? `${organization.members.length} members in the parent org` : "Sign in to create an organization" },
        { label: "Visible workspaces", value: String(workspaces.length), note: workspaces.length ? "Workspaces you can currently access" : "No workspaces yet" },
        {
            label: "Org members",
            value: String(organization?.members.length ?? 0),
            note: organization ? "People who can participate in org workspaces" : "No member graph yet"
        },
        {
            label: "Knowledge files",
            value: String(workspaces.reduce((count, workspace) => count + workspace.fileCount, 0)),
            note: workspaces.length ? "Files stored across your workspaces" : "No files captured yet"
        },
        {
            label: "Updates",
            value: String(workspaces.reduce((count, workspace) => count + workspace.updateCount, 0)),
            note: workspaces.length ? "Field and team updates captured" : "No updates captured yet"
        },
        {
            label: "Tasks",
            value: String(workspaces.reduce((count, workspace) => count + workspace.taskCount, 0)),
            note: workspaces.length ? "Shared next steps across workspaces" : "No tasks logged yet"
        }
    ];
    if (session?.user?.email && accessGate && !organization) {
        return (<main className="min-h-screen px-4 py-6 lg:px-6">
      <section className="mx-auto max-w-7xl">
        <AccessGateway
          displayName={session.user.name ?? ""}
          suggestedOrganizationName={accessGate.suggestedOrganizationName}
          hasOwnedOrganization={accessGate.hasOwnedOrganization}
          accessibleOrganizations={accessGate.accessibleOrganizations ?? []}
          pendingOrganizationInvites={accessGate.pendingOrganizationInvites}
          pendingWorkspaceInvites={accessGate.pendingWorkspaceInvites}
          requiresCheckout={Boolean(accessGate.requiresCheckout)}
          billingStatus={accessGate.billingStatus ?? null}
        />
      </section>
    </main>);
    }
    return (<main className="min-h-screen px-4 py-4 lg:px-6">
      <div className="mx-auto grid max-w-[1500px] gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="glass-panel rounded-[2rem] p-5 xl:sticky xl:top-4 xl:self-start">
          <div className="brand-card p-3">
            <Image
              src={logo}
              alt="Collato.io logo"
              width={420}
              height={220}
              className="h-auto w-full"
            />
            <div className="mt-3 text-xs uppercase tracking-[0.22em] text-base-content/55">
              {appConfig.brand.tagline}
            </div>
          </div>

          <div className="mt-8 rounded-[1.5rem] bg-base-100 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Account</div>
            {session?.user ? (<div className="mt-3 space-y-3">
                <div>
                  <div className="font-semibold text-neutral">{session.user.name ?? "Signed in user"}</div>
                  <div className="text-sm text-base-content/60">{session.user.email}</div>
                </div>
                <form action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
            }}>
                  <button className="btn btn-outline btn-sm w-full">Sign out</button>
                </form>
              </div>) : (<div className="mt-3 space-y-3">
                <form action={async () => {
                "use server";
                await signIn("google", {
                    redirectTo: "/dashboard",
                    prompt: "select_account"
                });
            }}>
                  <button className="btn btn-primary btn-sm w-full">Continue with Google</button>
                </form>
                <AuthEntryPanel mode="compact"/>
              </div>)}
          </div>

          <div className="mt-8 rounded-[1.5rem] bg-neutral p-4 text-neutral-content">
            <div className="text-xs uppercase tracking-[0.24em] text-secondary">Organization</div>
            <p className="mt-3 text-sm leading-7 text-neutral-content/78">
              The organization is now the top level. Members can create workspaces inside it, and the org owner can keep sight of everything happening across the workspace layer.
            </p>
          </div>

          <Link href="/" className="mt-8 btn btn-outline btn-sm w-full">
            Back to site
          </Link>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="glass-panel rounded-[2rem] p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Organization hub</div>
                <h1 className="mt-2 max-w-4xl text-3xl font-semibold leading-tight text-neutral lg:text-4xl">{organization?.name ?? "Your organization"}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-base-content/70">
                  This screen shows the organization-level view first. The organization owns the workspaces, while each workspace remains its own focused operating context.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3 lg:justify-end">
                {organization ? (<Link href={`/dashboard/organization${organizationQuery}`} className="btn btn-outline">
                    Organization settings
                  </Link>) : null}
                {permissions.canCreateWorkspaces ? (<Link href={`/dashboard/new${organizationQuery}`} className="btn btn-primary">
                    Create workspace
                  </Link>) : (<span className="btn btn-disabled">
                    Create workspace
                  </span>)}
                {organization && accessGate && !accessGate.hasOwnedOrganization ? (<CreateOrganizationButton suggestedOrganizationName={accessGate.suggestedOrganizationName} returnTo={`/dashboard?org=${encodeURIComponent(organization.slug)}`} currentUserEmail={session.user.email ?? ""}/>) : null}
              </div>
            </div>

            {orgCreated ? <AlertBanner tone="success" className="mt-5">Your organization is ready. You are now viewing it as owner.</AlertBanner> : null}
            {inviteAccepted ? <AlertBanner tone="success" className="mt-3">Invitation accepted. You now have access.</AlertBanner> : null}
            {postCheckoutError ? <AlertBanner tone="error" className="mt-3">{postCheckoutError}</AlertBanner> : null}
            {fallbackFromGatedOrg ? (<AlertBanner tone="success" className="mt-3">
                {`"${fallbackFromGatedOrg.fromName}" currently requires subscription. Switched to "${fallbackFromGatedOrg.toName}".`}
              </AlertBanner>) : null}
            {workspaceBlockedMessage ? <AlertBanner tone="error" className="mt-3">{workspaceBlockedMessage}</AlertBanner> : null}

            <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
              <OrganizationSwitcher organizations={organizations} selectedOrganizationSlug={organization?.slug ?? ""}/>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-6">
              {stats.map((stat, index) => (<div key={stat.label} className={`rounded-[1.5rem] bg-base-100 p-5 ${index === 0 ? "sm:col-span-2 2xl:col-span-2" : ""}`}>
                  <div className="text-xs uppercase tracking-[0.22em] text-primary/60">{stat.label}</div>
                  <div className={`mt-3 font-semibold leading-tight text-neutral ${index === 0 ? "text-2xl lg:text-3xl" : "text-3xl"}`}>
                    <span className="block max-w-full break-words">{stat.value}</span>
                  </div>
                  <div className="mt-2 text-sm text-base-content/60">{stat.note}</div>
                </div>))}
            </div>
          </div>

          {organization ? (<div className="glass-panel rounded-[2rem] p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Organization members</div>
                  <h2 className="mt-2 text-2xl font-semibold text-neutral">Who can create and join workspaces</h2>
                </div>
                <div className="badge badge-outline self-start sm:self-center">{organization.workspaceCount} workspaces in org</div>
              </div>

              <div className="mt-6">
                <OrganizationMemberManager organization={organization} canManageMembers={permissions.canManageOrganizationMembers} organizationRole={permissions.organizationRole}/>
              </div>

              <div className="mt-6 flex justify-end">
                <Link href={`/dashboard/organization${organizationQuery}`} className="btn btn-outline btn-sm">
                  Open full organization settings
                </Link>
              </div>
            </div>) : null}

          <div className="glass-panel rounded-[2rem] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Workspaces</div>
                <h2 className="mt-2 text-2xl font-semibold text-neutral">Your workspaces</h2>
              </div>
              <div className="badge badge-outline self-start sm:self-center">{workspaces.length} total</div>
            </div>

            {(pendingOrganizationInvites.length > 0 || pendingWorkspaceInvites.length > 0) ? (
              <div className="mt-6">
                <InviteInbox
                  organizationInvites={pendingOrganizationInvites}
                  workspaceInvites={pendingWorkspaceInvites}
                  title="Invitation inbox"
                  description="Accept or decline pending organization and workspace invites in one place."
                />
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {workspaces.length > 0 ? (workspaces.map((workspace) => (<div key={workspace.slug} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                      {accessGate?.requiresCheckout ? (<span className="text-lg font-semibold text-neutral/70">
                          {workspace.name}
                        </span>) : (<Link href={`/dashboard/${workspace.slug}`} className="text-lg font-semibold text-neutral transition hover:text-primary">
                          {workspace.name}
                        </Link>)}
                        <p className="mt-2 text-sm leading-6 text-base-content/70">{workspace.description}</p>
                      </div>
                      <div className="badge badge-outline">{workspace.members.length} members</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-base-content/60">
                      <span>{workspace.organizationName}</span>
                      <span>{workspace.fileCount} files</span>
                      <span>{workspace.updateCount} updates</span>
                      <span>{workspace.taskCount} tasks</span>
                      <span>Owner: {workspace.ownerName}</span>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-base-content/75">
                      {workspace.latestActivity ?? "No activity yet. Open the workspace to start adding knowledge or updates."}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      {accessGate?.requiresCheckout ? (<>
                          <span className="btn btn-disabled btn-sm">Open hub</span>
                          <span className="btn btn-disabled btn-sm">Knowledge</span>
                          <span className="btn btn-disabled btn-sm">Updates</span>
                          <span className="btn btn-disabled btn-sm">Ask workspace</span>
                          <span className="btn btn-disabled btn-sm">Tasks</span>
                        </>) : (<>
                          <Link href={`/dashboard/${workspace.slug}`} className="btn btn-primary btn-sm">
                            Open hub
                          </Link>
                          <Link href={`/dashboard/${workspace.slug}/knowledge`} className="btn btn-outline btn-sm">
                            Knowledge
                          </Link>
                          <Link href={`/dashboard/${workspace.slug}/updates`} className="btn btn-outline btn-sm">
                            Updates
                          </Link>
                          <Link href={`/dashboard/${workspace.slug}/chat`} className="btn btn-outline btn-sm">
                            Ask workspace
                          </Link>
                          <Link href={`/dashboard/${workspace.slug}/tasks`} className="btn btn-outline btn-sm">
                            Tasks
                          </Link>
                        </>)}
                    </div>
                  </div>))) : (<div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-10 text-center text-sm leading-7 text-base-content/60">
                  No workspaces yet. Create the first workspace to begin collecting files and updates.
                </div>)}
            </div>
          </div>
        </section>
      </div>
    </main>);
}

