"use client";

import { signIn } from "next-auth/react";
import { trackDatafastGoal } from "@/lib/client-analytics";

export function GoogleSignInButton({
  label = "Continue with Google",
  className = "btn btn-primary",
  callbackUrl = "/dashboard",
  analyticsSource = "unknown",
  analyticsMetadata = null,
  disabled = false
}) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => {
        trackDatafastGoal("auth_started", {
          method: "google",
          source: analyticsSource,
          ...(analyticsMetadata ?? {})
        });
        void signIn("google", {
          callbackUrl,
          prompt: "select_account"
        });
      }}
    >
      {label}
    </button>
  );
}
