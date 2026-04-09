import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { WorkspaceTaskBoard } from "@/components/workspace-task-board";
import { WorkspaceSubnav } from "@/components/workspace-subnav";
import { resolveWorkspaceRouteForUser } from "@/lib/data";
export default async function WorkspaceTasksPage({ params }) {
    const session = await auth();
    if (!session?.user?.email) {
        notFound();
    }
    const resolution = await resolveWorkspaceRouteForUser(
        params.slug,
        session.user.email,
        session.user.name ?? "Signed in user"
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
        redirect(`/dashboard/${encodeURIComponent(resolution.canonicalSlug)}/tasks`);
    }
    const data = resolution.data;
    const { workspace, updates, tasks } = data;
    const suggestedTasks = updates.flatMap((update) => update.structured.actionItems.map((action, index) => ({
        id: `${update.id}-${index}`,
        title: action,
        sourceUpdateId: update.id,
        createdByName: update.createdByName,
        createdAt: update.createdAt,
        channel: update.channel
    })));
    return (<main className="min-h-screen">
      <section className="mx-auto max-w-7xl px-6 pb-10 pt-8 lg:px-10">
        <div className="glass-panel rounded-[2.1rem] p-8 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-kicker">Tasks</p>
              <h1 className="mt-2 text-4xl font-semibold text-neutral">{workspace.name}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-base-content/72">
                Keep a shared task queue for this workspace so field updates, knowledge, and next steps stay connected without living on the same screen.
              </p>
            </div>
          </div>
          <WorkspaceSubnav workspaceSlug={workspace.slug} activeTab="tasks"/>
        </div>

        <div className="mt-6">
          <WorkspaceTaskBoard workspace={workspace} initialTasks={tasks} suggestedTasks={suggestedTasks} currentUserName={session.user.name ?? "Signed in user"} currentUserEmail={session.user.email}/>
        </div>
      </section>
    </main>);
}

