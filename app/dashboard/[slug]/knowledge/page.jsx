import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { KnowledgeBaseManager } from "@/components/knowledge-base-manager";
import { WorkspaceSubnav } from "@/components/workspace-subnav";
import { resolveWorkspaceRouteForUser } from "@/lib/data";
import { getDisplayNameFromEmail } from "@/lib/user-display-name";
export default async function WorkspaceKnowledgePage({ params }) {
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
        redirect(`/dashboard/${encodeURIComponent(resolution.canonicalSlug)}/knowledge`);
    }
    const data = resolution.data;
    const { workspace, files, updates, tasks, knowledgeSummary, permissions } = data;
    const workspaceSummary = {
        ...workspace,
        fileCount: files.length,
        updateCount: updates.length,
        taskCount: tasks.length,
        latestActivity: updates[0]?.structured.summary
    };
    return (<main className="min-h-screen">
      <section className="mx-auto max-w-7xl px-6 pb-10 pt-8 lg:px-10">
        <div className="glass-panel rounded-[2.1rem] p-8 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Knowledge</p>
                <h1 className="mt-2 text-4xl font-semibold text-neutral">{workspace.name}</h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-base-content/72">
                  Save reusable references here: documents, notes, transcripts, and key facts your team will come back to. For chronological progress logs, use Updates.
                </p>
                <div className="mt-4 rounded-[1.25rem] border border-base-300 bg-base-100/85 px-4 py-3 text-sm leading-6 text-base-content/70">
                  <span className="font-medium text-neutral">Use this when:</span> you are adding long-lived source material the team may need to search, summarize, or reuse later.
                </div>
              </div>
          </div>
          <WorkspaceSubnav workspaceSlug={workspace.slug} activeTab="knowledge"/>
        </div>

        <div className="mt-6">
          <KnowledgeBaseManager
            workspaces={[workspaceSummary]}
            initialFiles={files}
            knowledgeSummary={knowledgeSummary}
            isAuthenticated={Boolean(session.user.email)}
            canManageAiPrivacy={permissions.organizationRole === "owner"}
          />
        </div>
      </section>
    </main>);
}

