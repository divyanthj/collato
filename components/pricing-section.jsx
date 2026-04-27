"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertBanner } from "@/components/alert-banner";
import { trackDatafastGoal } from "@/lib/client-analytics";

export function PricingSection({ pricing, isAuthenticated }) {
  const [quantity, setQuantity] = useState(3);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const plans = pricing.plans ?? [];

  const validatedQuantity = useMemo(() => {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }

    return Math.floor(parsed);
  }, [quantity]);

  const handleCheckout = async (plan) => {
    setCheckoutError(null);
    setLoadingPlan(plan.key);
    trackDatafastGoal("checkout_started", {
      source: "marketing_pricing",
      interval: plan.interval,
      quantity: validatedQuantity
    });

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          interval: plan.interval,
          quantity: validatedQuantity
        })
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Could not create checkout session");
      }

      window.location.href = result.url;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not create checkout session");
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
      <div className="glass-panel rounded-[2rem] p-8">
        <div className="flex flex-col gap-5">
          <div className="max-w-3xl">
            <p className="section-kicker">Pricing</p>
            <h2 className="font-display mt-2 text-4xl font-semibold text-neutral">
              Start small, then expand once the workflow proves itself.
            </h2>
            <p className="mt-4 text-sm leading-7 text-base-content/70">
              Pick a plan, start with a small seat count, and adjust later as more teammates join the workspace.
            </p>
          </div>

          <div className="rounded-[1.25rem] bg-base-100 p-4 md:max-w-md">
            <label className="form-control">
              <div className="label pb-2">
                <span className="label-text">How many members are you planning to invite?</span>
              </div>
              <input
                className="input input-bordered"
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <div className="mt-2 text-xs text-base-content/60">
              You are charged per member seat. Most teams can start with a small setup and expand later.
            </div>
          </div>
        </div>

        {checkoutError ? <AlertBanner tone="error" className="mt-6">{checkoutError}</AlertBanner> : null}

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => {
            const isAnnual = plan.interval === "year";
            const total = (plan.price * validatedQuantity).toFixed(2);

            return (
              <div
                key={plan.key}
                className={`rounded-[1.7rem] border p-6 ${
                  isAnnual
                    ? "border-primary/35 bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(236,246,255,0.96))] shadow-soft"
                    : "border-base-300 bg-base-100"
                } flex flex-col`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-primary/60">
                      {isAnnual ? "Billed yearly" : "Billed monthly"}
                    </div>
                    <h3 className="font-display mt-3 text-3xl font-semibold text-neutral">{plan.name}</h3>
                  </div>
                  {isAnnual ? <div className="badge badge-primary badge-outline">Best value</div> : null}
                </div>

                <div className="mt-6 flex items-end gap-2">
                  <div className="text-4xl font-semibold leading-none text-neutral">{plan.priceLabel}</div>
                  <div className="pb-1 text-sm text-base-content/60">/{plan.interval === "year" ? "year" : "month"}</div>
                </div>

                <div className="mt-3 text-sm leading-7 text-base-content/68">
                  {plan.interval === "year" ? "Per member, billed annually" : "Per member, billed monthly"}
                </div>
                <div className="mt-1 min-h-6 text-sm font-medium text-success">
                  {isAnnual ? `Only ${plan.monthlyEquivalentLabel}` : <span className="invisible">placeholder</span>}
                </div>

                <div className="mt-6 rounded-[1.2rem] bg-base-200/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-primary/60">Estimated package total</div>
                  <div className="mt-2 text-lg font-semibold text-neutral">
                    ${total} for {validatedQuantity} member{validatedQuantity === 1 ? "" : "s"} / {plan.interval === "year" ? "year" : "month"}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {isAuthenticated ? (
                    <button
                      type="button"
                      className={`btn ${isAnnual ? "btn-primary" : "btn-outline"} flex-1`}
                      onClick={() => void handleCheckout(plan)}
                      disabled={loadingPlan === plan.key}
                    >
                      {loadingPlan === plan.key ? "Redirecting..." : "Start workspace setup"}
                    </button>
                  ) : (
                    <Link href="/dashboard" className={`btn ${isAnnual ? "btn-primary" : "btn-outline"} flex-1`}>
                      Start workspace setup
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
