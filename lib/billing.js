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

let ownerFreeSeatsCache = null;

function parseOwnerFreeSeatsConfig() {
  if (ownerFreeSeatsCache) {
    return ownerFreeSeatsCache;
  }

  const raw = process.env.OWNER_FREE_SEATS_JSON;
  if (!raw) {
    ownerFreeSeatsCache = new Map();
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

  let organization;
  if (organizationSlug) {
    organization = await organizationsCollection.findOne({
      slug: organizationSlug,
      $or: [{ ownerEmail: normalizedUserEmail }, { "members.email": normalizedUserEmail }]
    });
  } else {
    const organizations = await organizationsCollection
      .find({ $or: [{ ownerEmail: normalizedUserEmail }, { "members.email": normalizedUserEmail }] })
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
  if (!organizationSlug) {
    return null;
  }

  const db = await getDatabase();
  const subscriptionsCollection = db.collection("billing_subscriptions");
  const doc = await subscriptionsCollection.findOne(
    { organizationSlug: String(organizationSlug) },
    { sort: { updatedAt: -1 } }
  );

  if (!doc) {
    return null;
  }

  return {
    id: String(doc._id),
    organizationSlug: String(doc.organizationSlug || ""),
    subscriptionId: String(doc.subscriptionId || ""),
    status: String(doc.status || "unknown"),
    quantity: toInteger(doc.quantity, 0),
    variantId: String(doc.variantId || ""),
    planInterval: String(doc.planInterval || ""),
    customerEmail: String(doc.customerEmail || ""),
    customerId: String(doc.customerId || ""),
    currentPeriodEnd: doc.currentPeriodEnd ? new Date(String(doc.currentPeriodEnd)).toISOString() : null,
    portalUrl: String(doc.portalUrl || ""),
    migrationRequired: Boolean(doc.migrationRequired),
    isLegacyVariant: Boolean(doc.isLegacyVariant),
    scheduledChange: doc.scheduledChange || null
  };
}

async function getSubscriptionForCustomerEmail(customerEmail) {
  const normalizedEmail = String(customerEmail || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const db = await getDatabase();
  const subscriptionsCollection = db.collection("billing_subscriptions");
  const doc = await subscriptionsCollection.findOne(
    {
      customerEmail: normalizedEmail,
      status: { $in: [...ACTIVE_SUBSCRIPTION_STATUSES] }
    },
    { sort: { updatedAt: -1 } }
  );

  if (!doc) {
    return null;
  }

  return {
    id: String(doc._id),
    organizationSlug: String(doc.organizationSlug || ""),
    subscriptionId: String(doc.subscriptionId || ""),
    status: String(doc.status || "unknown"),
    quantity: toInteger(doc.quantity, 0),
    variantId: String(doc.variantId || ""),
    planInterval: String(doc.planInterval || ""),
    customerEmail: String(doc.customerEmail || ""),
    customerId: String(doc.customerId || ""),
    currentPeriodEnd: doc.currentPeriodEnd ? new Date(String(doc.currentPeriodEnd)).toISOString() : null,
    portalUrl: String(doc.portalUrl || ""),
    migrationRequired: Boolean(doc.migrationRequired),
    isLegacyVariant: Boolean(doc.isLegacyVariant),
    scheduledChange: doc.scheduledChange || null
  };
}

export function getUsedSeatsFromOrganization(organization) {
  return (organization?.members ?? []).filter((member) => member?.status === "active").length;
}

export async function getBillingStatusForOrganization(organization) {
  const normalizedOwnerEmail = String(organization?.ownerEmail || "").trim().toLowerCase();
  let subscription = await getSubscriptionForOrganization(organization?.slug);
  const ownerFreeSeats = getOwnerFreeSeatOverride(normalizedOwnerEmail);
  const usedSeats = getUsedSeatsFromOrganization(organization);

  if (!subscription && normalizedOwnerEmail) {
    const emailSubscription = await getSubscriptionForCustomerEmail(normalizedOwnerEmail);
    if (emailSubscription) {
      subscription = emailSubscription;

      if (!emailSubscription.organizationSlug && organization?.slug) {
        const db = await getDatabase();
        const subscriptionsCollection = db.collection("billing_subscriptions");
        await subscriptionsCollection.updateOne(
          { subscriptionId: emailSubscription.subscriptionId },
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

  if (!subscription && ownerFreeSeats > 0) {
    const quantity = ownerFreeSeats;
    const remainingSeats = Math.max(quantity - usedSeats, 0);

    return {
      active: true,
      source: "owner_override",
      ownerOverrideApplied: true,
      quantity,
      usedSeats,
      remainingSeats,
      planInterval: "owner_override",
      status: "active",
      migrationRequired: false,
      isLegacyVariant: false,
      scheduledChange: null,
      subscriptionId: null,
      customerEmail: normalizedOwnerEmail,
      portalUrl: "",
      currentPeriodEnd: null
    };
  }

  if (!subscription) {
    return {
      active: false,
      source: "none",
      ownerOverrideApplied: false,
      quantity: 0,
      usedSeats,
      remainingSeats: 0,
      planInterval: null,
      status: "none",
      migrationRequired: false,
      isLegacyVariant: false,
      scheduledChange: null,
      subscriptionId: null,
      customerEmail: ""
    };
  }

  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  const quantity = Math.max(subscription.quantity, 0);
  const remainingSeats = Math.max(quantity - usedSeats, 0);

  return {
    active,
    source: "subscription",
    ownerOverrideApplied: false,
    quantity,
    usedSeats,
    remainingSeats,
    planInterval: subscription.planInterval || null,
    status: subscription.status,
    migrationRequired: Boolean(subscription.migrationRequired),
    isLegacyVariant: Boolean(subscription.isLegacyVariant),
    scheduledChange: subscription.scheduledChange || null,
    subscriptionId: subscription.subscriptionId || null,
    customerEmail: subscription.customerEmail || "",
    portalUrl: subscription.portalUrl || "",
    currentPeriodEnd: subscription.currentPeriodEnd || null
  };
}

export async function getBillingStatusForUserWithoutOrganization(userEmail) {
  const normalizedUserEmail = String(userEmail || "").trim().toLowerCase();
  const ownerFreeSeats = getOwnerFreeSeatOverride(normalizedUserEmail);
  if (ownerFreeSeats > 0) {
    return {
      active: true,
      source: "owner_override",
      ownerOverrideApplied: true,
      quantity: ownerFreeSeats,
      usedSeats: 0,
      remainingSeats: ownerFreeSeats,
      planInterval: "owner_override",
      status: "active",
      migrationRequired: false,
      isLegacyVariant: false,
      scheduledChange: null,
      subscriptionId: null,
      customerEmail: normalizedUserEmail,
      portalUrl: "",
      currentPeriodEnd: null
    };
  }

  const subscription = await getSubscriptionForCustomerEmail(normalizedUserEmail);
  if (!subscription) {
    return {
      active: false,
      source: "none",
      ownerOverrideApplied: false,
      quantity: 0,
      usedSeats: 0,
      remainingSeats: 0,
      planInterval: null,
      status: "none",
      migrationRequired: false,
      isLegacyVariant: false,
      scheduledChange: null,
      subscriptionId: null,
      customerEmail: normalizedUserEmail,
      portalUrl: "",
      currentPeriodEnd: null
    };
  }

  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  return {
    active,
    source: "subscription",
    ownerOverrideApplied: false,
    quantity: Math.max(subscription.quantity, 0),
    usedSeats: 0,
    remainingSeats: Math.max(subscription.quantity, 0),
    planInterval: subscription.planInterval || null,
    status: subscription.status,
    migrationRequired: Boolean(subscription.migrationRequired),
    isLegacyVariant: Boolean(subscription.isLegacyVariant),
    scheduledChange: subscription.scheduledChange || null,
    subscriptionId: subscription.subscriptionId || null,
    customerEmail: subscription.customerEmail || normalizedUserEmail,
    portalUrl: subscription.portalUrl || "",
    currentPeriodEnd: subscription.currentPeriodEnd || null
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

export async function createLemonCheckoutUrl({ userEmail, interval, quantity, organizationSlug, mode = "new_subscription" }) {
  const normalizedInterval = interval === "year" ? "year" : "month";
  const variantId = INTERVAL_TO_VARIANT_ID[normalizedInterval];
  const storeId = process.env.LEMONSQUEEZY_STORE_ID || appConfig.lemonsqueezy.storeId;
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const normalizedUserEmail = String(userEmail || "").trim();
  const normalizedOrganizationSlug = String(organizationSlug ?? "").trim();
  const normalizedMode = String(mode || "new_subscription");

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
          redirect_url: `${appUrl}/dashboard/organization`
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

export function getVariantBillingMeta(variantId) {
  const normalizedVariantId = String(variantId || "");
  const isCurrentVariant = CURRENT_VARIANT_IDS.has(normalizedVariantId);
  const isLegacyVariant = LEGACY_VARIANT_IDS.has(normalizedVariantId) || (!isCurrentVariant && normalizedVariantId !== "");
  const planInterval =
    normalizedVariantId === INTERVAL_TO_VARIANT_ID.month
      ? "month"
      : normalizedVariantId === INTERVAL_TO_VARIANT_ID.year
        ? "year"
        : null;

  return {
    isCurrentVariant,
    isLegacyVariant,
    migrationRequired: isLegacyVariant,
    planInterval
  };
}
