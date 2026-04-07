"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readResponsePayload } from "@/lib/client-api";
export function OrganizationMemberManager({ organization, canManageMembers, organizationRole }) {
    const router = useRouter();
    const [memberEmail, setMemberEmail] = useState("");
    const [memberRole, setMemberRole] = useState("member");
    const [error, setError] = useState(null);
    const [upgradePath, setUpgradePath] = useState(null);
    const [isSaving, startSaving] = useTransition();
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
                    body: JSON.stringify({ memberEmail, role: memberRole })
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
        {organization.members.map((member) => (<div key={member.email} className="rounded-[1.25rem] border border-base-300 bg-base-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 font-semibold text-neutral break-all">{member.email}</div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <span className="badge badge-outline">{member.role}</span>
                <span className="badge badge-outline">{member.status}</span>
              </div>
            </div>
          </div>))}
      </div>

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

      {error ? (<div className="alert alert-error mt-4 text-sm">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            {upgradePath ? (<a href={upgradePath} className="btn btn-sm btn-outline">
                Upgrade plan
              </a>) : null}
          </div>
        </div>) : null}
    </div>);
}
