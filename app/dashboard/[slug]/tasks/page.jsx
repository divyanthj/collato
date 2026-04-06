import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { WorkspaceTaskBoard } from "@/components/workspace-task-board";
import { getWorkspaceDetailData } from "@/lib/data";
export default async function WorkspaceTasksPage({ params }) {
    const session = await auth();
    if (!session?.user?.email) {
        notFound();
    }
    const data = await getWorkspaceDetailData(params.slug, session.user.email);
    if (!data) {
        notFound();
    }
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
                Keep a shared action queue for this workspace so field updates, knowledge, and follow-through stay connected without living on the same screen.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/dashboard/${workspace.slug}`} className="btn btn-outline">
                Back to hub
              </Link>
              <Link href={`/dashboard/${workspace.slug}/updates`} className="btn btn-outline">
                Go to updates
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <WorkspaceTaskBoard workspace={workspace} initialTasks={tasks} suggestedTasks={suggestedTasks} currentUserName={session.user.name ?? "Signed in user"} currentUserEmail={session.user.email}/>
        </div>
      </section>
    </main>);
}

