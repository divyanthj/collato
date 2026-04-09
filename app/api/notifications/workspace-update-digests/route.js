import { NextResponse } from "next/server";
import { sendPendingWorkspaceUpdateDigests } from "@/lib/workspace-update-notifications";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${secret}`;
}

async function handleDigestRun(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendPendingWorkspaceUpdateDigests();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send workspace update digests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request) {
  return handleDigestRun(request);
}

export async function POST(request) {
  return handleDigestRun(request);
}
