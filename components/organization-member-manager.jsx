"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertBanner } from "@/components/alert-banner";
import { readResponsePayload } from "@/lib/client-api";
export function OrganizationMemberManager({ organization, canManageMembers, organizationRole }) {
    const router = useRouter();
    const [memberEmail, setMemberEmail] = useState("");
    const [memberRole, setMemberRole] = useState("member");
    const [error, setError] = useState(null);
    const [upgradePath, setUpgradePath] = useState(null);
    const [isSaving, startSaving] = useTransition();
    const activeMembers = organization.currentMembers ?? organization.members ?? [];
    const historicalMembers = organization.memberHistory ?? [];
    const formatDate = (value) => value ? new Date(value).toLocaleDateString() : "Unknown";
    const handleAddMember = () => {
        setError(null);
        setUpgradePath(null);
        startSaving(async () => {
            try {
                const response = await fetch("/api/organization-members", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        organizationSlug: organization.slug,
                        memberEmail,
                        role: memberRole
                    })
                });
                const result = await readResponsePayload(response);
                if (!response.ok) {
                    setUpgradePath(result.upgradePath ?? null);
                    throw new Error(result.error ?? "Could not add organization member");
                }
                setMemberEmail("");
                setMemberRole("member");
                router.refresh();
            }
            catch (addError) {
                setError(addError instanceof Error ? addError.message : "Could not add organization member");
            }
        });
    };
    const handleRemoveMember = (memberEmailToRemove) => {
        setError(null);
        setUpgradePath(null);
        startSaving(async () => {
            try {
                const response = await fetch("/api/organization-members", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        organizationSlug: organization.slug,
                        memberEmail: memberEmailToRemove
                    })
                });
                const result = await readResponsePayload(response);
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not remove organization member");
                }
                router.refresh();
            }
            catch (removeError) {
                setError(removeError instanceof Error ? removeError.message : "Could not remove organization member");
            }
        });
    };
    return (<div className="rounded-[1.5rem] bg-base-100 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-neutral">Organization members</div>
          <p className="mt-2 text-sm leading-6 text-base-content/65">
            Organization members can create workspaces under this org. Workspace access is still managed inside each workspace.
          </p>
        </div>
        <div className={`badge self-start ${canManageMembers ? "badge-success" : "badge-warning"}`}>{canManageMembers ? "Member access" : "View access"}</div>
      </div>

      <div className="mt-4 space-y-3">
        {activeMembers.map((member) => (<div key={`${member.email}-${member.status}`} className="rounded-[1.25rem] border border-base-300 bg-base-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 font-semibold text-neutral break-all">{member.email}</div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
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

      {organizationRole === "owner" && historicalMembers.length > 0 ? (<div className="mt-6 rounded-[1.25rem] border border-base-300 bg-base-50 p-4">
          <div className="text-sm font-semibold text-neutral">Removed member history</div>
          <div className="mt-3 space-y-3">
            {historicalMembers.map((member) => (<div key={`history-${member.email}`} className="rounded-[1rem] border border-base-300 bg-base-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-medium text-neutral break-all">{member.email}</div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-outline">{member.role}</span>
                    <span className="badge badge-outline">removed</span>
                  </div>
                </div>
                <div className="mt-2 text-xs leading-6 text-base-content/60">
                  {member.joinedAt ? `Joined ${formatDate(member.joinedAt)}. ` : ""}
                  {member.removedAt ? `Removed ${formatDate(member.removedAt)}.` : ""}
                  {member.removedByEmail ? ` Removed by ${member.removedByName || member.removedByEmail}.` : ""}
                </div>
              </div>))}
          </div>
        </div>) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_180px]">
        <input className="input input-bordered min-w-0 flex-1" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} disabled={!canManageMembers} placeholder="member@example.com"/>
        <select className="select select-bordered min-w-0" value={memberRole} onChange={(event) => setMemberRole(event.target.value)} disabled={!canManageMembers || organizationRole !== "owner"}>
          <option value="member">Standard member</option>
          <option value="admin">Workspace manager</option>
        </select>
        <button type="button" className="btn btn-primary xl:min-w-[164px]" onClick={handleAddMember} disabled={!canManageMembers || isSaving || !memberEmail.trim()}>
          {isSaving ? "Adding..." : "Add to organization"}
        </button>
      </div>

      {error ? (<AlertBanner tone="error" className="mt-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            {upgradePath ? (<a href={upgradePath} className="btn btn-sm btn-outline">
                Upgrade plan
              </a>) : null}
          </div>
        </AlertBanner>) : null}
    </div>);
}
