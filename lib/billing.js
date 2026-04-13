import appConfig from "@/config/app";
import { getDatabase } from "@/lib/mongodb";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "on_trial", "trialing", "past_due"]);

const CURRENT_VARIANT_IDS = new Set([
  String(appConfig.lemonsqueezy.plans.monthly.variantId),
  String(appConfig.lemonsqueezy.plans.annual.variantId)
]);

const LEGACY_VARIANT_IDS = new Set(["1494935", "1494943", "1494945", "1494955", "1494956", "1494957"]);

const INTERVAL_TO_VARIANT_ID = {
  month: String(appConfig.lemonsqueezy.plans.monthly.variantId),
  year: String(appConfig.lemonsqueezy.plans.annual.variantId)
};

function isManagedBillingVariantId(variantId) {
  const normalizedVariantId = String(variantId || "");
  return CURRENT_VARIANT_IDS.has(normalizedVariantId) || LEGACY_VARIANT_IDS.has(normalizedVariantId);
}

export const BILLING_ERROR_CODES = {
  NO_ACTIVE_SUBSCRIPTION: "NO_ACTIVE_SUBSCRIPTION",
  MIGRATION_REQUIRED: "MIGRATION_REQUIRED",
  SEAT_LIMIT_REACHED: "SEAT_LIMIT_REACHED"
};

function toInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.floor(parsed);
}

function createBillingError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseDateOrNull(value) {
  if (!value) {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapSubscriptionDoc(doc) {
  return {
    id: String(doc._id),
    organizationSlug: String(doc.organizationSlug || ""),
    subscriptionId: String(doc.subscriptionId || ""),
    status: String(doc.status || "unknown"),
    quantity: toInteger(doc.quantity, 0),
    subscriptionItemId: String(doc.subscriptionItemId || ""),
    variantId: String(doc.variantId || ""),
    planInterval: String(doc.planInterval || ""),
    customerEmail: String(doc.customerEmail || ""),
    appUserEmail: String(doc.appUserEmail || ""),
    customerId: String(doc.customerId || ""),
    renewsAt: doc.renewsAt ? new Date(String(doc.renewsAt)).toISOString() : null,
    endsAt: doc.endsAt ? new Date(String(doc.endsAt)).toISOString() : null,
    currentPeriodEnd: doc.currentPeriodEnd ? new Date(String(doc.currentPeriodEnd)).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)).toISOString() : null,
    portalUrl: String(doc.portalUrl || ""),
    migrationRequired: Boolean(doc.migrationRequired),
    isLegacyVariant: Boolean(doc.isLegacyVariant),
    scheduledChange: doc.scheduledChange || null
  };
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }
  const date = new Date(String(value));
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function isSubscriptionActiveLike(subscription) {
  const status = String(subscription?.status || "").trim().toLowerCase();
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

function hasCancelableEntitlement(subscription) {
  if (isSubscriptionActiveLike(subscription)) {
    return true;
  }

  const status = String(subscription?.status || "").trim().toLowerCase();
  const periodEnd = toTimestamp(subscription?.currentPeriodEnd || subscription?.endsAt);
  const now = Date.now();

  return (status === "cancelled" || status === "canceled" || status === "expired") && periodEnd > now;
}

function getCanonicalSubscriptionSummary(subscriptions) {
  const dedupedBySubscriptionId = new Map();
  for (const subscription of subscriptions) {
    const key = String(subscription.subscriptionId || "");
    if (!key) {
      continue;
    }
    const existing = dedupedBySubscriptionId.get(key);
    if (!existing || toTimestamp(subscription.updatedAt) > toTimestamp(existing.updatedAt)) {
      dedupedBySubscriptionId.set(key, subscription);
    }
  }

  const deduped = Array.from(dedupedBySubscriptionId.values());
  const activeLike = deduped.filter((item) => isSubscriptionActiveLike(item));
  const entitlement = deduped.filter((item) => hasCancelableEntitlement(item));

  const ranked = deduped.sort((left, right) => {
    const leftActiveScore = isSubscriptionActiveLike(left) ? 2 : hasCancelableEntitlement(left) ? 1 : 0;
    const rightActiveScore = isSubscriptionActiveLike(right) ? 2 : hasCancelableEntitlement(right) ? 1 : 0;
    if (rightActiveScore !== leftActiveScore) {
      return rightActiveScore - leftActiveScore;
    }

    return toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
  });

  const canonical = ranked[0] ?? null;
  const history = ranked.slice(1);
  const hasMultipleActive = activeLike.length > 1;

  return {
    canonical,
    history,
    hasMultipleActive,
    canMutateSafely: Boolean(canonical?.subscriptionId) && !hasMultipleActive,
    activeLike,
    entitlement
  };
}

let ownerFreeSeatsCache = null;
let ownerFreeSeatsCacheSource = null;

function parseOwnerFreeSeatsConfig() {
  const raw = process.env.OWNER_FREE_SEATS_JSON || "";
  if (ownerFreeSeatsCache && ownerFreeSeatsCacheSource === raw) {
    return ownerFreeSeatsCache;
  }

  if (!raw) {
    ownerFreeSeatsCache = new Map();
    ownerFreeSeatsCacheSource = raw;
    return ownerFreeSeatsCache;
  }

  try {
    const parsed = JSON.parse(raw);
    const map = new Map();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [email, seats] of Object.entries(parsed)) {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedSeats = toInteger(seats, 0);
        if (normalizedEmail && normalizedSeats > 0) {
          map.set(normalizedEmail, normalizedSeats);
        }
      }
    }
    ownerFreeSeatsCache = map;
  } catch {
    ownerFreeSeatsCache = new Map();
  }
  ownerFreeSeatsCacheSource = raw;

  return ownerFreeSeatsCache;
}

