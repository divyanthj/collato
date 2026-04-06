import Image from "next/image";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import logo from "@/app/logo.png";
import appConfig from "@/config/app";
import { AccessGateway } from "@/components/access-gateway";
import { AuthEntryPanel } from "@/components/auth-entry-panel";
import { InviteInbox } from "@/components/invite-inbox";
import { OrganizationMemberManager } from "@/components/organization-member-manager";
import { getWorkspaceDashboardData } from "@/lib/data";
export default async function WorkspacePage() {
    const session = await auth();
    const { organization, workspaces, permissions, accessGate, pendingWorkspaceInvites } = await getWorkspaceDashboardData(session?.user?.email, session?.user?.name);
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
            note: workspaces.length ? "Shared follow-through across workspaces" : "No tasks logged yet"
        }
    ];
    if (session?.user?.email && !organization && accessGate) {
        return (<main className="min-h-screen px-4 py-6 lg:px-6">
      <section className="mx-auto max-w-7xl">
        <AccessGateway displayName={session.user.name ?? ""} suggestedOrganizationName={accessGate.suggestedOrganizationName} hasOwnedOrganization={accessGate.hasOwnedOrganization} pendingOrganizationInvites={accessGate.pendingOrganizationInvites} pendingWorkspaceInvites={accessGate.pendingWorkspaceInvites}/>
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
                await signIn("google", { redirectTo: "/dashboard" });
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
                {organization ? (<Link href="/dashboard/organization" className="btn btn-outline">
                    Organization settings
                  </Link>) : null}
                {permissions.canCreateWorkspaces ? (<Link href="/dashboard/new" className="btn btn-primary">
                    Create workspace
                  </Link>) : (<span className="btn btn-disabled">
                    Create workspace
                  </span>)}
              </div>
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
                <Link href="/dashboard/organization" className="btn btn-outline btn-sm">
                  Open full organization settings
                </Link>
              </div>
            </div>) : null}

          <div className="glass-panel rounded-[2rem] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Workspaces</div>
                <h2 className="mt-2 text-2xl font-semibold text-neutral">Current workspace layer</h2>
              </div>
              <div className="badge badge-outline self-start sm:self-center">{workspaces.length} total</div>
            </div>

            {pendingWorkspaceInvites.length > 0 ? <div className="mt-6"><InviteInbox invites={pendingWorkspaceInvites}/></div> : null}

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

