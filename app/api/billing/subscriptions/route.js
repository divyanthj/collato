import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrganizationSubscriptionSummary, resolveOrganizationForUser } from "@/lib/billing";

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationSlug = url.searchParams.get("organizationSlug") || "";
  if (!organizationSlug) {
    return NextResponse.json({ error: "Organization slug is required" }, { status: 400 });
  }

  const organization = await resolveOrganizationForUser(session.user.email, organizationSlug);
  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (organization.ownerEmail !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Only the organization owner can view billing subscriptions" }, { status: 403 });
  }

  const summary = await getOrganizationSubscriptionSummary(organization);
  return NextResponse.json(
    {
      canonical: summary.canonical,
      history: summary.history,
      hasMultipleActive: summary.hasMultipleActive,
      canMutateSafely: summary.canMutateSafely
    },
    { status: 200 }
  );
}
