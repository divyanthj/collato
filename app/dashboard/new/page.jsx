import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CreateWorkspaceForm } from "@/components/create-workspace-form";
import { getWorkspaceDashboardData } from "@/lib/data";

function readSearchParam(value) {
    if (Array.isArray(value)) {
        return String(value[0] ?? "");
    }
    return typeof value === "string" ? value : "";
}

export default async function NewWorkspacePage({ searchParams }) {
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/dashboard");
    }
    const selectedOrganizationSlug = readSearchParam(searchParams?.org);
    const { organization, permissions } = await getWorkspaceDashboardData(session.user.email, session.user.name, selectedOrganizationSlug);
    if (!organization) {
        redirect("/dashboard");
    }
    const organizationQuery = `?org=${encodeURIComponent(organization.slug)}`;
    return (<main className="min-h-screen">
      <section className="mx-auto max-w-5xl px-6 pb-12 pt-8 lg:px-10">
        <div className="glass-panel rounded-[2.1rem] p-8 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-kicker">New workspace</p>
              <h1 className="mt-2 text-4xl font-semibold text-neutral">Create a workspace</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-base-content/72">
                Set up a new workspace first, then go into it to add members, files, updates, and chatbot queries in separate focused screens.
              </p>
            </div>
            <Link href={`/dashboard${organizationQuery}`} className="btn btn-outline">
              Back to workspaces
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <CreateWorkspaceForm
            isAuthenticated={Boolean(session.user.email)}
            canCreateWorkspaces={permissions.canCreateWorkspaces}
            ownerName={session.user.name ?? ""}
            ownerEmail={session.user.email}
            organizationName={organization?.name ?? "Organization"}
            organizationSlug={organization.slug}
            organizationRole={permissions.organizationRole}
          />
        </div>
      </section>
    </main>);
}

