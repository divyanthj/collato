"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readResponsePayload } from "@/lib/client-api";

export function OrganizationBillingManager({ organizationSlug, initialBillingStatus }) {
  const router = useRouter();
  const [billingStatus, setBillingStatus] = useState(initialBillingStatus);
  const [interval, setInterval] = useState(initialBillingStatus?.planInterval || "month");
  const [quantity, setQuantity] = useState(initialBillingStatus?.quantity || Math.max(initialBillingStatus?.usedSeats || 1, 1));
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  const effectiveQuantity = useMemo(() => {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return Math.floor(parsed);
  }, [quantity]);

  const refreshStatus = async () => {
    const response = await fetch(`/api/billing/status?organizationSlug=${encodeURIComponent(organizationSlug)}`);
    const result = await readResponsePayload(response);
    if (response.ok) {
      setBillingStatus(result);
      return;
    }
    throw new Error(result.error ?? "Could not refresh billing status");
  };

  const redirectToCheckout = (url) => {
    if (url) {
      window.location.href = url;
    }
  };

  const handleManagePortal = () => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationSlug })
        });
        const result = await readResponsePayload(response);
        if (!response.ok || !result.url) {
          throw new Error(result.error ?? "Could not open billing portal");
        }
        window.location.href = result.url;
      } catch (portalError) {
        setError(portalError instanceof Error ? portalError.message : "Could not open billing portal");
      }
    });
  };

  const handleChangePlan = (mode = "switch_plan") => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/change-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationSlug,
            interval,
            quantity: effectiveQuantity,
            mode
          })
        });
        const result = await readResponsePayload(response);
        if (!response.ok) {
          throw new Error(result.error ?? "Could not change plan");
        }

        if (result.type === "checkout" && result.url) {
          redirectToCheckout(result.url);
          return;
        }

        await refreshStatus();
        router.refresh();
      } catch (changeError) {
        setError(changeError instanceof Error ? changeError.message : "Could not change plan");
      }
    });
  };

  const hasActiveBilling = Boolean(billingStatus?.active);

  return (
    <div id="billing" className="rounded-[1.5rem] bg-base-100 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral">Billing</div>
          <p className="mt-2 text-sm leading-6 text-base-content/65">
            Manage your organization plan, member seats, and billing access.
          </p>
        </div>
        <div className={`badge ${billingStatus?.migrationRequired ? "badge-warning" : hasActiveBilling ? "badge-success" : "badge-outline"}`}>
          {billingStatus?.migrationRequired ? "Migration required" : hasActiveBilling ? "Active" : "No active plan"}
        </div>
      </div>

      {billingStatus?.migrationRequired ? (
        <div className="alert alert-warning mt-4 text-sm">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span>Legacy subscription detected. Migrate now to continue adding members.</span>
            <button className="btn btn-sm btn-outline" onClick={() => handleChangePlan("migrate")} disabled={isPending}>
              {isPending ? "Processing..." : "Migrate now"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-base-300 bg-base-50 p-3">
          <div className="text-xs uppercase tracking-[0.16em] text-base-content/55">Purchased seats</div>
          <div className="mt-1 text-2xl font-semibold text-neutral">{billingStatus?.quantity ?? 0}</div>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-50 p-3">
          <div className="text-xs uppercase tracking-[0.16em] text-base-content/55">Used seats</div>
          <div className="mt-1 text-2xl font-semibold text-neutral">{billingStatus?.usedSeats ?? 0}</div>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-50 p-3">
          <div className="text-xs uppercase tracking-[0.16em] text-base-content/55">Remaining seats</div>
          <div className="mt-1 text-2xl font-semibold text-neutral">{billingStatus?.remainingSeats ?? 0}</div>
        </div>
      </div>

      {billingStatus?.scheduledChange ? (
        <div className="alert alert-info mt-4 text-sm">
          <span>
            Downgrade scheduled to {billingStatus.scheduledChange.quantity} seats on {billingStatus.scheduledChange.effectiveAt ? new Date(billingStatus.scheduledChange.effectiveAt).toLocaleDateString() : "renewal"}.
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="form-control">
          <div className="label py-1">
            <span className="label-text">Billing interval</span>
          </div>
          <select className="select select-bordered" value={interval} onChange={(event) => setInterval(event.target.value)} disabled={isPending || billingStatus?.migrationRequired}>
            <option value="month">Monthly</option>
            <option value="year">Annual</option>
          </select>
        </label>
        <label className="form-control">
          <div className="label py-1">
            <span className="label-text">Member seats</span>
          </div>
          <input className="input input-bordered" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={isPending || billingStatus?.migrationRequired}/>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={() => handleChangePlan("switch_plan")} disabled={isPending || billingStatus?.migrationRequired}>
          {isPending ? "Processing..." : hasActiveBilling ? "Update plan" : "Start plan"}
        </button>
        <button className="btn btn-outline" onClick={handleManagePortal} disabled={isPending}>
          Manage in Lemon Squeezy
        </button>
      </div>

      {error ? (
        <div className="alert alert-error mt-4 text-sm">
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
