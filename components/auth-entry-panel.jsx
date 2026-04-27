"use client";
import { useState, useTransition } from "react";
import { AlertBanner } from "@/components/alert-banner";
import { readResponsePayload } from "@/lib/client-api";
import { trackDatafastGoal } from "@/lib/client-analytics";
export function AuthEntryPanel({ mode = "hero", redirectTo = "/dashboard" }) {
    const [email, setEmail] = useState("");
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const [isPending, startTransition] = useTransition();
    const submitLabel = mode === "compact" ? "Email me a sign-in link" : "Continue with email";
    const handleEmailSignIn = () => {
        setError(null);
        setStatusMessage(null);
        trackDatafastGoal("auth_started", {
            method: "email_magic_link",
            source: mode === "compact" ? "dashboard_sidebar" : "hero_panel"
        });
        startTransition(async () => {
            try {
                const response = await fetch("/api/auth/email-signin", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        redirectTo
                    })
                });
                const result = await readResponsePayload(response);
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not send sign-in email");
                }
                setStatusMessage(`Magic link sent to ${email}.`);
                setEmail("");
            }
            catch (signInError) {
                setError(signInError instanceof Error ? signInError.message : "Could not send sign-in email");
            }
        });
    };
    return (<div className={mode === "compact" ? "space-y-3" : "rounded-[1.9rem] border border-base-300 bg-base-100/85 p-5"}>
      {mode === "hero" ? (<div>
          <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Sign in</div>
          <div className="mt-2 text-xl font-semibold text-neutral">Sign in to start workspace setup</div>
          <p className="mt-2 text-sm leading-7 text-base-content/70">
            Use the same invited email address if you were added to a team. Otherwise, sign in to create your first workspace and generate a report-ready summary faster.
          </p>
        </div>) : null}

      <div className="grid gap-3">
        <label className="form-control">
          <div className="label">
            <span className="label-text">Work email</span>
          </div>
          <input type="email" className="input input-bordered" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com"/>
        </label>

        <button type="button" className="btn btn-outline" onClick={handleEmailSignIn} disabled={isPending || !email.trim()}>
          {isPending ? "Sending link..." : submitLabel}
        </button>
      </div>

      {statusMessage ? <AlertBanner tone="success" className="mt-1">{statusMessage}</AlertBanner> : null}

      {error ? <AlertBanner tone="error" className="mt-1">{error}</AlertBanner> : null}
    </div>);
}

