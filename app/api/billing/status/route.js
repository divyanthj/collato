import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBillingStatusForOrganization, getCheckoutRequirementForUser, resolveOrganizationForUser } from "@/lib/billing";

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationSlug = url.searchParams.get("organizationSlug") || "";
  if (!organizationSlug) {
    const { billingStatus } = await getCheckoutRequirementForUser({
      userEmail: session.user.email,
      organization: null
    });
    return NextResponse.json(
      {
        organizationSlug: null,
        active: billingStatus.active,
        ownerFreeSeats: billingStatus.ownerFreeSeats ?? 0,
        paidSeats: billingStatus.paidSeats ?? 0,
        quantity: billingStatus.quantity,
        usedSeats: billingStatus.usedSeats,
        remainingSeats: billingStatus.remainingSeats,
        planInterval: billingStatus.planInterval,
        status: billingStatus.status,
        migrationRequired: billingStatus.migrationRequired,
        scheduledChange: billingStatus.scheduledChange,
        currentPeriodEnd: billingStatus.currentPeriodEnd,
        source: billingStatus.source,
        ownerOverrideApplied: billingStatus.ownerOverrideApplied,
        canonicalSubscription: billingStatus.canonicalSubscription ?? null,
        subscriptionHistory: billingStatus.subscriptionHistory ?? [],
        hasMultipleActiveSubscriptions: Boolean(billingStatus.hasMultipleActiveSubscriptions),
        canMutateSafely: billingStatus.canMutateSafely ?? true,
        billingStateMessage: billingStatus.billingStateMessage ?? ""
      },
      { status: 200 }
    );
  }

  const organization = await resolveOrganizationForUser(session.user.email, organizationSlug);
  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const billing = await getBillingStatusForOrganization(organization);
  return NextResponse.json(
    {
      organizationSlug: organization.slug,
      active: billing.active,
      ownerFreeSeats: billing.ownerFreeSeats ?? 0,
      paidSeats: billing.paidSeats ?? 0,
      quantity: billing.quantity,
      usedSeats: billing.usedSeats,
      remainingSeats: billing.remainingSeats,
      planInterval: billing.planInterval,
      status: billing.status,
      migrationRequired: billing.migrationRequired,
      scheduledChange: billing.scheduledChange,
      currentPeriodEnd: billing.currentPeriodEnd,
      source: billing.source,
      ownerOverrideApplied: billing.ownerOverrideApplied,
      canonicalSubscription: billing.canonicalSubscription ?? null,
      subscriptionHistory: billing.subscriptionHistory ?? [],
      hasMultipleActiveSubscriptions: Boolean(billing.hasMultipleActiveSubscriptions),
      canMutateSafely: billing.canMutateSafely ?? true,
      billingStateMessage: billing.billingStateMessage ?? ""
    },
    { status: 200 }
  );
}