export function getOwnerFreeSeatOverride(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return 0;
  }

  return parseOwnerFreeSeatsConfig().get(normalizedEmail) ?? 0;
}

export async function resolveOrganizationForUser(userEmail, organizationSlug) {
  const normalizedUserEmail = String(userEmail || "").trim().toLowerCase();
  const db = await getDatabase();
  const organizationsCollection = db.collection("organizations");
  const activeMembershipClause = {
    members: {
      $elemMatch: {
        email: normalizedUserEmail,
        status: "active"
      }
    }
  };

  let organization;
  if (organizationSlug) {
    organization = await organizationsCollection.findOne({
      slug: organizationSlug,
      $or: [{ ownerEmail: normalizedUserEmail }, activeMembershipClause]
    });
  } else {
    const organizations = await organizationsCollection
      .find({ $or: [{ ownerEmail: normalizedUserEmail }, activeMembershipClause] })
      .sort({ createdAt: 1 })
      .toArray();
    organization =
      organizations.find((item) => String(item.ownerEmail || "").toLowerCase() === normalizedUserEmail) ??
      organizations[0] ??
      null;
  }

  return organization
    ? {
        slug: String(organization.slug),
        name: String(organization.name || "Organization"),
        ownerEmail: String(organization.ownerEmail || ""),
        members: Array.isArray(organization.members) ? organization.members : []
      }
    : null;
}

export async function getSubscriptionForOrganization(organizationSlug) {
  const summary = await getOrganizationSubscriptionSummary({
    slug: String(organizationSlug || ""),
    ownerEmail: ""
  });
  return summary.canonical;
}

async function getSubscriptionForCustomerEmail(customerEmail) {
  const subscriptions = await getActiveSubscriptionsForCustomerEmail(customerEmail);
  return subscriptions[0] ?? null;
}

async function getSubscriptionsForOrganization(organizationSlug) {
  if (!organizationSlug) {
    return [];
  }

  const db = await getDatabase();
  const subscriptionsCollection = db.collection("billing_subscriptions");
  const docs = await subscriptionsCollection
    .find({ organizationSlug: String(organizationSlug) })
    .sort({ updatedAt: -1 })
    .toArray();

  return docs
    .map(mapSubscriptionDoc)
    .filter((subscription) => isManagedBillingVariantId(subscription.variantId));
}

