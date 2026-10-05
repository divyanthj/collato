import { ReportCadence } from "@/components/report-cadence";
import { getWorkspaceAttention } from "@/lib/evidence-utils";
import { WorkspaceSubnav } from "@/components/workspace-subnav";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";

import { WorkspaceDangerZone } from "@/components/workspace-danger-zone";
import { WorkspaceMemberManager } from "@/components/workspace-member-manager";
import { resolveWorkspaceRouteForUser } from "@/lib/data";
import { getDisplayNameFromEmail } from "@/lib/user-display-name";
export default async function WorkspaceDetailPage({ params }) {
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
    const { organization, workspace, files, updates, tasks, permissions } = resolution.data;
    const attention = getWorkspaceAttention({ files, updates, tasks });
    return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      <header className="glass-panel rounded-3xl p-6"><p className="section-kicker">Overview</p><h1 className="mt-2 text-3xl font-semibold">{workspace.name}</h1><p className="mt-3 text-sm text-base-content/70">{workspace.description}</p><WorkspaceSubnav workspaceSlug={workspace.slug} activeTab="hub" /></header>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="glass-panel rounded-3xl p-6"><h2 className="text-xl font-semibold">Bring back evidence</h2><p className="mt-3 text-sm leading-6">Share a note, voice update, screenshot or document. Collato keeps the source and helps the team find it again.</p><Link className="btn btn-primary mt-4" href={`/dashboard/${workspace.slug}/evidence#capture`}>Add evidence</Link><p className="mt-4 text-sm">{attention.recent.length} contributions in the last seven days · {attention.needsReview.length} interpretations awaiting review</p><Link className="link mt-2 inline-block text-sm" href={`/dashboard/${workspace.slug}/evidence`}>Review shared memory</Link></section>
        <section className="glass-panel rounded-3xl p-6"><h2 className="text-xl font-semibold">Next report</h2><p className="mt-3 text-sm leading-6">Choose a reporting period, draft from the available evidence, and review what is missing before sharing.</p><Link className="btn btn-outline mt-4" href={`/dashboard/${workspace.slug}/report`}>Prepare report</Link><ReportCadence workspaceSlug={workspace.slug} /></section>
        <section className="glass-panel rounded-3xl p-6"><h2 className="text-xl font-semibold">Needs attention</h2><p className="mt-3 text-sm">{attention.overdue.length} overdue tasks</p><ul className="mt-4 space-y-3">{attention.nextTasks.map(task => <li key={task.id} className="text-sm"><Link className="link" href={`/dashboard/${workspace.slug}/tasks`}>{task.title}</Link><p className="mt-1 text-xs text-base-content/60">{task.assigneeName || "Unassigned"} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}</p></li>)}</ul>{!attention.nextTasks.length && <p className="mt-3 text-sm text-base-content/60">No open tasks. Capture evidence to identify the next commitments.</p>}</section>
        <section className="glass-panel rounded-3xl p-6"><h2 className="text-xl font-semibold">Recent contributions</h2><ul className="mt-4 space-y-4">{attention.latest.map(item => <li key={`${item.kind}:${item.id}`}><Link className="link text-sm" href={`/dashboard/${workspace.slug}/evidence#${item.anchor}`}>{item.title}</Link><p className="mt-1 text-xs text-base-content/60">{item.contributor} · {new Date(item.createdAt).toLocaleDateString()}</p></li>)}</ul>{!attention.latest.length && <p className="mt-3 text-sm text-base-content/60">Start with one useful piece of evidence.</p>}</section>
      </div>
      <details className="glass-panel mt-6 rounded-3xl p-6"><summary className="cursor-pointer font-semibold">Team and workspace settings</summary><div className="mt-5"><WorkspaceMemberManager workspace={workspace} canManageMembers={permissions.canManageWorkspaceMembers} organizationMembers={organization.currentMembers ?? organization.members ?? []} /><WorkspaceDangerZone workspace={workspace} canDeleteWorkspace={permissions.canManageWorkspaceMembers} /></div></details>
    </main>;
}
