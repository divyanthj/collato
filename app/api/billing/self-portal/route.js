import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createPortalUrlFromSubscription, getBillingStatusForUserWithoutOrganization } from "@/lib/billing";

export async function POST() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const billingStatus = await getBillingStatusForUserWithoutOrganization(session.user.email);
  const hasSubscriptionReference = Boolean(billingStatus.subscriptionId || billingStatus.portalUrl);

  if (!hasSubscriptionReference) {
    return NextResponse.json({ error: "No subscription found for this account" }, { status: 404 });
  }

  const url = await createPortalUrlFromSubscription({
    subscriptionId: billingStatus.subscriptionId,
    portalUrl: billingStatus.portalUrl
  });

  if (!url) {
    return NextResponse.json({ error: "Could not open billing portal" }, { status: 404 });
  }

  return NextResponse.json({ url }, { status: 200 });
}