async function hydrateOrganizationSubscriptions(organization) {
  const normalizedOwnerEmail = String(organization?.ownerEmail || "").trim().toLowerCase();
  let subscriptions = await getSubscriptionsForOrganization(organization?.slug);

  if (normalizedOwnerEmail) {
    const emailSubscriptions = await getActiveSubscriptionsForCustomerEmail(normalizedOwnerEmail);
    if (emailSubscriptions.length > 0) {
      const eligibleEmailSubscriptions = emailSubscriptions.filter(
        (subscription) => !subscription.organizationSlug || subscription.organizationSlug === String(organization?.slug || "")
      );

      const mergedBySubscriptionId = new Map();
      for (const subscription of subscriptions) {
        mergedBySubscriptionId.set(subscription.subscriptionId, subscription);
      }
      for (const subscription of eligibleEmailSubscriptions) {
        const existing = mergedBySubscriptionId.get(subscription.subscriptionId);
        if (!existing || toTimestamp(subscription.updatedAt) >= toTimestamp(existing.updatedAt)) {
          mergedBySubscriptionId.set(subscription.subscriptionId, subscription);
        }
      }
      subscriptions = Array.from(mergedBySubscriptionId.values());

      if (organization?.slug) {
        const unlinkedEmailSubscriptions = eligibleEmailSubscriptions.filter(
          (subscription) => !subscription.organizationSlug
        );

        if (unlinkedEmailSubscriptions.length > 0) {
          const db = await getDatabase();
          const subscriptionsCollection = db.collection("billing_subscriptions");
          await subscriptionsCollection.updateMany(
            {
              subscriptionId: { $in: unlinkedEmailSubscriptions.map((subscription) => subscription.subscriptionId) },
              $or: [{ organizationSlug: { $exists: false } }, { organizationSlug: "" }]
            },
            {
              $set: {
                organizationSlug: String(organization.slug),
                updatedAt: new Date()
              }
            }
          );
        }
      }
    }
  }

  const hasEntitlement = getCanonicalSubscriptionSummary(subscriptions).entitlement.length > 0;
  if (normalizedOwnerEmail && !hasEntitlement) {
    const lemonSubscriptions = await getLemonSubscriptionsForCustomerEmail(normalizedOwnerEmail);
    const eligibleLemonSubscriptions = lemonSubscriptions.filter(
      (subscription) => !subscription.organizationSlug || subscription.organizationSlug === String(organization?.slug || "")
    );

    if (eligibleLemonSubscriptions.length > 0) {
      const mergedBySubscriptionId = new Map();
      for (const subscription of subscriptions) {
        mergedBySubscriptionId.set(subscription.subscriptionId, subscription);
      }
      for (const subscription of eligibleLemonSubscriptions) {
        const existing = mergedBySubscriptionId.get(subscription.subscriptionId);
        const shouldReplace =
          !existing ||
          (hasCancelableEntitlement(subscription) && !hasCancelableEntitlement(existing)) ||
          toTimestamp(subscription.updatedAt) >= toTimestamp(existing.updatedAt);
        if (shouldReplace) {
          mergedBySubscriptionId.set(subscription.subscriptionId, subscription);
        }
      }
      subscriptions = Array.from(mergedBySubscriptionId.values());
    }
  }

  return subscriptions;
}

