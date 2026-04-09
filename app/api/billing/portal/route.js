import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createPortalUrlFromSubscription, getOrganizationSubscriptionSummary, resolveOrganizationForUser } from "@/lib/billing";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const organizationSlug = typeof body.organizationSlug === "string" ? body.organizationSlug.trim() : "";
  const organization = await resolveOrganizationForUser(session.user.email, organizationSlug);

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (organization.ownerEmail !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Only the organization owner can manage billing" }, { status: 403 });
  }

  const summary = await getOrganizationSubscriptionSummary(organization);
  const subscription = summary.canonical;
  if (!subscription) {
    return NextResponse.json({ error: "No subscription found for this organization" }, { status: 404 });
  }

  const portalUrl = await createPortalUrlFromSubscription(subscription);
  if (!portalUrl) {
    return NextResponse.json({ error: "Could not generate billing portal URL" }, { status: 400 });
  }

  return NextResponse.json({ url: portalUrl }, { status: 200 });
}
