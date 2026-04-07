"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readResponsePayload } from "@/lib/client-api";
export function CreateWorkspaceForm({ isAuthenticated, canCreateWorkspaces, ownerName, ownerEmail, organizationName, organizationRole }) {
    const router = useRouter();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [memberEmails, setMemberEmails] = useState("");
    const [error, setError] = useState(null);
    const [isSaving, startSaving] = useTransition();

    const handleCreate = () => {
        setError(null);
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
          <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Workspace setup</div>
          <h2 className="mt-2 text-2xl font-semibold text-neutral">Create a workspace</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-base-content/68">
            Create a workspace inside your organization. Only organization members can be invited into the workspace team.
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
          <input className="input input-bordered" value={name} onChange={(event) => setName(event.target.value)} disabled={!isAuthenticated || !canCreateWorkspaces}/>
        </label>

        <label className="form-control">
          <div className="label">
            <span className="label-text">What is this workspace about?</span>
          </div>
          <textarea className="textarea textarea-bordered h-28" value={description} onChange={(event) => setDescription(event.target.value)} disabled={!isAuthenticated || !canCreateWorkspaces} placeholder="Example: Delivery knowledge, field updates, and task follow-through for the Riverfront Campus workspace."/>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control">
            <div className="label">
              <span className="label-text">Organization</span>
            </div>
            <input className="input input-bordered" value={organizationName || "Organization"} disabled/>
          </label>

          <label className="form-control">
            <div className="label">
              <span className="label-text">Owner</span>
            </div>
            <input className="input input-bordered" value={ownerName || "Signed-in user"} disabled/>
          </label>

          <label className="form-control">
            <div className="label">
              <span className="label-text">Owner email</span>
            </div>
            <input className="input input-bordered" value={ownerEmail || "Sign in to continue"} disabled/>
          </label>

          <label className="form-control">
            <div className="label">
              <span className="label-text">Your access level</span>
            </div>
            <input className="input input-bordered" value={organizationRole || "No organization access"} disabled/>
          </label>
        </div>

        <label className="form-control">
          <div className="label">
            <span className="label-text">Members to invite</span>
          </div>
          <textarea className="textarea textarea-bordered h-24" value={memberEmails} onChange={(event) => setMemberEmails(event.target.value)} disabled={!isAuthenticated || !canCreateWorkspaces} placeholder="Add emails separated by commas or new lines."/>
        </label>
      </div>

      {error ? (<div className="alert alert-error mt-4 text-sm">
          <span>{error}</span>
        </div>) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={!isAuthenticated || !canCreateWorkspaces || isSaving || !name.trim() || !description.trim()}>
          {isSaving ? "Creating..." : "Create workspace"}
        </button>
        <p className="text-sm leading-7 text-base-content/60">{canCreateWorkspaces ? "Each workspace sits under the organization, with its own members, knowledge base, updates, and tasks." : "Your current access does not include workspace creation."}</p>
      </div>
    </div>);
}


