"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertBanner } from "@/components/alert-banner";
import { readResponsePayload } from "@/lib/client-api";
import { trackDatafastGoal } from "@/lib/client-analytics";
export function CreateWorkspaceForm({
    isAuthenticated,
    canCreateWorkspaces,
    ownerName,
    ownerEmail,
    organizationName,
    organizationSlug,
    organizationRole
}) {
    const router = useRouter();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [memberEmails, setMemberEmails] = useState("");
    const [error, setError] = useState(null);
    const [isSaving, startSaving] = useTransition();

    const handleCreate = () => {
        setError(null);
        trackDatafastGoal("workspace_create_started", {
            organization_slug: organizationSlug,
            has_description: description.trim() ? "yes" : "no",
            has_invites: memberEmails.trim() ? "yes" : "no"
        });
        startSaving(async () => {
            try {
                const response = await fetch("/api/workspaces", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name,
                        description,
                        organizationSlug,
                        memberEmails: memberEmails
                            .split(/[\n,]/)
                            .map((value) => value.trim())
                            .filter(Boolean)
                    })
                });
                const result = await readResponsePayload(response);
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not create workspace");
                }
                setName("");
                setDescription("");
                setMemberEmails("");
                trackDatafastGoal("workspace_created", {
                    workspace_slug: result?.slug ?? "",
                    organization_slug: organizationSlug
                });
                if (result?.slug) {
                    router.push(`/dashboard/${result.slug}?created=1&fromOnboarding=1`);
                    return;
                }
                router.refresh();
            }
            catch (createError) {
                setError(createError instanceof Error ? createError.message : "Could not create workspace");
            }
        });
    };
    return (<div className="glass-panel rounded-[2rem] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Step 3 of 4</div>
          <h2 className="mt-2 text-2xl font-semibold text-neutral">Create your first workspace</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-base-content/68">
            Keep this first step light. Name the workspace, optionally add a short description, and continue into the guided setup flow.
          </p>
        </div>
        <div className={`badge badge-lg ${isAuthenticated && canCreateWorkspaces ? "badge-success" : "badge-warning"}`}>
          {isAuthenticated && canCreateWorkspaces ? "Available" : "Unavailable"}
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <label className="form-control">
          <div className="label">
            <span className="label-text">Workspace name</span>
          </div>
          <input className="input input-bordered" value={name} onChange={(event) => setName(event.target.value)} disabled={!isAuthenticated || !canCreateWorkspaces} placeholder="Example: Riverfront Campus Delivery"/>
        </label>

        <div className="rounded-[1.25rem] border border-base-300 bg-base-100 p-4 text-sm leading-7 text-base-content/68">
          Organization: <span className="font-medium text-neutral">{organizationName || "Organization"}</span>
          {" | "}
          Your role: <span className="font-medium text-neutral">{organizationRole || "No access"}</span>
        </div>

        <div className="collapse collapse-arrow rounded-[1.2rem] border border-base-300 bg-base-100">
          <input type="checkbox"/>
          <div className="collapse-title text-sm font-semibold text-neutral">
            Add a short description (optional)
          </div>
          <div className="collapse-content">
            <textarea className="textarea textarea-bordered h-28" value={description} onChange={(event) => setDescription(event.target.value)} disabled={!isAuthenticated || !canCreateWorkspaces} placeholder="Example: Delivery knowledge, field updates, and shared next steps for the Riverfront Campus workspace."/>
          </div>
        </div>

        <div className="collapse collapse-arrow rounded-[1.2rem] border border-base-300 bg-base-100">
          <input type="checkbox"/>
          <div className="collapse-title text-sm font-semibold text-neutral">
            Invite teammates now (optional)
          </div>
          <div className="collapse-content">
            <p className="mb-3 text-sm leading-6 text-base-content/65">
              You can skip this and invite people later. Only active organization members can be invited into the workspace team.
            </p>
            <textarea className="textarea textarea-bordered h-24" value={memberEmails} onChange={(event) => setMemberEmails(event.target.value)} disabled={!isAuthenticated || !canCreateWorkspaces} placeholder="Add emails separated by commas or new lines."/>
          </div>
        </div>
      </div>

      {error ? <AlertBanner tone="error" className="mt-4">{error}</AlertBanner> : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={!isAuthenticated || !canCreateWorkspaces || isSaving || !organizationSlug || !name.trim()}
        >
          {isSaving ? "Creating..." : "Create workspace and continue"}
        </button>
        <p className="text-sm leading-7 text-base-content/60">{canCreateWorkspaces ? `Signed in as ${ownerName || "workspace owner"} (${ownerEmail || "no email"}). Next you will add context and start the guided workspace flow.` : "Your current access does not include workspace creation."}</p>
      </div>
    </div>);
}


