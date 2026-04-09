"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertBanner } from "@/components/alert-banner";
import appConfig from "@/config/app";
import { readResponsePayload } from "@/lib/client-api";

export function OrganizationBillingManager({ organizationSlug, initialBillingStatus }) {
  const router = useRouter();
  const [billingStatus, setBillingStatus] = useState(initialBillingStatus);
  const [subscriptionsSummary, setSubscriptionsSummary] = useState({
    canonical: initialBillingStatus?.canonicalSubscription ?? null,
    history: initialBillingStatus?.subscriptionHistory ?? [],
    hasMultipleActive: Boolean(initialBillingStatus?.hasMultipleActiveSubscriptions),
    canMutateSafely: initialBillingStatus?.canMutateSafely ?? true
  });
  const [interval, setInterval] = useState(initialBillingStatus?.planInterval || "month");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [isLifecyclePending, startLifecycleTransition] = useTransition();
  const confirmationDialogRef = useRef(null);

  const effectiveQuantity = useMemo(() => {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return parsed < 0 ? Math.ceil(parsed) : Math.floor(parsed);
  }, [quantity]);

  const refreshStatus = async () => {
    const response = await fetch(`/api/billing/status?organizationSlug=${encodeURIComponent(organizationSlug)}`, {
      cache: "no-store"
    });
    const result = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(result.error ?? "Could not refresh billing status");
    }

    setBillingStatus(result);
    if (result?.planInterval) {
      setInterval(result.planInterval);
    }
  };

  const refreshSubscriptionsSummary = async () => {
    const response = await fetch(`/api/billing/subscriptions?organizationSlug=${encodeURIComponent(organizationSlug)}`, {
      cache: "no-store"
    });
    const result = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(result.error ?? "Could not refresh subscription history");
    }
    setSubscriptionsSummary({
      canonical: result.canonical ?? null,
      history: Array.isArray(result.history) ? result.history : [],
      hasMultipleActive: Boolean(result.hasMultipleActive),
      canMutateSafely: Boolean(result.canMutateSafely)
    });
  };

  useEffect(() => {
    void refreshSubscriptionsSummary().catch((summaryError) => {
      setError(summaryError instanceof Error ? summaryError.message : "Could not load subscription history");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationSlug]);

  const handleManagePortal = () => {
    setError(null);
    setStatusMessage(null);
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

  const handleChangePlanConfirmed = () => {
    setError(null);
    setStatusMessage(null);
    confirmationDialogRef.current?.close();
    startTransition(async () => {
      try {
        if (shouldResumeBeforeUpdate) {
          const resumeResponse = await fetch("/api/billing/resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationSlug })
          });
          const resumeResult = await readResponsePayload(resumeResponse);
          if (!resumeResponse.ok) {
            throw new Error(resumeResult.error ?? "Could not resume renewal before updating plan");
          }
        }

        if (!hasActiveBilling) {
          const checkoutResponse = await fetch("/api/billing/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationSlug,
              interval,
              quantity: Math.max(normalizedSeatDelta, 1),
              mode: "new_subscription"
            })
          });
          const checkoutResult = await readResponsePayload(checkoutResponse);
          if (!checkoutResponse.ok || !checkoutResult.url) {
            throw new Error(checkoutResult.error ?? "Could not start billing plan");
          }
          window.location.href = checkoutResult.url;
          return;
        }

        const response = await fetch("/api/billing/change-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationSlug,
            interval,
            quantity: normalizedSeatDelta
          })
        });
        const result = await readResponsePayload(response);
        if (!response.ok) {
          throw new Error(result.error ?? "Could not change plan");
        }

        await refreshStatus();
        await refreshSubscriptionsSummary();
        setQuantity("1");
        if (result?.type === "scheduled_downgrade") {
          const effectiveDate = result?.effectiveAt ? new Date(result.effectiveAt).toLocaleDateString() : "next renewal";
          setStatusMessage(`Seat decrease scheduled for ${effectiveDate}. Current seats remain active until then.`);
        } else {
          setStatusMessage("Plan updated successfully.");
        }
        router.refresh();
      } catch (changeError) {
        setError(changeError instanceof Error ? changeError.message : "Could not change plan");
      }
    });
  };

  const handleChangePlanClick = () => {
    setError(null);
    setStatusMessage(null);
    if (!hasActiveBilling && effectiveQuantity < 1) {
      setError("Choose at least 1 seat to start a new plan.");
      return;
    }
    if (hasActiveBilling && effectiveQuantity < minSeatDelta) {
      setError("You must keep at least 1 seat on the plan.");
      return;
    }
    confirmationDialogRef.current?.showModal();
  };

  const handleCancelAtPeriodEnd = () => {
    setError(null);
    setStatusMessage(null);
    startLifecycleTransition(async () => {
      try {
        const response = await fetch("/api/billing/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationSlug })
        });
        const result = await readResponsePayload(response);
        if (!response.ok) {
          throw new Error(result.error ?? "Could not schedule cancellation");
        }
        await refreshStatus();
        await refreshSubscriptionsSummary();
        setStatusMessage("Cancellation scheduled at period end.");
        router.refresh();
      } catch (cancelError) {
        setError(cancelError instanceof Error ? cancelError.message : "Could not schedule cancellation");
      }
    });
  };

  const handleResumeRenewal = () => {
    setError(null);
    setStatusMessage(null);
    startLifecycleTransition(async () => {
      try {
        const response = await fetch("/api/billing/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationSlug })
        });
        const result = await readResponsePayload(response);
        if (!response.ok) {
          throw new Error(result.error ?? "Could not resume renewal");
        }
        await refreshStatus();
        await refreshSubscriptionsSummary();
        setStatusMessage("Auto-renewal resumed.");
        router.refresh();
      } catch (resumeError) {
        setError(resumeError instanceof Error ? resumeError.message : "Could not resume renewal");
      }
    });
  };

  const canonical = subscriptionsSummary.canonical;
  const canonicalStatus = String(canonical?.status || "").trim().toLowerCase();
  const canonicalIsActiveLike =
    canonicalStatus === "active" ||
    canonicalStatus === "on_trial" ||
    canonicalStatus === "trialing" ||
    canonicalStatus === "past_due";
  const canonicalPeriodEndTime = canonical?.currentPeriodEnd ? new Date(canonical.currentPeriodEnd).getTime() : 0;
  const hasCanonicalPeriodEntitlement =
    (canonicalStatus === "cancelled" || canonicalStatus === "canceled" || canonicalStatus === "expired") &&
    Number.isFinite(canonicalPeriodEndTime) &&
    canonicalPeriodEndTime > Date.now();
  const hasActiveBilling = Boolean(billingStatus?.active || hasCanonicalPeriodEntitlement);
  const purchasedSeats = hasCanonicalPeriodEntitlement ? Number(canonical?.quantity || 0) : Number(billingStatus?.quantity ?? 0);
  const usedSeats = Number(billingStatus?.usedSeats ?? 0);
  const remainingSeats = hasCanonicalPeriodEntitlement
    ? Math.max(purchasedSeats - usedSeats, 0)
    : Number(billingStatus?.remainingSeats ?? 0);

  const displayBillingStateMessage =
    hasCanonicalPeriodEntitlement && (!billingStatus?.billingStateMessage || billingStatus?.status === "none")
      ? `Cancelled. Access remains until ${new Date(canonical.currentPeriodEnd).toLocaleDateString()}.`
      : billingStatus?.billingStateMessage;

  const isCancelled = canonical?.status === "cancelled" || canonical?.status === "canceled";
  const isMutationBlocked = subscriptionsSummary.hasMultipleActive || !subscriptionsSummary.canMutateSafely;
  const shouldResumeBeforeUpdate = isCancelled && hasCanonicalPeriodEntitlement;
  const pricingByInterval = useMemo(() => {
    const monthly = appConfig.pricing.plans.find((plan) => plan.interval === "month");
    const annual = appConfig.pricing.plans.find((plan) => plan.interval === "year");
    return {
      month: Number(monthly?.price ?? 0),
      year: Number(annual?.price ?? 0)
    };
  }, []);
  const perSeatPrice = interval === "year" ? pricingByInterval.year : pricingByInterval.month;
  const seatDelta = effectiveQuantity;
  const currentSeatQuantity = Math.max(Number(canonical?.quantity ?? purchasedSeats ?? 0), 0);
  const maxRemovableSeats = Math.max(currentSeatQuantity - 1, 0);
  const minSeatDelta = hasActiveBilling ? -maxRemovableSeats : 0;
  const normalizedSeatDelta = Math.max(seatDelta, minSeatDelta);
  const currentInterval = canonical?.planInterval === "year" ? "year" : "month";
  const currentPerMonth =
    currentInterval === "year"
      ? (currentSeatQuantity * pricingByInterval.year) / 12
      : currentSeatQuantity * pricingByInterval.month;
  const targetSeatQuantity = hasActiveBilling
    ? Math.max(currentSeatQuantity + normalizedSeatDelta, 1)
    : Math.max(normalizedSeatDelta, 1);
  const projectedPerMonth =
    interval === "year"
      ? (targetSeatQuantity * pricingByInterval.year) / 12
      : targetSeatQuantity * pricingByInterval.month;
  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: appConfig.pricing.currency || "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
    []
  );
  const recurringUnitLabel = interval === "year" ? "year" : "month";
  const isInvalidSeatReduction = hasActiveBilling && seatDelta < minSeatDelta;

  return (
    <div id="billing" className="rounded-[1.5rem] bg-base-100 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral">Billing</div>
          <p className="mt-2 text-sm leading-6 text-base-content/65">
            Manage your organization plan and seats directly in-app. Use portal only for payment methods or invoice details.
          </p>
        </div>
        <div className={`badge ${billingStatus?.migrationRequired ? "badge-warning" : hasActiveBilling ? "badge-success" : "badge-outline"}`}>
          {billingStatus?.migrationRequired ? "Migration required" : hasActiveBilling ? "Active" : "No active plan"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-base-300 bg-base-50 p-3">
          <div className="text-xs uppercase tracking-[0.16em] text-base-content/55">Purchased seats</div>
          <div className="mt-1 text-2xl font-semibold text-neutral">{purchasedSeats}</div>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-50 p-3">
          <div className="text-xs uppercase tracking-[0.16em] text-base-content/55">Used seats</div>
          <div className="mt-1 text-2xl font-semibold text-neutral">{usedSeats}</div>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-50 p-3">
          <div className="text-xs uppercase tracking-[0.16em] text-base-content/55">Remaining seats</div>
          <div className="mt-1 text-2xl font-semibold text-neutral">{remainingSeats}</div>
        </div>
      </div>

      {billingStatus?.scheduledChange ? (
        <div className="alert alert-info mt-4 text-sm">
          <span>
            Downgrade scheduled to {billingStatus.scheduledChange.quantity} seats on{" "}
            {billingStatus.scheduledChange.effectiveAt
              ? new Date(billingStatus.scheduledChange.effectiveAt).toLocaleDateString()
              : "renewal"}
            .
          </span>
        </div>
      ) : null}

      {displayBillingStateMessage ? (
        <div className="alert alert-info mt-4 text-sm">
          <span>{displayBillingStateMessage}</span>
        </div>
      ) : null}

      {isMutationBlocked ? (
        <div className="alert alert-warning mt-4 text-sm">
          <span>
            Multiple active subscriptions are linked. In-app mutations are temporarily locked to avoid changing the wrong plan.
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="form-control">
          <div className="label py-1">
            <span className="label-text">Billing interval</span>
          </div>
          <select
            className="select select-bordered"
            value={interval}
            onChange={(event) => setInterval(event.target.value)}
            disabled={isPending}
          >
            <option value="month">Monthly</option>
            <option value="year">Annual</option>
          </select>
        </label>
        <label className="form-control">
          <div className="label py-1">
            <span className="label-text">Seat change (+/-)</span>
          </div>
          <input
            className="input input-bordered"
            type="number"
            min={minSeatDelta}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={isPending}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={handleChangePlanClick} disabled={isPending || isLifecyclePending || isMutationBlocked}>
          {isPending ? "Processing..." : hasActiveBilling ? "Update plan" : "Start plan"}
        </button>
        {hasActiveBilling ? (
          isCancelled ? (
            <button
              className="btn btn-outline"
              onClick={handleResumeRenewal}
              disabled={isPending || isLifecyclePending || isMutationBlocked}
            >
              {isLifecyclePending ? "Updating..." : "Resume renewal"}
            </button>
          ) : (
            <button
              className="btn btn-outline"
              onClick={handleCancelAtPeriodEnd}
              disabled={isPending || isLifecyclePending || isMutationBlocked}
            >
              {isLifecyclePending ? "Updating..." : "Cancel at period end"}
            </button>
          )
        ) : null}
        <button className="btn btn-ghost" onClick={handleManagePortal} disabled={isPending || isLifecyclePending}>
          Billing details
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-base-300 bg-base-50 p-4">
        <div className="text-sm font-semibold text-neutral">Current subscription</div>
        {canonical ? (
          <div className="mt-2 text-sm text-base-content/70">
            <div>Status: {canonical.status}</div>
            <div>Interval: {canonical.planInterval || "Unknown"}</div>
            <div>Quantity: {canonical.quantity}</div>
            <div>
              {canonicalIsActiveLike ? "Next renewal" : "Period end"}:{" "}
              {canonical.currentPeriodEnd ? new Date(canonical.currentPeriodEnd).toLocaleDateString() : "Unknown"}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-base-content/60">No linked subscription record found.</div>
        )}
      </div>

      {subscriptionsSummary.history.length > 0 ? (
        <div className="mt-4 rounded-xl border border-base-300 bg-base-50 p-4">
          <div className="text-sm font-semibold text-neutral">Subscription history</div>
          <div className="mt-3 space-y-2">
            {subscriptionsSummary.history.map((item) => (
              <div key={item.subscriptionId} className="rounded-lg border border-base-300 bg-base-100 p-3 text-sm text-base-content/70">
                <div className="font-medium text-neutral">{item.subscriptionId}</div>
                <div>Status: {item.status}</div>
                <div>Interval: {item.planInterval || "Unknown"} | Quantity: {item.quantity}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {statusMessage ? <AlertBanner tone="success" className="mt-4">{statusMessage}</AlertBanner> : null}
      {error ? <AlertBanner tone="error" className="mt-4">{error}</AlertBanner> : null}

      <dialog ref={confirmationDialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-semibold text-neutral">Are you sure?</h3>
          <p className="mt-2 text-sm text-base-content/75">
            {hasActiveBilling
              ? "You are about to update your organization plan."
              : "You are about to start your organization plan."}
          </p>
          {shouldResumeBeforeUpdate ? (
            <div className="alert alert-warning mt-3 text-sm">
              <span>
                Your plan is set to end on{" "}
                {canonical?.currentPeriodEnd ? new Date(canonical.currentPeriodEnd).toLocaleDateString() : "the period end date"}.
                We&apos;ll turn auto-renew back on and then apply your update.
              </span>
            </div>
          ) : null}
          <div className="mt-4 rounded-xl border border-base-300 bg-base-50 p-3 text-sm">
            <div className="font-medium text-neutral">
              {normalizedSeatDelta > 0
                ? `${normalizedSeatDelta} additional seat${normalizedSeatDelta === 1 ? "" : "s"} at ${priceFormatter.format(perSeatPrice)} each`
                : normalizedSeatDelta < 0
                  ? `${Math.abs(normalizedSeatDelta)} seat${Math.abs(normalizedSeatDelta) === 1 ? "" : "s"} scheduled for removal at renewal (${priceFormatter.format(perSeatPrice)} each)`
                  : `No seat change selected (${priceFormatter.format(perSeatPrice)} per seat)`}
            </div>
            <div className="mt-1 text-base-content/70">
              Estimated recurring change: {priceFormatter.format(perSeatPrice * normalizedSeatDelta)} / {recurringUnitLabel}
            </div>
            {normalizedSeatDelta < 0 ? (
              <div className="mt-1 text-base-content/70">
                This decrease will take effect at your next renewal.
              </div>
            ) : null}
            <div className="mt-1 text-base-content/70">
              Current per month: {priceFormatter.format(currentPerMonth)} / month
            </div>
            <div className="mt-1 text-base-content/70">
              After update: {priceFormatter.format(projectedPerMonth)} / month
            </div>
            <div className="mt-1 text-xs text-base-content/55">
              Final proration and tax (if any) are calculated by Lemon Squeezy.
            </div>
            {isInvalidSeatReduction ? (
              <div className="mt-2 text-xs font-medium text-error">
                You must keep at least 1 seat on the plan.
              </div>
            ) : null}
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => confirmationDialogRef.current?.close()} disabled={isPending}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleChangePlanConfirmed} disabled={isPending || isInvalidSeatReduction}>
              {isPending
                ? "Processing..."
                : shouldResumeBeforeUpdate
                  ? "Yes, resume and update"
                  : hasActiveBilling
                    ? "Yes, update plan"
                    : "Yes, start plan"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit" disabled={isPending}>close</button>
        </form>
      </dialog>
    </div>
  );
}