export async function getOrganizationSubscriptionSummary(organization) {
  let subscriptions = await hydrateOrganizationSubscriptions(organization);
  let summary = getCanonicalSubscriptionSummary(subscriptions);
  const scheduledChange = summary.canonical?.scheduledChange || null;
  const scheduledEffectiveAt = scheduledChange?.effectiveAt ? toTimestamp(scheduledChange.effectiveAt) : 0;
  const shouldApplyScheduledSeatDowngrade =
    scheduledChange?.type === "seat_downgrade_at_renewal" &&
    Number.isFinite(scheduledEffectiveAt) &&
    scheduledEffectiveAt <= Date.now() &&
    Boolean(summary.canonical?.subscriptionId);

  if (shouldApplyScheduledSeatDowngrade) {
    try {
      const currentQuantity = Math.max(toInteger(summary.canonical?.quantity, 0), 1);
      const targetQuantity = Math.max(toInteger(scheduledChange.quantity, currentQuantity), 1);
      const seatDelta = targetQuantity - currentQuantity;

      if (seatDelta !== 0) {
        const updated = await updateLemonSubscriptionFromApp({
          subscriptionId: summary.canonical.subscriptionId,
          interval: summary.canonical.planInterval || "month",
          seatDelta
        });

        const db = await getDatabase();
        await db.collection("billing_subscriptions").updateOne(
          { subscriptionId: updated.subscriptionId },
          {
            $set: {
              organizationSlug: String(organization?.slug || ""),
              status: updated.status,
              subscriptionItemId: updated.subscriptionItemId,
              variantId: updated.variantId,
              planInterval: updated.planInterval,
              quantity: updated.quantity,
              renewsAt: updated.renewsAt,
              endsAt: updated.endsAt,
              currentPeriodEnd: updated.currentPeriodEnd,
              portalUrl: updated.portalUrl,
              isLegacyVariant: updated.isLegacyVariant,
              migrationRequired: updated.migrationRequired,
              scheduledChange: null,
              lastEvent: "auto_apply_scheduled_downgrade",
              updatedAt: new Date()
            }
          }
        );
      } else {
        const db = await getDatabase();
        await db.collection("billing_subscriptions").updateOne(
          { subscriptionId: summary.canonical.subscriptionId },
          {
            $set: {
              scheduledChange: null,
              lastEvent: "auto_clear_scheduled_downgrade",
              updatedAt: new Date()
            }
          }
        );
      }

      subscriptions = await hydrateOrganizationSubscriptions(organization);
      summary = getCanonicalSubscriptionSummary(subscriptions);
    } catch {
      // Keep current summary if auto-apply fails; next refresh can retry.
    }
  }

  return summary;
}

async function getActiveSubscriptionsForCustomerEmail(customerEmail) {
  const normalizedEmail = String(customerEmail || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return [];
  }

  const db = await getDatabase();
  const subscriptionsCollection = db.collection("billing_subscriptions");
  const docs = await subscriptionsCollection
    .find({
      $or: [{ customerEmail: normalizedEmail }, { appUserEmail: normalizedEmail }],
      status: { $in: [...ACTIVE_SUBSCRIPTION_STATUSES] }
    })
    .sort({ updatedAt: -1 })
    .toArray();

  return docs
    .map(mapSubscriptionDoc)
    .filter((subscription) => isManagedBillingVariantId(subscription.variantId));
}

function mapLemonSubscriptionListItem(data) {
  const attributes = data?.attributes || {};
  const mapped = mapLemonSubscriptionData(data, String(data?.id || ""));
  const updatedAt = parseDateOrNull(attributes?.updated_at);
  const renewsAt = parseDateOrNull(attributes?.renews_at);
  const endsAt = parseDateOrNull(attributes?.ends_at);

  return {
    ...mapped,
    organizationSlug: "",
    customerEmail: String(attributes?.user_email || "").trim().toLowerCase(),
    renewsAt: renewsAt ? renewsAt.toISOString() : null,
    endsAt: endsAt ? endsAt.toISOString() : null,
    currentPeriodEnd: renewsAt ? renewsAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  };
}

async function getLemonSubscriptionsForCustomerEmail(customerEmail) {
  const normalizedEmail = String(customerEmail || "").trim().toLowerCase();
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!normalizedEmail || !apiKey) {
    return [];
  }

  const endpoint = `https://api.lemonsqueezy.com/v1/subscriptions?filter[user_email]=${encodeURIComponent(normalizedEmail)}&page[size]=100`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  const payload = await readLemonPayload(response);
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return items
    .filter((item) => isManagedBillingVariantId(item?.attributes?.variant_id))
    .map((item) => mapLemonSubscriptionListItem(item));
}

export function getUsedSeatsFromOrganization(organization) {
  return (organization?.members ?? []).filter((member) => member?.status === "active").length;
}

function resolvePlanInterval(subscriptions, fallback = null) {
  const intervals = new Set(
    subscriptions.map((subscription) => String(subscription.planInterval || "").trim()).filter(Boolean)
  );

  if (intervals.size === 1) {
    return Array.from(intervals)[0];
  }

  return fallback;
}

