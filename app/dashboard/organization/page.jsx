import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CreateOrganizationButton } from "@/components/create-organization-button";
import { OrganizationBillingManager } from "@/components/organization-billing-manager";
import { OrganizationMemberManager } from "@/components/organization-member-manager";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { getBillingStatusForOrganization } from "@/lib/billing";
import { getWorkspaceDashboardData } from "@/lib/data";

function readSearchParam(value) {
    if (Array.isArray(value)) {
        return String(value[0] ?? "");
    }
    return typeof value === "string" ? value : "";
}

export default async function OrganizationSettingsPage({ searchParams }) {
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/dashboard");
    }
    const selectedOrganizationSlug = readSearchParam(searchParams?.org);
    const { organization, organizations, workspaces, permissions, accessGate, fallbackFromGatedOrg } = await getWorkspaceDashboardData(session.user.email, session.user.name, selectedOrganizationSlug);
    if (!organization) {
        redirect("/dashboard");
    }
    const isOwner = permissions.organizationRole === "owner";
    const billingStatus = isOwner ? await getBillingStatusForOrganization(organization) : null;
    const totalFiles = workspaces.reduce((count, workspace) => count + workspace.fileCount, 0);
    const totalUpdates = workspaces.reduce((count, workspace) => count + workspace.updateCount, 0);
    const totalTasks = workspaces.reduce((count, workspace) => count + workspace.taskCount, 0);
    const organizationQuery = `?org=${encodeURIComponent(organization.slug)}`;
    return (<main className="min-h-screen">
      <section className="mx-auto max-w-7xl px-6 pb-8 pt-8 lg:px-10">
        <div className="glass-panel rounded-[2.1rem] p-8 shadow-soft">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="section-kicker">Organization settings</p>
              <h1 className="mt-2 max-w-4xl text-4xl font-semibold leading-tight text-neutral lg:text-5xl">{organization.name}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-base-content/72">
                This is the parent layer above all workspaces. Manage who belongs to the organization, who can create workspaces, and keep a high-level view of activity across the org.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3 lg:justify-end">
              <Link href={`/dashboard${organizationQuery}`} className="btn btn-outline">
                Back to organization hub
              </Link>
              {permissions.canCreateWorkspaces ? (<Link href={`/dashboard/new${organizationQuery}`} className="btn btn-primary">
                  Create workspace
                </Link>) : (<span className="btn btn-disabled">
                  Create workspace
                </span>)}
              {accessGate && !accessGate.hasOwnedOrganization ? (<CreateOrganizationButton suggestedOrganizationName={accessGate.suggestedOrganizationName} returnTo={`/dashboard/organization?org=${encodeURIComponent(organization.slug)}`} currentUserEmail={session.user.email ?? ""}/>) : null}
            </div>
          </div>

          {fallbackFromGatedOrg ? (<div className="mt-4">
              <div className="alert items-start rounded-2xl text-sm shadow-sm border border-success/40 bg-success/10 text-success">
                <div className="min-w-0 flex-1 leading-6">
                  {`"${fallbackFromGatedOrg.fromName}" currently requires subscription. Switched to "${fallbackFromGatedOrg.toName}".`}
                </div>
              </div>
            </div>) : null}

          <div className="mt-5">
            <OrganizationSwitcher organizations={organizations} selectedOrganizationSlug={organization.slug}/>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Owner</div>
              <div className="mt-3 break-words text-lg font-semibold leading-tight text-neutral">{organization.ownerName}</div>
              <div className="mt-1 break-all text-sm text-base-content/60">{organization.ownerEmail}</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Members</div>
              <div className="mt-3 text-3xl font-semibold text-neutral">{organization.memberCount ?? organization.currentMembers?.length ?? organization.members.length}</div>
              <div className="mt-1 text-sm text-base-content/60">Can participate in org workspaces</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Workspaces</div>
              <div className="mt-3 text-3xl font-semibold text-neutral">{organization.workspaceCount}</div>
              <div className="mt-1 text-sm text-base-content/60">Total workspaces in this org</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Files</div>
              <div className="mt-3 text-3xl font-semibold text-neutral">{totalFiles}</div>
              <div className="mt-1 text-sm text-base-content/60">Knowledge items visible to you</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Updates / Tasks</div>
              <div className="mt-3 text-3xl font-semibold text-neutral">
                {totalUpdates} / {totalTasks}
              </div>
              <div className="mt-1 text-sm text-base-content/60">Live coordination signals across workspaces</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10 lg:px-10">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            {isOwner ? (<>
                <div className="glass-panel rounded-[2rem] p-7">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="section-kicker">Membership</p>
                      <h2 className="mt-2 text-3xl font-semibold text-neutral">Organization member directory</h2>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-base-content/68">
                        The organization owner controls who belongs here. Members added at the org level can then be placed into one or more workspaces.
                      </p>
                    </div>
                    <div className="badge self-start badge-success">Owner access</div>
                  </div>

                  <div className="mt-6">
                    <OrganizationMemberManager organization={organization} canManageMembers={permissions.canManageOrganizationMembers} organizationRole={permissions.organizationRole}/>
                  </div>
                </div>

                <div className="glass-panel rounded-[2rem] p-7">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="section-kicker">Billing</p>
                      <h2 className="mt-2 text-3xl font-semibold text-neutral">Plan and seat management</h2>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-base-content/68">
                        Billing is organization-wide. Manage interval, seats, upgrades, downgrades, and migration here.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <OrganizationBillingManager organizationSlug={organization.slug} initialBillingStatus={billingStatus}/>
                  </div>
                </div>

                <div className="glass-panel rounded-[2rem] p-7">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="section-kicker">Rules</p>
                      <h2 className="mt-2 text-3xl font-semibold text-neutral">Current access model</h2>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-[1.5rem] bg-base-100 p-5">
                      <div className="text-sm font-semibold text-neutral">Organization owner</div>
                      <p className="mt-3 text-sm leading-7 text-base-content/68">
                        Sees all workspaces in the organization and manages org membership.
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] bg-base-100 p-5">
                      <div className="text-sm font-semibold text-neutral">Workspace manager</div>
                      <p className="mt-3 text-sm leading-7 text-base-content/68">
                        Can create workspaces and invite other members, but only sees workspaces they are explicitly added to.
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] bg-base-100 p-5">
                      <div className="text-sm font-semibold text-neutral">Standard member</div>
                      <p className="mt-3 text-sm leading-7 text-base-content/68">
                        Can operate inside assigned workspaces, but cannot create new workspaces or invite organization members.
                      </p>
                    </div>
                  </div>
                </div>
              </>) : null}
          </div>

          <div className="space-y-6">
            <div className="glass-panel rounded-[2rem] p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="section-kicker">Workspace overview</p>
                  <h2 className="mt-2 text-3xl font-semibold text-neutral">Your workspaces</h2>
                </div>
                <div className="badge badge-outline self-start">{workspaces.length} visible</div>
              </div>

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
                        <div className="badge badge-outline">{workspace.memberCount ?? workspace.currentMembers?.length ?? workspace.members.length} members</div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3 text-sm text-base-content/60">
                        <span>{workspace.fileCount} files</span>
                        <span>{workspace.updateCount} updates</span>
                        <span>{workspace.taskCount} tasks</span>
                        <span>Owner: {workspace.ownerName}</span>
                      </div>
                    </div>))) : (<div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-10 text-center text-sm leading-7 text-base-content/60">
                    No workspaces yet. Create your first workspace to get started.
                  </div>)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>);
}

