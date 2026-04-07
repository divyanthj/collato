import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createLemonCheckoutUrl, getBillingStatusForOrganization, getSubscriptionForOrganization, resolveOrganizationForUser } from "@/lib/billing";
import { getDatabase } from "@/lib/mongodb";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const organizationSlug = typeof body.organizationSlug === "string" ? body.organizationSlug.trim() : "";
  const interval = typeof body.interval === "string" ? body.interval : "";
  const quantity = Number(body.quantity);
  const mode = typeof body.mode === "string" ? body.mode : "switch_plan";

  if (!["month", "year"].includes(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Quantity must be an integer greater than 0" }, { status: 400 });
  }

  const organization = await resolveOrganizationForUser(session.user.email, organizationSlug);
  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const billing = await getBillingStatusForOrganization(organization);
  const subscription = await getSubscriptionForOrganization(organization.slug);

  if (billing.migrationRequired && mode !== "migrate") {
    return NextResponse.json({ error: "Migration required before changing plan", code: "MIGRATION_REQUIRED" }, { status: 409 });
  }

  if (!subscription || !billing.active || mode === "new_subscription" || mode === "migrate") {
    try {
      const url = await createLemonCheckoutUrl({
        userEmail: session.user.email,
        organizationSlug: organization.slug,
        interval,
        quantity,
        mode: mode === "migrate" ? "migrate" : "new_subscription"
      });
      return NextResponse.json({ type: "checkout", url }, { status: 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create checkout";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const currentInterval = billing.planInterval || "month";
  const isUpgrade = quantity > billing.quantity || (currentInterval === "month" && interval === "year");
  const isDowngrade = quantity < billing.quantity || (currentInterval === "year" && interval === "month");

  if (!isUpgrade && !isDowngrade) {
    return NextResponse.json({ type: "noop", message: "No billing changes detected" }, { status: 200 });
  }

  if (isUpgrade) {
    try {
      const url = await createLemonCheckoutUrl({
        userEmail: session.user.email,
        organizationSlug: organization.slug,
        interval,
        quantity,
        mode: "upgrade_quantity"
      });
      return NextResponse.json({ type: "checkout", url }, { status: 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create checkout";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const db = await getDatabase();
  const subscriptionsCollection = db.collection("billing_subscriptions");
  const scheduledChange = {
    interval,
    quantity,
    effectiveAt: billing.currentPeriodEnd || null,
    requestedBy: session.user.email,
    requestedAt: new Date().toISOString()
  };

  await subscriptionsCollection.updateOne(
    { organizationSlug: organization.slug },
    {
      $set: {
        scheduledChange,
        updatedAt: new Date()
      }
    }
  );

  return NextResponse.json(
    {
      type: "scheduled",
      scheduledChange
    },
    { status: 200 }
  );
}