export async function getBillingStatusForOrganization(organization) {
  const normalizedOwnerEmail = String(organization?.ownerEmail || "").trim().toLowerCase();
  const subscriptionSummary = await getOrganizationSubscriptionSummary(organization);
  const subscriptions = [...subscriptionSummary.activeLike, ...subscriptionSummary.history];
  const ownerFreeSeats = getOwnerFreeSeatOverride(normalizedOwnerEmail);
  const usedSeats = getUsedSeatsFromOrganization(organization);
  let activeSubscriptions = subscriptionSummary.entitlement;
  const primarySubscription = subscriptionSummary.canonical ?? subscriptions[0] ?? null;
  if (activeSubscriptions.length === 0 && primarySubscription && hasCancelableEntitlement(primarySubscription)) {
    activeSubscriptions = [primarySubscription];
  }

  const hasMultipleActiveSubscriptions = subscriptionSummary.hasMultipleActive;
  const paidSeats = activeSubscriptions.reduce((sum, subscription) => sum + Math.max(subscription.quantity, 0), 0);
  const quantity = ownerFreeSeats + paidSeats;
  const active = quantity > 0;
  const remainingSeats = Math.max(quantity - usedSeats, 0);
  const source =
    ownerFreeSeats > 0 && paidSeats > 0
      ? "hybrid"
      : ownerFreeSeats > 0
        ? "owner_override"
        : paidSeats > 0
          ? "subscription"
          : "none";
  const ownerOverrideApplied = ownerFreeSeats > 0;
  const migrationRequired = activeSubscriptions.some((subscription) => Boolean(subscription.migrationRequired));
  const isLegacyVariant = activeSubscriptions.some((subscription) => Boolean(subscription.isLegacyVariant));
  const canMutateSafely = primarySubscription ? subscriptionSummary.canMutateSafely : false;
  const planInterval =
    paidSeats > 0
      ? resolvePlanInterval(activeSubscriptions, primarySubscription?.planInterval || null)
      : ownerFreeSeats > 0
        ? "owner_override"
        : null;
  const status = active ? "active" : primarySubscription?.status || "none";

  let billingStateMessage = "No active subscription.";
  if (primarySubscription?.status === "cancelled" || primarySubscription?.status === "canceled") {
    billingStateMessage = primarySubscription.currentPeriodEnd
      ? `Cancelled. Access remains until ${new Date(primarySubscription.currentPeriodEnd).toLocaleDateString()}.`
      : "Cancelled.";
  } else if (active) {
    billingStateMessage =
      source === "hybrid"
        ? `Active subscription plus ${ownerFreeSeats} owner-granted free seat${ownerFreeSeats === 1 ? "" : "s"}.`
        : source === "owner_override"
          ? "Owner access override is enabled for this organization."
          : "Active subscription.";
  }

  return {
    active,
    source,
    ownerOverrideApplied,
    ownerFreeSeats,
    paidSeats,
    quantity,
    usedSeats,
    remainingSeats,
    planInterval,
    status,
    migrationRequired,
    isLegacyVariant,
    scheduledChange: hasMultipleActiveSubscriptions ? null : primarySubscription?.scheduledChange || null,
    subscriptionId: hasMultipleActiveSubscriptions ? null : primarySubscription?.subscriptionId ?? null,
    customerEmail: primarySubscription?.customerEmail || normalizedOwnerEmail || "",
    portalUrl: hasMultipleActiveSubscriptions ? "" : primarySubscription?.portalUrl || "",
    currentPeriodEnd: hasMultipleActiveSubscriptions ? null : primarySubscription?.currentPeriodEnd ?? null,
    canonicalSubscription: primarySubscription,
    subscriptionHistory: subscriptionSummary.history,
    hasMultipleActiveSubscriptions,
    canMutateSafely,
    billingStateMessage
  };
}

