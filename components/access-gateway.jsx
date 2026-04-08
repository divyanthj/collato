"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { readResponsePayload } from "@/lib/client-api";

export function AccessGateway({
  displayName,
  suggestedOrganizationName,
  hasOwnedOrganization,
  pendingOrganizationInvites,
  pendingWorkspaceInvites,
  requiresCheckout = false,
  billingStatus = null
}) {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState(suggestedOrganizationName);
  const [interval, setInterval] = useState("month");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isPending, startTransition] = useTransition();

  const normalizedQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0 ? Number(quantity) : 1;

  const handleCreateOrganization = () => {
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/onboarding/create-organization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: organizationName })
        });

        const result = await readResponsePayload(response);
        if (!response.ok) {
          throw new Error(result.error ?? "Could not create organization");
        }

        setSuccessMessage(`You now have access to ${result.name}.`);
        router.refresh();
      } catch (gatewayError) {
        setError(gatewayError instanceof Error ? gatewayError.message : "Could not create organization");
      }
    });
  };

  const handleStartSubscription = () => {
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interval,
            quantity: normalizedQuantity,
            mode: "new_subscription"
          })
        });

        const result = await readResponsePayload(response);
        if (!response.ok || !result.url) {
          throw new Error(result.error ?? "Could not start subscription");
        }

        window.location.href = result.url;
      } catch (checkoutError) {
        setError(checkoutError instanceof Error ? checkoutError.message : "Could not start subscription");
      }
    });
  };

  const handleAcceptInvite = (payload) => {
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/onboarding/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const result = await readResponsePayload(response);
        if (!response.ok) {
          throw new Error(result.error ?? "Could not accept invite");
        }

        setSuccessMessage(result.message ?? "Invite accepted.");
        router.refresh();
      } catch (inviteError) {
        setError(inviteError instanceof Error ? inviteError.message : "Could not accept invite");
      }
    });
  };

  return (
    <div className="glass-panel rounded-[2.5rem] p-8 lg:p-10">
      <div>
        <p className="section-kicker">Access gateway</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-neutral lg:text-5xl">
          Welcome{displayName ? `, ${displayName}` : ""}. Choose how you want to enter Collato.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-base-content/72">
          To access workspaces, create your own organization or join one through an invite.
        </p>
        <div className="mt-5">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => signOut({ callbackUrl: "/" })}
            disabled={isPending}
          >
            Sign out and switch account
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
        <div>
          <div id="access-gateway-billing" className="rounded-[2rem] border border-primary/15 bg-base-100 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Option 1</div>
                <h2 className="mt-2 text-2xl font-semibold text-neutral">
                  {requiresCheckout ? "Start subscription" : "Create your own organization"}
                </h2>
              </div>
              <div className="badge badge-primary badge-outline">
                {billingStatus?.ownerOverrideApplied ? `Owner free access: ${billingStatus.quantity} seats` : "Direct access"}
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-base-content/70">
              {requiresCheckout
                ? "Choose billing and seats first. After payment, return here to create your organization."
                : "Start your own organization and begin setting up workspaces for your team."}
            </p>

            {requiresCheckout ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="form-control">
                  <div className="label min-h-10 py-1">
                    <span className="label-text">Billing interval</span>
                  </div>
                  <select className="select select-bordered h-12" value={interval} onChange={(event) => setInterval(event.target.value)} disabled={isPending}>
                    <option value="month">Monthly</option>
                    <option value="year">Annual</option>
                  </select>
                </label>
                <label className="form-control">
                  <div className="label min-h-10 py-1">
                    <span className="label-text">Members to invite</span>
                  </div>
                  <input className="input input-bordered h-12" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={isPending}/>
                </label>
                <button
                  type="button"
                  className="btn btn-primary md:col-span-2"
                  onClick={handleStartSubscription}
                  disabled={isPending || normalizedQuantity < 1}
                >
                  {isPending ? "Redirecting..." : "Start subscription"}
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                className="input input-bordered"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                disabled={isPending || hasOwnedOrganization}
                placeholder="My Organization"
              />
              <button
                type="button"
                className="btn btn-primary md:min-w-[220px]"
                onClick={handleCreateOrganization}
                disabled={isPending || hasOwnedOrganization || !organizationName.trim()}
              >
                {hasOwnedOrganization ? "Organization already created" : isPending ? "Creating..." : "Create organization"}
              </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2rem] bg-neutral p-6 text-neutral-content">
            <div className="text-xs uppercase tracking-[0.24em] text-secondary">Option 2</div>
            <h2 className="mt-2 text-2xl font-semibold">Wait for an invite</h2>
            <p className="mt-3 text-sm leading-7 text-neutral-content/78">
              Workspace access still follows org-level and workspace-level permissions, but accepting a workspace invite will activate both when possible.
            </p>
          </div>

          <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-neutral">Organization invites</div>
              <div className="badge badge-outline">{pendingOrganizationInvites.length}</div>
            </div>

            <div className="mt-4 space-y-3">
              {pendingOrganizationInvites.length > 0 ? pendingOrganizationInvites.map((invite) => (
                <div key={invite.slug} className="rounded-[1.25rem] border border-base-300 p-4">
                  <div className="font-semibold text-neutral">{invite.name}</div>
                  <div className="mt-1 text-sm text-base-content/60">Invited by {invite.ownerName} as {invite.role}</div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm mt-4"
                    onClick={() => handleAcceptInvite({ type: "organization", organizationSlug: invite.slug })}
                    disabled={isPending}
                  >
                    Accept organization invite
                  </button>
                </div>
              )) : <div className="text-sm text-base-content/60">No pending organization invites yet.</div>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-neutral">Workspace invites</div>
              <div className="badge badge-outline">{pendingWorkspaceInvites.length}</div>
            </div>

            <div className="mt-4 space-y-3">
              {pendingWorkspaceInvites.length > 0 ? pendingWorkspaceInvites.map((invite) => (
                <div key={invite.slug} className="rounded-[1.25rem] border border-base-300 p-4">
                  <div className="font-semibold text-neutral">{invite.name}</div>
                  <div className="mt-1 text-sm text-base-content/60">{invite.organizationName}</div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm mt-4"
                    onClick={() => handleAcceptInvite({ type: "workspace-smart", workspaceSlug: invite.slug })}
                    disabled={isPending}
                  >
                    Accept workspace invite
                  </button>
                </div>
              )) : <div className="text-sm text-base-content/60">No pending workspace invites yet.</div>}
            </div>
          </div>
        </div>
      </div>

      {successMessage ? <div className="alert alert-success mt-6 text-sm"><span>{successMessage}</span></div> : null}
      {error ? <div className="alert alert-error mt-4 text-sm"><span>{error}</span></div> : null}
    </div>
  );
}
