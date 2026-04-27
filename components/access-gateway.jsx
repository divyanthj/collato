"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AlertBanner } from "@/components/alert-banner";
import { InviteInbox } from "@/components/invite-inbox";
import { readResponsePayload } from "@/lib/client-api";
import { trackDatafastGoal } from "@/lib/client-analytics";

export function AccessGateway({
  displayName,
  suggestedOrganizationName,
  hasOwnedOrganization,
  accessibleOrganizations = [],
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

  useEffect(() => {
    trackDatafastGoal("access_gateway_viewed", {
      requires_checkout: requiresCheckout ? "yes" : "no",
      has_invites: pendingOrganizationInvites.length + pendingWorkspaceInvites.length > 0 ? "yes" : "no"
    });
  }, [pendingOrganizationInvites.length, pendingWorkspaceInvites.length, requiresCheckout]);

  const handleCreateOrganization = () => {
    setError(null);
    setSuccessMessage(null);
    trackDatafastGoal("organization_created_started", {
      source: "access_gateway"
    });

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
        trackDatafastGoal("organization_created", {
          source: "access_gateway",
          organization_slug: result.slug || ""
        });
        if (result?.slug) {
          router.push(`/dashboard?org=${encodeURIComponent(result.slug)}&orgCreated=1`);
          return;
        }
        router.refresh();
      } catch (gatewayError) {
        setError(gatewayError instanceof Error ? gatewayError.message : "Could not create organization");
      }
    });
  };

  const handleStartSubscription = () => {
    setError(null);
    setSuccessMessage(null);
    trackDatafastGoal("checkout_started", {
      source: "access_gateway",
      interval,
      quantity: normalizedQuantity
    });

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

  return (
    <div className="glass-panel rounded-[2.5rem] p-8 lg:p-10">
      <div>
        <p className="section-kicker">Workspace setup</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-neutral lg:text-5xl">
          Welcome{displayName ? `, ${displayName}` : ""}. Let&apos;s get your first workspace ready.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-base-content/72">
          The organization structure stays in place, but the goal here is simple: unlock access, create your workspace, and start adding project context.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            "1. Account confirmed",
            requiresCheckout ? "2. Billing ready" : "2. Organization ready",
            "3. Workspace details",
            "4. Add context"
          ].map((step, index) => (
            <div
              key={step}
              className={`rounded-[1.25rem] border px-4 py-3 text-sm ${
                index < 2 ? "border-primary/25 bg-primary/8 text-neutral" : "border-base-300 bg-base-100 text-base-content/65"
              }`}
            >
              {step}
            </div>
          ))}
        </div>
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
          {accessibleOrganizations.length > 0 ? (
            <div className="mb-4 rounded-[1.5rem] border border-success/30 bg-success/10 p-4">
              <div className="text-sm font-semibold text-success">You still have access to invited organizations</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {accessibleOrganizations.map((organization) => (
                  <a key={organization.slug} href={`/dashboard?org=${encodeURIComponent(organization.slug)}`} className="btn btn-sm btn-outline">
                    {organization.name}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <div id="access-gateway-billing" className="rounded-[2rem] border border-primary/15 bg-base-100 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-primary/60">
                  {requiresCheckout ? "Step 2 of 4" : "Step 2 of 4"}
                </div>
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
                ? "Choose billing first so Collato can unlock organization access. Right after checkout, you come back here and continue into workspace setup."
                : "Create the organization that will hold your workspaces. We keep the structure in the background so you can move straight into setup next."}
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
                  {isPending ? "Redirecting..." : "Unlock workspace setup"}
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
                {hasOwnedOrganization ? "Organization already created" : isPending ? "Creating..." : "Create organization and continue"}
              </button>
              </div>
            )}

            <div className="mt-4 rounded-[1.25rem] bg-base-200/65 p-4 text-sm leading-6 text-base-content/68">
              {requiresCheckout
                ? "What unlocks next: organization creation, workspace setup, knowledge capture, updates, reports, and workspace chat."
                : "Next after this step: you will land in workspace creation with fewer required fields and one clear primary action."}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2rem] bg-neutral p-6 text-neutral-content">
            <div className="text-xs uppercase tracking-[0.24em] text-secondary">Alternative path</div>
            <h2 className="mt-2 text-2xl font-semibold">Wait for an invite</h2>
            <p className="mt-3 text-sm leading-7 text-neutral-content/78">
              If someone already invited you, accept it here and skip owner setup. You should reach a usable workspace without going through billing or org creation yourself.
            </p>
          </div>
          <InviteInbox
            organizationInvites={pendingOrganizationInvites}
            workspaceInvites={pendingWorkspaceInvites}
            title="Invitation inbox"
            description="Accept or decline pending organization and workspace invites without leaving the app."
            className="border-base-300 bg-base-100"
          />
        </div>
      </div>

      {successMessage ? <AlertBanner tone="success" className="mt-6">{successMessage}</AlertBanner> : null}
      {error ? <AlertBanner tone="error" className="mt-4">{error}</AlertBanner> : null}
    </div>
  );
}
