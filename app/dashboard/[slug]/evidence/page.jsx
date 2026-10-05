import { EvidenceFeed } from "@/components/evidence-feed";
import { WorkspaceSubnav } from "@/components/workspace-subnav";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";


import { resolveWorkspaceRouteForUser } from "@/lib/data";
import { getDisplayNameFromEmail } from "@/lib/user-display-name";
export default async function WorkspaceUpdatesPage({ params }) {
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
        redirect(`/dashboard/${encodeURIComponent(resolution.canonicalSlug)}/evidence`);
    }
    const { workspace, files, updates, permissions } = resolution.data;
    return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8"><header className="glass-panel rounded-3xl p-6"><p className="section-kicker">Evidence</p><h1 className="mt-2 text-3xl font-semibold">{workspace.name}</h1><p className="mt-3 text-sm text-base-content/70">Notes, conversations, screenshots and files become one shared project memory.</p><WorkspaceSubnav workspaceSlug={workspace.slug} activeTab="evidence" /></header><EvidenceFeed workspace={workspace} files={files} updates={updates} currentUserEmail={session.user.email} canReview={permissions.canManageWorkspaceMembers} canManageAiPrivacy={permissions.organizationRole === "owner"} /></main>;
}
