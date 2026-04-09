import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getBillingStatusForOrganization,
  getOrganizationSubscriptionSummary,
  resolveOrganizationForUser,
  updateLemonSubscriptionFromApp
} from "@/lib/billing";
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

  if (!["month", "year"].includes(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  if (!Number.isInteger(quantity)) {
    return NextResponse.json({ error: "Seat change must be a whole number" }, { status: 400 });
  }

  const organization = await resolveOrganizationForUser(session.user.email, organizationSlug);
  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (organization.ownerEmail !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Only the organization owner can manage billing" }, { status: 403 });
  }

  const billing = await getBillingStatusForOrganization(organization);
  const summary = await getOrganizationSubscriptionSummary(organization);
  const subscription = summary.canonical;

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

  if (!summary.canMutateSafely) {
    return NextResponse.json(
      {
        error:
          "Multiple active subscriptions are linked to this organization. To avoid changing the wrong subscription, update seats in Lemon Squeezy portal."
      },
      { status: 409 }
    );
  }

  const currentQuantity = Number(subscription.quantity || billing.quantity || 0);
  const targetQuantity = Math.max(currentQuantity + quantity, 1);
  if (targetQuantity < Number(billing.usedSeats || 0)) {
    return NextResponse.json(
      { error: "Cannot reduce seats below the number of active members." },
      { status: 400 }
    );
  }

  const db = await getDatabase();
  const subscriptionsCollection = db.collection("billing_subscriptions");
  const effectiveAt = subscription.currentPeriodEnd || billing.currentPeriodEnd || null;

  if (quantity < 0) {
    if (!effectiveAt) {
      return NextResponse.json(
        { error: "Could not determine renewal date for scheduling the seat decrease." },
        { status: 409 }
      );
    }

    if (subscription.planInterval && interval !== subscription.planInterval) {
      return NextResponse.json(
        { error: "Save billing interval changes separately from seat decreases." },
        { status: 400 }
      );
    }

    await subscriptionsCollection.updateOne(
      { subscriptionId: subscription.subscriptionId },
      {
        $set: {
          organizationSlug: organization.slug,
          scheduledChange: {
            type: "seat_downgrade_at_renewal",
            effectiveAt,
            quantity: targetQuantity
          },
          updatedAt: new Date(),
          lastEvent: "manual_schedule_downgrade"
        }
      }
    );

    return NextResponse.json(
      {
        type: "scheduled_downgrade",
        quantity: targetQuantity,
        effectiveAt
      },
      { status: 200 }
    );
  }

  try {
    const updated = await updateLemonSubscriptionFromApp({
      subscriptionId: subscription.subscriptionId,
      interval,
      seatDelta: quantity
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
