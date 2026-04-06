"use client";

import { useState } from "react";
import Link from "next/link";

function formatPerSeat(plan) {
  const perSeat = plan.price / plan.seatsIncluded;
  return `$${perSeat.toFixed(2)}`;
}

export function PricingSection({ pricing, isAuthenticated }) {
  const [billingInterval, setBillingInterval] = useState("month");
  const plans = billingInterval === "year" ? pricing.plans.annual : pricing.plans.monthly;

  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
      <div className="glass-panel rounded-[2rem] p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="section-kicker">Pricing</p>
            <h2 className="font-display mt-2 text-4xl font-semibold text-neutral">
              Pick the workspace size that matches your team.
            </h2>
            <p className="mt-4 text-sm leading-7 text-base-content/70">
              Start with a fixed team size per organization, then move up as more people need access to
              knowledge, updates, tasks, and reporting.
            </p>
          </div>

          <div className="rounded-[1.25rem] bg-base-100 p-1.5 shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={`btn btn-sm ${billingInterval === "month" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setBillingInterval("month")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`btn btn-sm ${billingInterval === "year" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setBillingInterval("year")}
              >
                Annual
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 xl:grid-cols-3">
          {plans.map((plan) => {
            const isFeatured = plan.seatsIncluded === 25;

            return (
              <div
                key={`${billingInterval}-${plan.key}`}
                className={`rounded-[1.7rem] border p-6 ${
                  isFeatured
                    ? "border-primary/35 bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(236,246,255,0.96))] shadow-soft"
                    : "border-base-300 bg-base-100"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-primary/60">
                      {billingInterval === "year" ? "Billed yearly" : "Billed monthly"}
                    </div>
                    <h3 className="font-display mt-3 text-3xl font-semibold text-neutral">{plan.name}</h3>
                  </div>
                  {isFeatured ? <div className="badge badge-primary badge-outline">Most popular</div> : null}
                </div>

                <div className="mt-6 flex items-end gap-2">
                  <div className="text-4xl font-semibold leading-none text-neutral">{plan.priceLabel}</div>
                  <div className="pb-1 text-sm text-base-content/60">
                    /{billingInterval === "year" ? "year" : "month"}
                  </div>
                </div>

                <div className="mt-3 text-sm leading-7 text-base-content/68">
                  Includes up to {plan.seatsIncluded} members per organization.
                </div>

                <div className="mt-6 space-y-3">
                  <div className="rounded-[1.2rem] bg-base-200/70 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-primary/60">Effective seat price</div>
                    <div className="mt-2 text-lg font-semibold text-neutral">
                      {formatPerSeat(plan)} per member / {billingInterval === "year" ? "year" : "month"}
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] bg-base-200/40 p-4 text-sm leading-7 text-base-content/72">
                    Shared workspace hub, structured update capture, knowledge indexing, grounded AI chat,
                    tasks, and progress reporting for the whole team.
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={isAuthenticated ? "/dashboard" : "/dashboard"} className={`btn ${isFeatured ? "btn-primary" : "btn-outline"} flex-1`}>
                    {isAuthenticated ? "Open dashboard" : "Get started"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
