import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { WorkspaceChat } from "@/components/workspace-chat";
import { WorkspaceSubnav } from "@/components/workspace-subnav";
import { getWorkspaceChatHistory, getWorkspaceDetailData } from "@/lib/data";
export default async function WorkspaceChatPage({ params }) {
    const session = await auth();
    if (!session?.user?.email) {
        notFound();
    }
    const data = await getWorkspaceDetailData(params.slug, session.user.email);
    if (!data) {
        notFound();
    }
    const initialMessages = await getWorkspaceChatHistory(params.slug, session.user.email);
    const { workspace, files, updates, tasks } = data;
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
              <p className="section-kicker">Ask workspace</p>
              <h1 className="mt-2 text-4xl font-semibold text-neutral">{workspace.name}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-base-content/72">
                Query the knowledge base separately when you want answers grounded in the workspace files and update history.
              </p>
            </div>
          </div>
          <WorkspaceSubnav workspaceSlug={workspace.slug} activeTab="chat"/>
        </div>

        <div className="mt-6">
          <WorkspaceChat workspaces={[workspaceSummary]} initialMessages={initialMessages} isAuthenticated={Boolean(session.user.email)}/>
        </div>
      </section>
    </main>);
}

