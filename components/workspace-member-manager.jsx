"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertBanner } from "@/components/alert-banner";
import { readResponsePayload } from "@/lib/client-api";
export function WorkspaceMemberManager({ workspace, canManageMembers, organizationMembers }) {
    const router = useRouter();
    const [selectedMemberEmail, setSelectedMemberEmail] = useState("");
    const [error, setError] = useState(null);
    const [isSaving, startSaving] = useTransition();
    const currentMembers = useMemo(() => workspace.currentMembers ?? workspace.members ?? [], [workspace.currentMembers, workspace.members]);
    const availableOrganizationMembers = useMemo(() => {
        const currentWorkspaceMemberEmails = new Set(currentMembers.map((member) => member.email));
        return (organizationMembers ?? [])
            .filter((member) => (member.status === "active" || member.status === "invited") && !currentWorkspaceMemberEmails.has(member.email))
            .sort((a, b) => {
            const first = (a.name || a.email).toLowerCase();
            const second = (b.name || b.email).toLowerCase();
            return first.localeCompare(second);
        });
    }, [organizationMembers, currentMembers]);
    useEffect(() => {
        if (availableOrganizationMembers.length === 0) {
            setSelectedMemberEmail("");
            return;
        }
        const nextSelectedEmail = availableOrganizationMembers.some((member) => member.email === selectedMemberEmail)
            ? selectedMemberEmail
            : availableOrganizationMembers[0].email;
        setSelectedMemberEmail(nextSelectedEmail);
    }, [availableOrganizationMembers, selectedMemberEmail]);
    const formatDate = (value) => value ? new Date(value).toLocaleDateString() : "Unknown";

    const handleAddMember = () => {
        setError(null);
        startSaving(async () => {
            try {
                const response = await fetch("/api/workspace-members", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: workspace.slug,
                        memberEmail: selectedMemberEmail
                    })
                });
                const result = await readResponsePayload(response);
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not add member");
                }
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
                const response = await fetch("/api/workspace-members", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: workspace.slug,
                        memberEmail: memberEmailToRemove
                    })
                });
                const result = await readResponsePayload(response);
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
            Pick members from the parent organization to add them into this workspace. Organization owners and workspace owners/admins can manage membership.
          </p>
        </div>
        <div className={`badge ${canManageMembers ? "badge-success" : "badge-warning"}`}>{canManageMembers ? "Access enabled" : "Access limited"}</div>
      </div>

      <div className="mt-4 space-y-3">
        {currentMembers.map((member) => (<div key={`${member.email}-${member.status}`} className="rounded-[1.25rem] border border-base-300 bg-base-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-neutral">{member.name || member.email}</div>
                {member.name ? <div className="text-xs text-base-content/60">{member.email}</div> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-outline">{member.role}</span>
                <span className="badge badge-outline">{member.status}</span>
                {member.role !== "owner" ? (<button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => handleRemoveMember(member.email)} disabled={!canManageMembers || isSaving}>
                    Remove
                  </button>) : null}
              </div>
            </div>
            <div className="mt-2 text-xs text-base-content/55">
              {member.joinedAt ? `Joined ${formatDate(member.joinedAt)}` : member.invitedAt ? `Invited ${formatDate(member.invitedAt)}` : "No membership timestamp yet"}
            </div>
          </div>))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <select className="select select-bordered flex-1 min-w-[220px]" value={selectedMemberEmail} onChange={(event) => setSelectedMemberEmail(event.target.value)} disabled={!canManageMembers || availableOrganizationMembers.length === 0}>
          {availableOrganizationMembers.length > 0 ? (availableOrganizationMembers.map((member) => (<option key={member.email} value={member.email}>
                {member.name ? `${member.name} (${member.email})` : member.email}
              </option>))) : (<option value="">No available organization members</option>)}
        </select>
        <button type="button" className="btn btn-primary" onClick={handleAddMember} disabled={!canManageMembers || isSaving || !selectedMemberEmail}>
          {isSaving ? "Adding..." : "Add member"}
        </button>
      </div>
      {availableOrganizationMembers.length === 0 ? (<p className="mt-3 text-xs text-base-content/55">
          All current organization members are already part of this workspace.
        </p>) : null}

      {error ? <AlertBanner tone="error" className="mt-4">{error}</AlertBanner> : null}
    </div>);
}

