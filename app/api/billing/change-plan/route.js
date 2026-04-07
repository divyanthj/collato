import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getBillingStatusForOrganization,
  getSubscriptionForOrganization,
  resolveOrganizationForUser,
  updateLemonSubscriptionFromApp
} from "@/lib/billing";
import { getDatabase } from "@/lib/mongodb";

const ACTIVE_STATUSES = ["active", "on_trial", "trialing", "past_due"];

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const organizationSlug = typeof body.organizationSlug === "string" ? body.organizationSlug.trim() : "";
  const interval = typeof body.interval === "string" ? body.interval : "";
  const quantity = Number(body.quantity);

  if (!["month", "year"].includes(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json({ error: "Seats to add must be an integer 0 or greater" }, { status: 400 });
  }

  const organization = await resolveOrganizationForUser(session.user.email, organizationSlug);
  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const billing = await getBillingStatusForOrganization(organization);
  const subscription = await getSubscriptionForOrganization(organization.slug);

  if (!billing.active) {
    return NextResponse.json({ error: "No active subscription found for this organization." }, { status: 409 });
  }

  if (!subscription?.subscriptionId) {
    return NextResponse.json(
      {
        error: "No updatable subscription record found for this organization. Use billing portal to create or relink a subscription first."
      },
      { status: 409 }
    );
  }

  const db = await getDatabase();
  const subscriptionsCollection = db.collection("billing_subscriptions");
  const activeSubscriptionCount = await subscriptionsCollection.countDocuments({
    organizationSlug: organization.slug,
    status: { $in: ACTIVE_STATUSES }
  });

  if (activeSubscriptionCount > 1) {
    return NextResponse.json(
      {
        error:
          "Multiple active subscriptions are linked to this organization. To avoid changing the wrong subscription, update seats in Lemon Squeezy portal."
      },
      { status: 409 }
    );
  }

  try {
    const updated = await updateLemonSubscriptionFromApp({
      subscriptionId: subscription.subscriptionId,
      interval,
      quantityToAdd: quantity
    });

    await subscriptionsCollection.updateOne(
      { subscriptionId: updated.subscriptionId },
      {
        $set: {
          organizationSlug: organization.slug,
          status: updated.status,
          subscriptionItemId: updated.subscriptionItemId,
          variantId: updated.variantId,
          planInterval: updated.planInterval,
          quantity: updated.quantity,
          customerEmail: subscription.customerEmail || session.user.email,
          customerId: subscription.customerId || "",
          renewsAt: updated.renewsAt,
          endsAt: updated.endsAt,
          currentPeriodEnd: updated.currentPeriodEnd,
          portalUrl: updated.portalUrl,
          isLegacyVariant: updated.isLegacyVariant,
          migrationRequired: updated.migrationRequired,
          scheduledChange: null,
          lastEvent: "manual_update",
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    return NextResponse.json(
      {
        type: "updated",
        interval: updated.planInterval,
        quantity: updated.quantity
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update subscription in Lemon Squeezy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
