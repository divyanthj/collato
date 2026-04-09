"use client";

import { useMemo } from "react";
import { signIn } from "next-auth/react";
import { AuthEntryPanel } from "@/components/auth-entry-panel";

function readSearchParam(searchParams, key) {
  const value = searchParams?.get(key);
  return typeof value === "string" ? value : "";
}

export function InviteAcceptLanding({ searchParams }) {
  const type = readSearchParam(searchParams, "type");
  const organizationSlug = readSearchParam(searchParams, "organizationSlug");
  const workspaceSlug = readSearchParam(searchParams, "workspaceSlug");
  const inviteName = readSearchParam(searchParams, "name");
  const organizationName = readSearchParam(searchParams, "organizationName");
  const role = readSearchParam(searchParams, "role");
  const currentUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "/invite";
    }

    return window.location.href;
  }, []);
  const title = type === "organization" ? `Accept invitation to ${inviteName || "this organization"}` : `Accept invitation to ${inviteName || "this workspace"}`;
  const subtitle = type === "organization"
    ? `Sign in with the invited email address to join ${inviteName || "the organization"}${role ? ` as ${role}` : ""}.`
    : `Sign in with the invited email address to join ${inviteName || "the workspace"}${organizationName ? ` in ${organizationName}` : ""}.`;
  const isReady = Boolean(type === "organization" ? organizationSlug : workspaceSlug);

  return (
    <main className="min-h-screen px-4 py-8 lg:px-6">
      <section className="mx-auto max-w-3xl">
        <div className="glass-panel rounded-[2.25rem] p-8 lg:p-10">
          <p className="section-kicker">Invitation</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-neutral">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-base-content/72">{subtitle}</p>

          <div className="mt-8 rounded-[1.75rem] border border-base-300 bg-base-100 p-6">
            <div className="text-sm font-semibold text-neutral">Continue with Google</div>
            <p className="mt-2 text-sm leading-7 text-base-content/65">
              Use the same email address that received the invitation so we can match it correctly.
            </p>
            <button
              type="button"
              className="btn btn-primary mt-4"
              onClick={() => signIn("google", { callbackUrl: currentUrl, prompt: "select_account" })}
              disabled={!isReady}
            >
              Continue with Google
            </button>
          </div>

          <div className="mt-6">
            <AuthEntryPanel mode="hero" redirectTo={currentUrl} />
          </div>
        </div>
      </section>
    </main>
  );
}
