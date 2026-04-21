import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { WorkspaceProgressReportView } from "@/components/workspace-progress-report";
import { WorkspaceSubnav } from "@/components/workspace-subnav";
import { resolveWorkspaceRouteForUser } from "@/lib/data";
import { reportTemplateDefinitions } from "@/lib/report-templates";
import { getDisplayNameFromEmail } from "@/lib/user-display-name";
export default async function WorkspaceReportPage({ params }) {
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
        redirect(`/dashboard/${encodeURIComponent(resolution.canonicalSlug)}/report`);
    }
    const data = resolution.data;
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
                Generate a clean progress summary from the workspace knowledge, captured updates, and tracked tasks.
              </p>
            </div>
          </div>
          <WorkspaceSubnav workspaceSlug={workspace.slug} activeTab="report"/>
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

