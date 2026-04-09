import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrganizationSubscriptionSummary, resolveOrganizationForUser, setLemonSubscriptionCancelAtPeriodEnd } from "@/lib/billing";
import { getDatabase } from "@/lib/mongodb";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const organizationSlug = typeof body.organizationSlug === "string" ? body.organizationSlug.trim() : "";
  if (!organizationSlug) {
    return NextResponse.json({ error: "Organization slug is required" }, { status: 400 });
  }

  const organization = await resolveOrganizationForUser(session.user.email, organizationSlug);
  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (organization.ownerEmail !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Only the organization owner can manage billing" }, { status: 403 });
  }

  const summary = await getOrganizationSubscriptionSummary(organization);
  if (!summary.canMutateSafely || !summary.canonical?.subscriptionId) {
    return NextResponse.json(
      { error: "Cannot safely mutate billing while multiple active subscriptions exist." },
      { status: 409 }
    );
  }

  try {
    const updated = await setLemonSubscriptionCancelAtPeriodEnd({
      subscriptionId: summary.canonical.subscriptionId,
      cancelAtPeriodEnd: true
    });

    const db = await getDatabase();
    const subscriptionsCollection = db.collection("billing_subscriptions");
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
          customerEmail: summary.canonical.customerEmail || session.user.email,
          customerId: summary.canonical.customerId || "",
          renewsAt: updated.renewsAt,
          endsAt: updated.endsAt,
          currentPeriodEnd: updated.currentPeriodEnd,
          portalUrl: updated.portalUrl,
          isLegacyVariant: updated.isLegacyVariant,
          migrationRequired: updated.migrationRequired,
          lastEvent: "manual_cancel",
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel subscription";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