export async function getBillingStatusForUserWithoutOrganization(userEmail) {
  const normalizedUserEmail = String(userEmail || "").trim().toLowerCase();
  const ownerFreeSeats = getOwnerFreeSeatOverride(normalizedUserEmail);

  let subscription = await getSubscriptionForCustomerEmail(normalizedUserEmail);
  if (!subscription) {
    const lemonSubscriptions = await getLemonSubscriptionsForCustomerEmail(normalizedUserEmail);
    const summary = getCanonicalSubscriptionSummary(lemonSubscriptions);
    subscription = summary.canonical;
  }

  const hasSubscriptionEntitlement = Boolean(subscription) && hasCancelableEntitlement(subscription);
  const paidSeats = hasSubscriptionEntitlement ? Math.max(subscription.quantity, 0) : 0;
  const quantity = ownerFreeSeats + paidSeats;
  const active = quantity > 0;
  const source =
    ownerFreeSeats > 0 && paidSeats > 0
      ? "hybrid"
      : ownerFreeSeats > 0
        ? "owner_override"
        : paidSeats > 0
          ? "subscription"
          : "none";

  return {
    active,
    source,
    ownerOverrideApplied: ownerFreeSeats > 0,
    ownerFreeSeats,
    paidSeats,
    quantity,
    usedSeats: 0,
    remainingSeats: quantity,
    planInterval: paidSeats > 0 ? subscription.planInterval || null : ownerFreeSeats > 0 ? "owner_override" : null,
    status: active ? "active" : subscription?.status || "none",
    migrationRequired: paidSeats > 0 ? Boolean(subscription?.migrationRequired) : false,
    isLegacyVariant: paidSeats > 0 ? Boolean(subscription?.isLegacyVariant) : false,
    scheduledChange: paidSeats > 0 ? subscription?.scheduledChange || null : null,
    subscriptionId: paidSeats > 0 ? subscription?.subscriptionId || null : null,
    customerEmail: subscription?.customerEmail || normalizedUserEmail,
    portalUrl: paidSeats > 0 ? subscription?.portalUrl || "" : "",
    currentPeriodEnd: paidSeats > 0 ? subscription?.currentPeriodEnd || null : null
  };
}

export async function getCheckoutRequirementForUser({ userEmail, organization }) {
  if (!userEmail) {
    return { requiresCheckout: false, billingStatus: null };
  }

  const billingStatus = organization
    ? await getBillingStatusForOrganization(organization)
    : await getBillingStatusForUserWithoutOrganization(userEmail);

  const requiresCheckout = !billingStatus.active || billingStatus.migrationRequired;

  return { requiresCheckout, billingStatus };
}

export async function assertUserCanCreateOrganization(userEmail) {
  const { requiresCheckout, billingStatus } = await getCheckoutRequirementForUser({
    userEmail,
    organization: null
  });

  if (requiresCheckout) {
    throw createBillingError(
      "A paid subscription is required before creating an organization.",
      BILLING_ERROR_CODES.NO_ACTIVE_SUBSCRIPTION
    );
  }

  return billingStatus;
}

export async function assertOrganizationCanAddSeat(organization, additionalSeats = 1) {
  const status = await getBillingStatusForOrganization(organization);

  if (status.migrationRequired) {
    throw createBillingError(
      "Legacy billing plan detected. Please migrate to the current Monthly/Annual plans before adding members.",
      BILLING_ERROR_CODES.MIGRATION_REQUIRED
    );
  }

  if (!status.active) {
    throw createBillingError(
      "No active billing subscription found. Please choose a plan before adding members.",
      BILLING_ERROR_CODES.NO_ACTIVE_SUBSCRIPTION
    );
  }

  if (status.remainingSeats < additionalSeats) {
    throw createBillingError(
      "Seat limit reached for your organization. Upgrade your plan or add more seats to continue.",
      BILLING_ERROR_CODES.SEAT_LIMIT_REACHED
    );
  }

  return status;
}

