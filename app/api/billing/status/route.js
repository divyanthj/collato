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
        quantity: billingStatus.quantity,
        usedSeats: billingStatus.usedSeats,
        remainingSeats: billingStatus.remainingSeats,
        planInterval: billingStatus.planInterval,
        status: billingStatus.status,
        migrationRequired: billingStatus.migrationRequired,
        scheduledChange: billingStatus.scheduledChange,
        currentPeriodEnd: billingStatus.currentPeriodEnd,
        source: billingStatus.source,
        ownerOverrideApplied: billingStatus.ownerOverrideApplied
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
      quantity: billing.quantity,
      usedSeats: billing.usedSeats,
      remainingSeats: billing.remainingSeats,
      planInterval: billing.planInterval,
      status: billing.status,
      migrationRequired: billing.migrationRequired,
      scheduledChange: billing.scheduledChange,
      currentPeriodEnd: billing.currentPeriodEnd,
      source: billing.source,
      ownerOverrideApplied: billing.ownerOverrideApplied
    },
    { status: 200 }
  );
}
