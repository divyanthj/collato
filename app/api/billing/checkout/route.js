import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createLemonCheckoutUrl, getBillingStatusForOrganization, resolveOrganizationForUser } from "@/lib/billing";

export async function POST(request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const interval = typeof body.interval === "string" ? body.interval : "";
  const quantity = Number(body.quantity);
  const mode = typeof body.mode === "string" ? body.mode : "new_subscription";
  const organizationSlug = typeof body.organizationSlug === "string" ? body.organizationSlug.trim() : "";
  const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo.trim() : "";
  const expectedUserEmail = typeof body.expectedUserEmail === "string" ? body.expectedUserEmail.trim().toLowerCase() : "";
  const safeRedirectTo = redirectTo.startsWith("/") ? redirectTo : "";
  const sessionEmail = session.user.email.toLowerCase();

  if (!["month", "year"].includes(interval)) {
    return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Quantity must be an integer greater than 0" }, { status: 400 });
  }

  if (!["new_subscription", "upgrade_quantity", "switch_plan", "migrate"].includes(mode)) {
    return NextResponse.json({ error: "Invalid checkout mode" }, { status: 400 });
  }

  if (expectedUserEmail && expectedUserEmail !== sessionEmail) {
    return NextResponse.json(
      {
        error: "Checkout session email mismatch. Please sign out and sign in with the intended account.",
        expectedUserEmail,
        sessionUserEmail: sessionEmail
      },
      { status: 409 }
    );
  }

  const organization = organizationSlug
    ? await resolveOrganizationForUser(session.user.email, organizationSlug)
    : null;

  if (organizationSlug && !organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (organization && organization.ownerEmail !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Only the organization owner can manage billing" }, { status: 403 });
  }

  if (!organization && mode !== "new_subscription") {
    return NextResponse.json({ error: "Organization is required for this billing action" }, { status: 400 });
  }

  if (organization) {
    const billingStatus = await getBillingStatusForOrganization(organization);
    if (billingStatus.migrationRequired && mode !== "migrate") {
      return NextResponse.json(
        { error: "Migration required before this billing action", code: "MIGRATION_REQUIRED" },
        { status: 409 }
      );
    }
  }

  try {
    const url = await createLemonCheckoutUrl({
      userEmail: sessionEmail,
      interval,
      quantity,
      organizationSlug: organization?.slug ?? "",
      mode,
      redirectUrl: safeRedirectTo ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${safeRedirectTo}` : ""
    });
    return NextResponse.json({ url, sessionUserEmail: sessionEmail }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create checkout";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