export async function createLemonCheckoutUrl({
  userEmail,
  interval,
  quantity,
  organizationSlug,
  mode = "new_subscription",
  redirectUrl = ""
}) {
  const normalizedInterval = interval === "year" ? "year" : "month";
  const variantId = INTERVAL_TO_VARIANT_ID[normalizedInterval];
  const storeId = process.env.LEMONSQUEEZY_STORE_ID || appConfig.lemonsqueezy.storeId;
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const normalizedUserEmail = String(userEmail || "").trim();
  const normalizedOrganizationSlug = String(organizationSlug ?? "").trim();
  const normalizedMode = String(mode || "new_subscription");
  const normalizedRedirectUrl = String(redirectUrl || "").trim();

  if (!variantId || !storeId || !apiKey) {
    throw new Error("Billing is not configured");
  }

  const parsedQuantity = toInteger(quantity, 1);
  if (parsedQuantity < 1) {
    throw new Error("Quantity must be at least 1");
  }

  const customData = {
    userEmail: normalizedUserEmail,
    quantity: String(parsedQuantity),
    interval: normalizedInterval,
    mode: normalizedMode
  };

  if (normalizedOrganizationSlug) {
    customData.organizationSlug = normalizedOrganizationSlug;
  }

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: normalizedUserEmail,
          custom: customData,
          variant_quantities: [
            {
              variant_id: Number(variantId),
              quantity: parsedQuantity
            }
          ]
        },
        checkout_options: {
          embed: false,
          media: false,
          logo: false
        },
        product_options: {
          redirect_url: normalizedRedirectUrl || `${appUrl}/dashboard/organization`
        }
      },
      relationships: {
        store: {
          data: {
            type: "stores",
            id: String(storeId)
          }
        },
        variant: {
          data: {
            type: "variants",
            id: String(variantId)
          }
        }
      }
    }
  };

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.errors?.[0]?.detail || "Could not create checkout");
  }

  const url = result?.data?.attributes?.url;
  if (!url) {
    throw new Error("Checkout URL missing from response");
  }

  return url;
}

export async function createPortalUrlFromSubscription(subscription) {
  if (subscription?.portalUrl) {
    return subscription.portalUrl;
  }

  if (!subscription?.subscriptionId) {
    return null;
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscription.subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json"
    }
  });

  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  return result?.data?.attributes?.urls?.customer_portal || null;
}

async function readLemonPayload(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getLemonErrorMessage(payload, fallback) {
  return payload?.errors?.[0]?.detail || fallback;
}

async function getLemonSubscription(subscriptionId) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("Billing is not configured");
  }

  const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json"
    }
  });
  const payload = await readLemonPayload(response);
  if (!response.ok) {
    throw new Error(getLemonErrorMessage(payload, "Could not load subscription from Lemon Squeezy"));
  }

  return payload?.data || null;
}

function mapLemonSubscriptionData(data, fallbackSubscriptionId = "") {
  const attributes = data?.attributes || {};
  const variantId = String(attributes?.variant_id || "");
  const variantMeta = getVariantBillingMeta(variantId);
  const firstItem = attributes?.first_subscription_item || {};
  const quantity = toInteger(firstItem?.quantity, 0);

  return {
    subscriptionId: String(data?.id || fallbackSubscriptionId),
    status: String(attributes?.status || "unknown"),
    subscriptionItemId: firstItem?.id ? String(firstItem.id) : "",
    variantId,
    planInterval: variantMeta.planInterval,
    quantity: quantity > 0 ? quantity : 1,
    renewsAt: parseDateOrNull(attributes?.renews_at),
    endsAt: parseDateOrNull(attributes?.ends_at),
    currentPeriodEnd: parseDateOrNull(attributes?.renews_at),
    portalUrl: String(attributes?.urls?.customer_portal || ""),
    isLegacyVariant: variantMeta.isLegacyVariant,
    migrationRequired: variantMeta.migrationRequired
  };
}

async function patchLemonSubscriptionAttributes(subscriptionId, attributes, fallbackMessage) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("Billing is not configured");
  }

  const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json"
    },
    body: JSON.stringify({
      data: {
        type: "subscriptions",
        id: String(subscriptionId),
        attributes
      }
    })
  });
  const payload = await readLemonPayload(response);
  if (!response.ok) {
    throw new Error(getLemonErrorMessage(payload, fallbackMessage));
  }

  return payload?.data || null;
}

