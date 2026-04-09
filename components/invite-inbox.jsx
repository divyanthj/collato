"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertBanner } from "@/components/alert-banner";
import { readResponsePayload } from "@/lib/client-api";

export function InviteInbox({
  organizationInvites = [],
  workspaceInvites = [],
  title = "Invitations",
  description = "Accept or decline organization and workspace invites in one place.",
  className = ""
}) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [pendingKey, setPendingKey] = useState("");
  const [isPending, startTransition] = useTransition();
  const totalInvites = organizationInvites.length + workspaceInvites.length;
  const hasInvites = totalInvites > 0;
  const sections = useMemo(() => ([
    {
      key: "organization",
      heading: "Organization invites",
      emptyMessage: "No pending organization invites.",
      items: organizationInvites
    },
    {
      key: "workspace",
      heading: "Workspace invites",
      emptyMessage: "No pending workspace invites.",
      items: workspaceInvites
    }
  ]), [organizationInvites, workspaceInvites]);

  const handleInviteAction = (type, payload, actionLabel) => {
    setError(null);
    setSuccessMessage(null);
    const itemKey = `${type}:${payload.organizationSlug ?? payload.workspaceSlug}:${actionLabel}`;
    setPendingKey(itemKey);

    startTransition(async () => {
      try {
        const endpoint = actionLabel === "accept" ? "/api/onboarding/accept-invite" : "/api/onboarding/reject-invite";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, ...payload })
        });

        const result = await readResponsePayload(response);
        if (!response.ok) {
          throw new Error(result.error ?? `Could not ${actionLabel} invite`);
        }

        setSuccessMessage(result.message ?? (actionLabel === "accept" ? "Invite accepted." : "Invite declined."));
        router.refresh();
      } catch (inviteError) {
        setError(inviteError instanceof Error ? inviteError.message : `Could not ${actionLabel} invite`);
      } finally {
        setPendingKey("");
      }
    });
  };

  return (
    <div id="invitations" className={`rounded-[1.5rem] border border-primary/20 bg-primary/5 p-4 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral">{title}</div>
          <p className="mt-1 text-sm text-base-content/65">{description}</p>
        </div>
        <div className="badge badge-outline">{totalInvites}</div>
      </div>

      {hasInvites ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {sections.map((section) => (
            <div key={section.key} className="rounded-[1.25rem] bg-base-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-neutral">{section.heading}</div>
                <div className="badge badge-outline">{section.items.length}</div>
              </div>

              <div className="mt-4 space-y-3">
                {section.items.length > 0 ? section.items.map((invite) => {
                  const inviteKey = section.key === "organization"
                    ? invite.slug
                    : `${invite.organizationSlug}:${invite.slug}`;
                  const acceptPayload = section.key === "organization"
                    ? { organizationSlug: invite.slug }
                    : { workspaceSlug: invite.slug };
                  const acceptType = section.key === "organization" ? "organization" : "workspace-smart";
                  const rejectType = section.key === "organization" ? "organization" : "workspace";
                  const acceptPending = isPending && pendingKey === `${acceptType}:${invite.slug}:accept`;
                  const rejectPending = isPending && pendingKey === `${rejectType}:${invite.slug}:reject`;

                  return (
                    <div key={inviteKey} className="rounded-[1.25rem] border border-base-300 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-neutral">{invite.name}</div>
                          <div className="mt-1 text-sm text-base-content/60">
                            {section.key === "organization"
                              ? `Invited by ${invite.ownerName} as ${invite.role}`
                              : `${invite.organizationName} | Invited by ${invite.ownerName} as ${invite.role}`}
                          </div>
                        </div>
                        <div className="badge badge-outline">{invite.status ?? "invited"}</div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleInviteAction(acceptType, acceptPayload, "accept")}
                          disabled={isPending}
                        >
                          {acceptPending ? "Accepting..." : "Accept"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-error"
                          onClick={() => handleInviteAction(rejectType, acceptPayload, "reject")}
                          disabled={isPending}
                        >
                          {rejectPending ? "Declining..." : "Decline"}
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-sm text-base-content/60">{section.emptyMessage}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[1.25rem] bg-base-100 p-4 text-sm text-base-content/60">
          No pending invites right now.
        </div>
      )}

      {successMessage ? <AlertBanner tone="success" className="mt-4">{successMessage}</AlertBanner> : null}
      {error ? <AlertBanner tone="error" className="mt-4">{error}</AlertBanner> : null}
    </div>
  );
}
