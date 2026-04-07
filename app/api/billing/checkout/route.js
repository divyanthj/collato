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

  if (!["month", "year"].includes(interval)) {
    return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Quantity must be an integer greater than 0" }, { status: 400 });
  }

  if (!["new_subscription", "upgrade_quantity", "switch_plan", "migrate"].includes(mode)) {
    return NextResponse.json({ error: "Invalid checkout mode" }, { status: 400 });
  }

  const organization = organizationSlug
    ? await resolveOrganizationForUser(session.user.email, organizationSlug)
    : null;

  if (organizationSlug && !organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
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
      userEmail: session.user.email,
      interval,
      quantity,
      organizationSlug: organization?.slug ?? "",
      mode
    });
    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create checkout";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