export async function setLemonSubscriptionCancelAtPeriodEnd({ subscriptionId, cancelAtPeriodEnd }) {
  const attempts = cancelAtPeriodEnd
    ? [{ cancel_at_end: true }, { cancelled: true }]
    : [{ cancel_at_end: false }, { cancelled: false }];

  let latestError = null;
  for (const attemptAttributes of attempts) {
    try {
      const patched = await patchLemonSubscriptionAttributes(
        subscriptionId,
        attemptAttributes,
        "Could not update cancellation state in Lemon Squeezy"
      );
      const refreshed = patched || (await getLemonSubscription(subscriptionId));
      return mapLemonSubscriptionData(refreshed, subscriptionId);
    } catch (error) {
      latestError = error;
    }
  }

  throw latestError ?? new Error("Could not update cancellation state in Lemon Squeezy");
}

export async function updateLemonSubscriptionFromApp({ subscriptionId, interval, seatDelta }) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("Billing is not configured");
  }

  const normalizedInterval = interval === "year" ? "year" : "month";
  const targetVariantId = INTERVAL_TO_VARIANT_ID[normalizedInterval];
  const parsedSeatDelta = toInteger(seatDelta, 0);
  if (!targetVariantId) {
    throw new Error("Invalid subscription change request");
  }

  let subscriptionData = await getLemonSubscription(subscriptionId);
  if (!subscriptionData?.id) {
    throw new Error("Subscription not found in Lemon Squeezy");
  }

  const currentVariantId = String(subscriptionData?.attributes?.variant_id || "");
  if (currentVariantId !== String(targetVariantId)) {
    const switchPayload = {
      data: {
        type: "subscriptions",
        id: String(subscriptionId),
        attributes: {
          variant_id: Number(targetVariantId)
        }
      }
    };

    const switchResponse = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json"
      },
      body: JSON.stringify(switchPayload)
    });
    const switchResult = await readLemonPayload(switchResponse);
    if (!switchResponse.ok) {
      throw new Error(getLemonErrorMessage(switchResult, "Could not switch subscription interval"));
    }

    subscriptionData = switchResult?.data || (await getLemonSubscription(subscriptionId));
  }

  const firstItem = subscriptionData?.attributes?.first_subscription_item || {};
  const subscriptionItemId = firstItem?.id ? String(firstItem.id) : "";
  const currentQuantity = toInteger(firstItem?.quantity, 0);
  if (!subscriptionItemId) {
    throw new Error("Subscription item not found for quantity update");
  }
  const targetQuantity = Math.max(currentQuantity + parsedSeatDelta, 1);

  if (currentQuantity !== targetQuantity) {
    const quantityPayload = {
      data: {
        type: "subscription-items",
        id: subscriptionItemId,
        attributes: {
          quantity: targetQuantity,
          invoice_immediately: parsedSeatDelta > 0,
          disable_prorations: false
        }
      }
    };

    const quantityResponse = await fetch(`https://api.lemonsqueezy.com/v1/subscription-items/${subscriptionItemId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json"
      },
      body: JSON.stringify(quantityPayload)
    });
    const quantityResult = await readLemonPayload(quantityResponse);
    if (!quantityResponse.ok) {
      throw new Error(getLemonErrorMessage(quantityResult, "Could not update subscription quantity"));
    }
  }

  const refreshedData = await getLemonSubscription(subscriptionId);
  const mapped = mapLemonSubscriptionData(refreshedData, subscriptionId);
  return {
    ...mapped,
    quantity: mapped.quantity > 0 ? mapped.quantity : targetQuantity
  };
}

export function getVariantBillingMeta(variantId) {
  const normalizedVariantId = String(variantId || "");
  const isCurrentVariant = CURRENT_VARIANT_IDS.has(normalizedVariantId);
  const isLegacyVariant = LEGACY_VARIANT_IDS.has(normalizedVariantId);
  const planInterval =
    normalizedVariantId === INTERVAL_TO_VARIANT_ID.month
      ? "month"
      : normalizedVariantId === INTERVAL_TO_VARIANT_ID.year
        ? "year"
        : null;

  return {
    isManagedVariant: isManagedBillingVariantId(normalizedVariantId),
    isCurrentVariant,
    isLegacyVariant,
    migrationRequired: isLegacyVariant,
    planInterval
  };
}
