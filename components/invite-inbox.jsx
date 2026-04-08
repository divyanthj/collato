"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readResponsePayload } from "@/lib/client-api";

export function InviteInbox({ invites }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  const handleAcceptInvite = (workspaceSlug) => {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/onboarding/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "workspace-smart", workspaceSlug })
        });

        const result = await readResponsePayload(response);
        if (!response.ok) {
          throw new Error(result.error ?? "Could not accept workspace invite");
        }

        router.refresh();
      } catch (inviteError) {
        setError(inviteError instanceof Error ? inviteError.message : "Could not accept workspace invite");
      }
    });
  };

  return (
    <div className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral">Workspace invite inbox</div>
          <p className="mt-1 text-sm text-base-content/65">Accept a workspace invite in one click. If your org invite is still pending, it is activated automatically first.</p>
        </div>
        <div className="badge badge-outline">{invites.length}</div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {invites.map((invite) => (
          <div key={invite.slug} className="rounded-[1.25rem] bg-base-100 p-4">
            <div className="font-semibold text-neutral">{invite.name}</div>
            <div className="mt-1 text-sm text-base-content/60">{invite.organizationName}</div>
            <button type="button" className="btn btn-outline btn-sm mt-4" onClick={() => handleAcceptInvite(invite.slug)} disabled={isPending}>
              Accept workspace invite
            </button>
          </div>
        ))}
      </div>

      {error ? <div className="alert alert-error mt-4 text-sm"><span>{error}</span></div> : null}
    </div>
  );
}
