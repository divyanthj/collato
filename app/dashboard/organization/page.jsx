import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OrganizationMemberManager } from "@/components/organization-member-manager";
import { getWorkspaceDashboardData } from "@/lib/data";
export default async function OrganizationSettingsPage() {
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/dashboard");
    }
    const { organization, workspaces, permissions } = await getWorkspaceDashboardData(session.user.email, session.user.name);
    if (!organization) {
        redirect("/dashboard");
    }
    const totalFiles = workspaces.reduce((count, workspace) => count + workspace.fileCount, 0);
    const totalUpdates = workspaces.reduce((count, workspace) => count + workspace.updateCount, 0);
    const totalTasks = workspaces.reduce((count, workspace) => count + workspace.taskCount, 0);
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
              <Link href="/dashboard" className="btn btn-outline">
                Back to organization hub
              </Link>
              {permissions.canCreateWorkspaces ? (<Link href="/dashboard/new" className="btn btn-primary">
                  Create workspace
                </Link>) : (<span className="btn btn-disabled">
                  Create workspace
                </span>)}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Owner</div>
              <div className="mt-3 break-words text-lg font-semibold leading-tight text-neutral">{organization.ownerName}</div>
              <div className="mt-1 break-all text-sm text-base-content/60">{organization.ownerEmail}</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Members</div>
              <div className="mt-3 text-3xl font-semibold text-neutral">{organization.members.length}</div>
              <div className="mt-1 text-sm text-base-content/60">Can participate in org workspaces</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Workspaces</div>
              <div className="mt-3 text-3xl font-semibold text-neutral">{organization.workspaceCount}</div>
              <div className="mt-1 text-sm text-base-content/60">Total workspace containers in this org</div>
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
            <div className="glass-panel rounded-[2rem] p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="section-kicker">Membership</p>
                  <h2 className="mt-2 text-3xl font-semibold text-neutral">Organization member directory</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-base-content/68">
                    The organization owner controls who belongs here. Members added at the org level can then be placed into one or more workspaces.
                  </p>
                </div>
                <div className={`badge self-start ${permissions.canManageOrganizationMembers ? "badge-success" : "badge-warning"}`}>
                  {permissions.canManageOrganizationMembers ? "Member access" : "View access"}
                </div>
              </div>

              <div className="mt-6">
                <OrganizationMemberManager organization={organization} canManageMembers={permissions.canManageOrganizationMembers} organizationRole={permissions.organizationRole}/>
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
          </div>

          <div className="space-y-6">
            <div className="glass-panel rounded-[2rem] p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="section-kicker">Workspace overview</p>
                  <h2 className="mt-2 text-3xl font-semibold text-neutral">All workspace containers</h2>
                </div>
                <div className="badge badge-outline self-start">{workspaces.length} visible</div>
              </div>

              <div className="mt-6 space-y-4">
                {workspaces.length > 0 ? (workspaces.map((workspace) => (<div key={workspace.slug} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link href={`/dashboard/${workspace.slug}`} className="text-lg font-semibold text-neutral transition hover:text-primary">
                            {workspace.name}
                          </Link>
                          <p className="mt-2 text-sm leading-6 text-base-content/70">{workspace.description}</p>
                        </div>
                        <div className="badge badge-outline">{workspace.members.length} members</div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3 text-sm text-base-content/60">
                        <span>{workspace.fileCount} files</span>
                        <span>{workspace.updateCount} updates</span>
                        <span>{workspace.taskCount} tasks</span>
                        <span>Owner: {workspace.ownerName}</span>
                      </div>
                    </div>))) : (<div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-10 text-center text-sm leading-7 text-base-content/60">
                    No workspaces yet. Create the first workspace to start building the org structure.
                  </div>)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>);
}

