"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
export function WorkspaceMemberManager({ workspace, canManageMembers }) {
    const router = useRouter();
    const [memberEmail, setMemberEmail] = useState("");
    const [error, setError] = useState(null);
    const [isSaving, startSaving] = useTransition();
    const handleAddMember = () => {
        setError(null);
        startSaving(async () => {
            try {
                const response = await fetch("/api/dashboard-members", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: workspace.slug,
                        memberEmail
                    })
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not add member");
                }
                setMemberEmail("");
                router.refresh();
            }
            catch (addError) {
                setError(addError instanceof Error ? addError.message : "Could not add member");
            }
        });
    };
    const handleRemoveMember = (memberEmailToRemove) => {
        setError(null);
        startSaving(async () => {
            try {
                const response = await fetch("/api/dashboard-members", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: workspace.slug,
                        memberEmail: memberEmailToRemove
                    })
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not remove member");
                }
                router.refresh();
            }
            catch (removeError) {
                setError(removeError instanceof Error ? removeError.message : "Could not remove member");
            }
        });
    };
    return (<div className="rounded-[1.5rem] bg-base-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral">Manage workspace members</div>
          <p className="mt-2 text-sm leading-6 text-base-content/65">
            Only members from the parent organization can be added here. Workspace owners and org admins can manage the working team.
          </p>
        </div>
        <div className={`badge ${canManageMembers ? "badge-success" : "badge-warning"}`}>{canManageMembers ? "Access enabled" : "Access limited"}</div>
      </div>

      <div className="mt-4 space-y-3">
        {workspace.members.map((member) => (<div key={member.email} className="rounded-[1.25rem] border border-base-300 bg-base-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-semibold text-neutral">{member.email}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-outline">{member.role}</span>
                <span className="badge badge-outline">{member.status}</span>
                {member.role !== "owner" ? (<button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => handleRemoveMember(member.email)} disabled={!canManageMembers || isSaving}>
                    Remove
                  </button>) : null}
              </div>
            </div>
          </div>))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input className="input input-bordered flex-1" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} disabled={!canManageMembers} placeholder="member@example.com"/>
        <button type="button" className="btn btn-primary" onClick={handleAddMember} disabled={!canManageMembers || isSaving || !memberEmail.trim()}>
          {isSaving ? "Adding..." : "Add member"}
        </button>
      </div>

      {error ? (<div className="alert alert-error mt-4 text-sm">
          <span>{error}</span>
        </div>) : null}
    </div>);
}

