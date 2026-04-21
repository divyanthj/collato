import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AlertBanner } from "@/components/alert-banner";
import { WorkspaceDangerZone } from "@/components/workspace-danger-zone";
import { WorkspaceMemberManager } from "@/components/workspace-member-manager";
import { resolveWorkspaceRouteForUser } from "@/lib/data";
import { getDisplayNameFromEmail } from "@/lib/user-display-name";
function readSearchParam(value) {
    if (Array.isArray(value)) {
        return String(value[0] ?? "");
    }
    return typeof value === "string" ? value : "";
}
export default async function WorkspaceDetailPage({ params, searchParams }) {
    const session = await auth();
    if (!session?.user?.email) {
        notFound();
    }
    const currentUserName = getDisplayNameFromEmail(session.user.email, "Signed in user", session.user.name);
    const resolution = await resolveWorkspaceRouteForUser(
        params.slug,
        session.user.email,
        currentUserName
    );
    if (resolution.type === "organization") {
        const workspaceQuery = resolution.workspaceSlug ? `&workspace=${encodeURIComponent(resolution.workspaceSlug)}` : "";
        const workspaceNameQuery = resolution.workspaceName ? `&workspaceName=${encodeURIComponent(resolution.workspaceName)}` : "";
        const reasonQuery = resolution.reason ? `&workspaceReason=${encodeURIComponent(resolution.reason)}` : "";
        redirect(`/dashboard?org=${encodeURIComponent(resolution.organizationSlug)}${workspaceQuery}${workspaceNameQuery}${reasonQuery}`);
    }
    if (resolution.type !== "workspace") {
        notFound();
    }
    if (resolution.canonicalSlug !== params.slug) {
        redirect(`/dashboard/${encodeURIComponent(resolution.canonicalSlug)}`);
    }
    const data = resolution.data;
    const { organization, workspace, files, updates, tasks, overview, permissions } = data;
    const inviteAccepted = readSearchParam(searchParams?.inviteAccepted) === "1";
    return (<main className="min-h-screen">
      <section className="mx-auto max-w-7xl px-6 pb-8 pt-8 lg:px-10">
        <div className="glass-panel rounded-[2.1rem] p-8 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-kicker">Workspace hub</p>
              <h1 className="mt-2 text-4xl font-semibold text-neutral lg:text-5xl">{workspace.name}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-base-content/72">{workspace.description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="btn btn-outline">
                Back to workspaces
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Organization</div>
              <div className="mt-3 text-lg font-semibold text-neutral">{organization.name}</div>
              <div className="mt-1 text-sm text-base-content/60">Parent organization</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Owner</div>
              <div className="mt-3 text-lg font-semibold text-neutral">{workspace.ownerName}</div>
              <div className="mt-1 text-sm text-base-content/60">{workspace.ownerEmail}</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Members</div>
              <div className="mt-3 text-lg font-semibold text-neutral">{workspace.memberCount ?? workspace.currentMembers?.length ?? workspace.members.length}</div>
              <div className="mt-1 text-sm text-base-content/60">Owner plus invited teammates</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Knowledge files</div>
              <div className="mt-3 text-lg font-semibold text-neutral">{files.length}</div>
              <div className="mt-1 text-sm text-base-content/60">Indexed files and notes</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Updates</div>
              <div className="mt-3 text-lg font-semibold text-neutral">{updates.length}</div>
              <div className="mt-1 text-sm text-base-content/60">Captured member activity</div>
            </div>
            <div className="rounded-3xl bg-base-100 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Tasks</div>
              <div className="mt-3 text-lg font-semibold text-neutral">{tasks.length}</div>
              <div className="mt-1 text-sm text-base-content/60">Open and completed tasks</div>
            </div>
          </div>
          {inviteAccepted ? <AlertBanner tone="success" className="mt-6">Invitation accepted. You now have access to this workspace.</AlertBanner> : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <div className="glass-panel rounded-[2rem] p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Workspace actions</p>
                  <h2 className="mt-2 text-3xl font-semibold text-neutral">Go to a focused view</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-base-content/68">
                    Each workspace function lives on its own screen. Use this hub to decide whether you want to manage source material, capture what the team is seeing, ask questions, or turn suggested next steps into tracked work.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <Link href={`/dashboard/${workspace.slug}/knowledge`} className="group rounded-[1.9rem] border border-base-300 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,237,225,0.88))] p-6 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Knowledge</div>
                      <div className="mt-3 text-2xl font-semibold text-neutral">Source material and indexed context</div>
                    </div>
                    <span className="rounded-full border border-primary/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-primary/70">
                      {files.length} files
                    </span>
                  </div>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-base-content/72">
                    Add files, notes, and extracted project context so the workspace has a durable source of truth before the team starts asking questions about it.
                  </p>
                  <div className="mt-6 text-sm font-medium text-primary transition group-hover:translate-x-1">Open knowledge view</div>
                </Link>

                <div className="grid gap-4">
                  <Link href={`/dashboard/${workspace.slug}/updates`} className="group rounded-[1.75rem] border border-base-300 bg-base-100 p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-base-200/50">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-primary/60">Updates</div>
                        <div className="mt-2 text-xl font-semibold text-neutral">Capture what the team is seeing</div>
                      </div>
                      <span className="badge badge-outline">{updates.length}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-base-content/70">
                      Record typed or voice updates, keep the verbatim record, and store the structured version alongside it.
                    </p>
                  </Link>

                  <Link href={`/dashboard/${workspace.slug}/chat`} className="group rounded-[1.75rem] border border-base-300 bg-base-100 p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-base-200/50">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-primary/60">Ask workspace</div>
                        <div className="mt-2 text-xl font-semibold text-neutral">Query the workspace like a chatbot</div>
                      </div>
                      <span className="badge badge-outline">AI</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-base-content/70">
                      Ask grounded questions across the uploaded knowledge, team updates, and active tasks without leaving the workspace.
                    </p>
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <Link href={`/dashboard/${workspace.slug}/tasks`} className="group rounded-[1.75rem] border border-base-300 bg-base-100 p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-base-200/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-primary/60">Tasks</div>
                      <div className="mt-2 text-xl font-semibold text-neutral">Track next steps in one place</div>
                    </div>
                    <span className="badge badge-outline">{tasks.length}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-base-content/70">
                    Convert action signals into a real shared queue with owners, due dates, and status changes.
                  </p>
                </Link>

                <Link href={`/dashboard/${workspace.slug}/report`} className="group rounded-[1.75rem] border border-base-300 bg-base-100 p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-base-200/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-primary/60">Progress report</div>
                      <div className="mt-2 text-xl font-semibold text-neutral">Generate a client-ready progress summary</div>
                    </div>
                    <span className="badge badge-outline">Report</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-base-content/70">
                    Turn the current knowledge, updates, and task signals into a compact progress summary you can review before sending.
                  </p>
                </Link>
              </div>

              <div className="mt-4 rounded-[1.75rem] border border-base-300 bg-base-100 p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-primary/60">Suggested flow</div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm leading-6 text-base-content/72">
                  <span className="rounded-full bg-base-200 px-4 py-2 font-medium text-neutral">1. Gather in Knowledge</span>
                  <span className="hidden text-base-content/35 md:inline">/</span>
                  <span className="rounded-full bg-base-200 px-4 py-2 font-medium text-neutral">2. Capture in Updates</span>
                  <span className="hidden text-base-content/35 md:inline">/</span>
                  <span className="rounded-full bg-base-200 px-4 py-2 font-medium text-neutral">3. Review in Chat</span>
                  <span className="hidden text-base-content/35 md:inline">/</span>
                  <span className="rounded-full bg-base-200 px-4 py-2 font-medium text-neutral">4. Review in Progress Report</span>
                </div>
                <p className="mt-4 text-sm leading-7 text-base-content/66">
                  Upload the source material first, collect what members are seeing on the ground, validate the picture in chat if needed, then generate a progress summary for review.
                </p>
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Members</p>
                  <h2 className="mt-2 text-3xl font-semibold text-neutral">Who is inside this workspace</h2>
                </div>
                <div className="badge badge-outline">{workspace.memberCount ?? workspace.currentMembers?.length ?? workspace.members.length} people</div>
              </div>

              <div className="mt-6 space-y-3">
                {(workspace.currentMembers ?? workspace.members).map((member) => (<div key={`${member.email}-${member.status}`} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-semibold text-neutral">{member.email}</div>
                      <div className="flex gap-2">
                        <span className="badge badge-outline">{member.role}</span>
                        <span className="badge badge-outline">{member.status}</span>
                      </div>
                    </div>
                  </div>))}
              </div>

              <div className="mt-6">
                <WorkspaceMemberManager workspace={workspace} canManageMembers={permissions.canManageWorkspaceMembers} organizationMembers={organization.currentMembers ?? organization.members ?? []}/>
              </div>
            </div>

            <WorkspaceDangerZone workspace={workspace} canDeleteWorkspace={permissions.canManageWorkspaceMembers}/>
          </div>

          <div className="space-y-6">
            <div className="glass-panel rounded-[2rem] p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Knowledge summary</p>
                  <h2 className="mt-2 text-3xl font-semibold text-neutral">Current workspace snapshot</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="rounded-[1.5rem] bg-base-100 p-5">
                  <div className="text-sm font-semibold text-neutral">Channels seen</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {overview.channels.length > 0 ? (overview.channels.map((channel) => (<span key={channel} className="badge badge-outline">
                          {channel}
                        </span>))) : (<span className="text-sm text-base-content/60">No update channels yet.</span>)}
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-base-100 p-5">
                  <div className="text-sm font-semibold text-neutral">Recent key points</div>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-base-content/75 marker:text-primary/70">
                    {overview.keyPoints.length > 0 ? overview.keyPoints.map((item) => <li key={item}>{item}</li>) : <li>No key points extracted yet.</li>}
                  </ul>
                </div>

                <div className="rounded-[1.5rem] bg-base-100 p-5">
                  <div className="text-sm font-semibold text-neutral">Suggested next steps</div>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-base-content/75 marker:text-primary/70">
                    {overview.actionItems.length > 0 ? overview.actionItems.map((item) => <li key={item}>{item}</li>) : <li>No suggested next steps yet.</li>}
                  </ul>
                </div>

                <div className="rounded-[1.5rem] bg-base-100 p-5">
                  <div className="text-sm font-semibold text-neutral">Open tasks</div>
                  <div className="mt-3 text-3xl font-semibold text-neutral">{overview.openTaskCount}</div>
                  <div className="mt-2 text-sm text-base-content/60">Tasks that still need attention.</div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Quick totals</p>
                  <h2 className="mt-2 text-3xl font-semibold text-neutral">At a glance</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.5rem] bg-base-100 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-primary/60">Files stored</div>
                  <div className="mt-3 text-3xl font-semibold text-neutral">{files.length}</div>
                </div>
                <div className="rounded-[1.5rem] bg-base-100 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-primary/60">Updates captured</div>
                  <div className="mt-3 text-3xl font-semibold text-neutral">{updates.length}</div>
                </div>
                <div className="rounded-[1.5rem] bg-base-100 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-primary/60">Tasks tracked</div>
                  <div className="mt-3 text-3xl font-semibold text-neutral">{tasks.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>);
}

