import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getBillingStatusForOrganization,
  getOrganizationSubscriptionSummary,
  resolveOrganizationForUser,
  setLemonSubscriptionCancelAtPeriodEnd,
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

  const ownerFreeSeats = Math.max(Number(billing.ownerFreeSeats || 0), 0);
  const usedSeats = Math.max(Number(billing.usedSeats || 0), 0);
  const currentPaidSeats = Math.max(Number(subscription?.quantity || billing.paidSeats || 0), 0);
  const targetPaidSeats = currentPaidSeats + quantity;
  const targetTotalSeats = ownerFreeSeats + targetPaidSeats;

  if (quantity < 0 && targetPaidSeats < 0) {
    return NextResponse.json(
      { error: "Cannot reduce paid seats below 0." },
      { status: 400 }
    );
  }

  if (targetTotalSeats < ownerFreeSeats) {
    return NextResponse.json(
      {
        error: `Cannot reduce total seats below your owner free-seat floor (${ownerFreeSeats}).`
      },
      { status: 400 }
    );
  }

  if (targetTotalSeats < usedSeats) {
    return NextResponse.json(
      { error: "Cannot reduce seats below the number of active members." },
      { status: 400 }
    );
  }

  if (quantity === 0) {
    return NextResponse.json(
      {
        type: "noop",
        interval: subscription?.planInterval || interval,
        quantity: currentPaidSeats
      },
      { status: 200 }
    );
  }

  if (!billing.active && quantity > 0) {
    return NextResponse.json({ error: "No active billing entitlement found for this organization." }, { status: 409 });
  }

  if (!subscription?.subscriptionId) {
    if (quantity > 0) {
      return NextResponse.json(
        {
          code: "CHECKOUT_REQUIRED",
          error: "No paid subscription exists yet. Start checkout for the additional paid seats.",
          checkoutQuantity: quantity
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "No paid subscription exists to reduce. Your free-seat floor is already applied."
      },
      { status: 400 }
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

    if (targetPaidSeats === 0) {
      try {
        const cancelled = await setLemonSubscriptionCancelAtPeriodEnd({
          subscriptionId: subscription.subscriptionId,
          cancelAtPeriodEnd: true
        });

        await subscriptionsCollection.updateOne(
          { subscriptionId: subscription.subscriptionId },
          {
            $set: {
              organizationSlug: organization.slug,
              status: cancelled.status,
              variantId: cancelled.variantId,
              planInterval: cancelled.planInterval,
              quantity: cancelled.quantity,
              renewsAt: cancelled.renewsAt,
              endsAt: cancelled.endsAt,
              currentPeriodEnd: cancelled.currentPeriodEnd,
              portalUrl: cancelled.portalUrl,
              isLegacyVariant: cancelled.isLegacyVariant,
              migrationRequired: cancelled.migrationRequired,
              scheduledChange: {
                type: "cancel_at_period_end",
                effectiveAt,
                quantity: 0
              },
              updatedAt: new Date(),
              lastEvent: "manual_schedule_cancel"
            }
          }
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not schedule cancellation for paid seats";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      return NextResponse.json(
        {
          type: "scheduled_downgrade",
          quantity: targetPaidSeats,
          totalQuantity: targetTotalSeats,
          effectiveAt
        },
        { status: 200 }
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
            quantity: targetPaidSeats
          },
          updatedAt: new Date(),
          lastEvent: "manual_schedule_downgrade"
        }
      }
    );

    return NextResponse.json(
      {
        type: "scheduled_downgrade",
        quantity: targetPaidSeats,
        totalQuantity: targetTotalSeats,
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
        quantity: updated.quantity,
        totalQuantity: ownerFreeSeats + Math.max(Number(updated.quantity || 0), 0)
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update subscription in Lemon Squeezy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
