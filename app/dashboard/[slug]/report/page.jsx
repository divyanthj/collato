import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { WorkspaceProgressReportView } from "@/components/workspace-progress-report";
import { getWorkspaceDetailData } from "@/lib/data";
import { reportTemplateDefinitions } from "@/lib/report-templates";
export default async function WorkspaceReportPage({ params }) {
    const session = await auth();
    if (!session?.user?.email) {
        notFound();
    }
    const data = await getWorkspaceDetailData(params.slug, session.user.email);
    if (!data) {
        notFound();
    }
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
              <p className="section-kicker">Progress report</p>
              <h1 className="mt-2 text-4xl font-semibold text-neutral">{workspace.name}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-base-content/72">
                Generate a clean progress summary from the workspace knowledge, captured updates, and tracked follow-through.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/dashboard/${workspace.slug}`} className="btn btn-outline">
                Back to hub
              </Link>
              <Link href={`/dashboard/${workspace.slug}/chat`} className="btn btn-outline">
                Ask workspace
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <WorkspaceProgressReportView workspace={workspaceSummary} isAuthenticated={Boolean(session.user.email)} templates={reportTemplateDefinitions.map((template) => ({
            id: template.id,
            name: template.name,
            description: template.description
        }))}/>
        </div>
      </section>
    </main>);
}

