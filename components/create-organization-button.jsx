"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertBanner } from "@/components/alert-banner";
import { readResponsePayload } from "@/lib/client-api";

export function CreateOrganizationButton({
  suggestedOrganizationName = "My Organization",
  returnTo = "/dashboard",
  currentUserEmail = ""
}) {
  const router = useRouter();
  const [seats, setSeats] = useState(1);
  const [error, setError] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const normalizedSeats = Number.isInteger(Number(seats)) && Number(seats) > 0 ? Number(seats) : 1;
  const closeDialog = () => {
    if (isPending) {
      return;
    }
    setIsDialogOpen(false);
  };

  const buildReturnUrl = (nextSlug) => {
    const [pathPart, queryPart = ""] = String(returnTo || "/dashboard").split("?");
    const params = new URLSearchParams(queryPart);
    params.set("org", nextSlug);
    params.set("orgCreated", "1");
    const query = params.toString();
    return query ? `${pathPart}?${query}` : pathPart;
  };

  const handleConfirm = async () => {
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/onboarding/create-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: suggestedOrganizationName })
      });

      const result = await readResponsePayload(response);
        if (!response.ok) {
        if (result?.code === "NO_ACTIVE_SUBSCRIPTION") {
          const checkoutOrgName = encodeURIComponent(suggestedOrganizationName);
          const checkoutReturnTo = `/dashboard?postCheckoutCreateOrg=1&postCheckoutOrgName=${checkoutOrgName}`;
          const checkoutResponse = await fetch("/api/billing/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              interval: "month",
              quantity: normalizedSeats,
              mode: "new_subscription",
              redirectTo: checkoutReturnTo,
              expectedUserEmail: currentUserEmail
            })
          });

          const checkout = await readResponsePayload(checkoutResponse);
          if (checkoutResponse.ok && checkout?.url) {
            window.location.href = checkout.url;
            return;
          }
          throw new Error(checkout.error ?? "Could not start payment checkout");
        }

        throw new Error(result.error ?? "Could not create organization");
      }

      const nextSlug = String(result.slug || "").trim();
      const nextUrl = nextSlug ? buildReturnUrl(nextSlug) : "/dashboard?orgCreated=1";

      router.push(nextUrl);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create organization");
      setIsPending(false);
    }
  };

  const handleManageBilling = async () => {
    setError(null);
    setIsOpeningPortal(true);
    try {
      const response = await fetch("/api/billing/self-portal", {
        method: "POST"
      });
      const result = await readResponsePayload(response);
      if (!response.ok || !result?.url) {
        throw new Error(result.error ?? "Could not open billing portal");
      }
      window.location.href = result.url;
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Could not open billing portal");
      setIsOpeningPortal(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-accent" onClick={() => setIsDialogOpen(true)} disabled={isPending || isOpeningPortal}>
          {isPending ? "Opening payment..." : "Create my organization"}
        </button>
        <button type="button" className="btn btn-outline" onClick={handleManageBilling} disabled={isPending || isOpeningPortal}>
          {isOpeningPortal ? "Opening billing..." : "Manage billing"}
        </button>
      </div>
      {isDialogOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-semibold text-neutral">Create organization</h3>
            <p className="mt-2 text-sm leading-6 text-base-content/70">
              Tell us how many seats you want, then we will continue to secure payment setup if required.
            </p>
            <p className="mt-2 text-xs leading-6 text-base-content/60">
              Checkout account: <span className="font-semibold text-base-content">{currentUserEmail || "Signed-in email"}</span>
            </p>

            <label className="form-control mt-4">
              <div className="label">
                <span className="label-text">Seats</span>
              </div>
              <input
                className="input input-bordered"
                type="number"
                min={1}
                step={1}
                value={seats}
                onChange={(event) => setSeats(event.target.value)}
                disabled={isPending}
              />
            </label>

            {error ? <AlertBanner tone="error" className="mt-4">{error}</AlertBanner> : null}

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={isPending}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={handleConfirm}
                disabled={isPending || normalizedSeats < 1}
              >
                {isPending ? "Redirecting to payment..." : "Continue"}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeDialog} disabled={isPending}/>
        </dialog>
      ) : null}
      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}
    </div>
  );
}
