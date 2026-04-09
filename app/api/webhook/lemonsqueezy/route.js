import crypto from "crypto";
import { NextResponse } from "next/server";

import { getVariantBillingMeta } from "@/lib/billing";
import { getDatabase } from "@/lib/mongodb";

function safeEqualHex(expected, received) {
  try {
    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(received, "hex");
    return (
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  } catch {
    return false;
  }
}

function parseQuantity(attributes, payload) {
  const subscriptionQuantity = Number(attributes?.first_subscription_item?.quantity);
  const orderQuantity = Number(attributes?.first_order_item?.quantity);
  const customQuantity = Number(
    payload?.meta?.custom_data?.quantity ??
      attributes?.custom_data?.quantity ??
      attributes?.custom?.quantity
  );

  const quantity = [subscriptionQuantity, orderQuantity, customQuantity].find(
    (value) => Number.isFinite(value) && value > 0
  );

  return quantity ? Math.floor(quantity) : 1;
}

export async function POST(request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const signature = request.headers.get("x-signature") || "";
  const rawBody = await request.text();

  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  if (!safeEqualHex(digest, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const eventName = payload?.meta?.event_name || request.headers.get("x-event-name") || "unknown";
  const data = payload?.data || {};
  const attributes = data?.attributes || {};

  const db = await getDatabase();
  const subscriptionsCollection = db.collection("billing_subscriptions");
  const ordersCollection = db.collection("billing_orders");
  const webhookEventsCollection = db.collection("billing_webhook_events");

  await webhookEventsCollection.insertOne({
    eventName,
    objectType: data?.type || null,
    objectId: data?.id ? String(data.id) : null,
    receivedAt: new Date()
  });

  const variantId =
    attributes?.variant_id ??
    attributes?.first_subscription_item?.variant_id ??
    attributes?.first_order_item?.variant_id ??
    null;
  const quantity = parseQuantity(attributes, payload);
  const appUserEmail =
    payload?.meta?.custom_data?.userEmail ??
    payload?.meta?.custom_data?.user_email ??
    "";
  const customerEmail =
    appUserEmail ??
    attributes?.user_email ??
    attributes?.customer_email ??
    "";
  const customerId = attributes?.customer_id ? String(attributes.customer_id) : "";
  const organizationSlug =
    payload?.meta?.custom_data?.organizationSlug ??
    attributes?.custom_data?.organizationSlug ??
    attributes?.custom?.organizationSlug ??
    "";
  const variantMeta = getVariantBillingMeta(variantId);
  const planInterval = variantMeta.planInterval;

  if (data?.type === "subscriptions" && data?.id) {
    const existingSubscription = await subscriptionsCollection.findOne({ subscriptionId: String(data.id) });
    const renewalDate = attributes?.renews_at ? new Date(String(attributes.renews_at)) : null;
    const endsDate = attributes?.ends_at ? new Date(String(attributes.ends_at)) : null;
    const isCancelledStatus = String(attributes?.status || "").toLowerCase() === "cancelled";
    const scheduledChange =
      isCancelledStatus && renewalDate
        ? {
            type: "cancel_at_period_end",
            effectiveAt: renewalDate.toISOString(),
            quantity
          }
        : null;
    const existingScheduledChange = existingSubscription?.scheduledChange || null;
    const existingScheduledEffectiveAt = existingScheduledChange?.effectiveAt
      ? new Date(String(existingScheduledChange.effectiveAt)).getTime()
      : 0;
    const hasFutureManualSeatDowngrade =
      existingScheduledChange?.type === "seat_downgrade_at_renewal" &&
      Number.isFinite(existingScheduledEffectiveAt) &&
      existingScheduledEffectiveAt > Date.now();
    const mergedScheduledChange = variantMeta.migrationRequired
      ? null
      : scheduledChange || (hasFutureManualSeatDowngrade ? existingScheduledChange : null);

    const subscriptionSet = {
      subscriptionId: String(data.id),
      status: attributes?.status || "unknown",
      variantId: variantId ? String(variantId) : "",
      planInterval,
      quantity,
      subscriptionItemId: attributes?.first_subscription_item?.id ? String(attributes.first_subscription_item.id) : "",
      customerEmail: String(customerEmail || ""),
      appUserEmail: String(appUserEmail || ""),
      customerId,
      orderId: attributes?.order_id ? String(attributes.order_id) : "",
      renewsAt: renewalDate,
      endsAt: endsDate,
      currentPeriodEnd: renewalDate,
      portalUrl: attributes?.urls?.customer_portal || "",
      isLegacyVariant: variantMeta.isLegacyVariant,
      migrationRequired: variantMeta.migrationRequired,
      scheduledChange: mergedScheduledChange,
      lastEvent: eventName,
      updatedAt: new Date()
    };

    if (!organizationSlug) {
      delete subscriptionSet.organizationSlug;
    } else {
      subscriptionSet.organizationSlug = String(organizationSlug);
    }

    await subscriptionsCollection.updateOne(
      { subscriptionId: String(data.id) },
      {
        $set: subscriptionSet,
        $setOnInsert: {
          organizationSlug: String(organizationSlug || ""),
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  if (data?.type === "orders" && data?.id) {
    await ordersCollection.updateOne(
      { orderId: String(data.id) },
      {
        $set: {
          orderId: String(data.id),
          status: attributes?.status || "paid",
          variantId: variantId ? String(variantId) : "",
          planInterval,
          quantity,
          customerEmail: String(customerEmail || ""),
          appUserEmail: String(appUserEmail || ""),
          customerId,
          organizationSlug: String(organizationSlug || ""),
          subtotal: attributes?.subtotal || null,
          total: attributes?.total || null,
          currency: attributes?.currency || "USD",
          lastEvent: eventName,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
