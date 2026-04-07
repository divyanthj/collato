"use client";
import { useState, useTransition } from "react";
import { readResponsePayload } from "@/lib/client-api";
export function AuthEntryPanel({ mode = "hero" }) {
    const [email, setEmail] = useState("");
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const [isPending, startTransition] = useTransition();
    const submitLabel = mode === "compact" ? "Email me a sign-in link" : "Continue with email";
    const handleEmailSignIn = () => {
        setError(null);
        setStatusMessage(null);
        startTransition(async () => {
            try {
                const response = await fetch("/api/auth/email-signin", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        redirectTo: "/dashboard"
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
          <div className="mt-2 text-xl font-semibold text-neutral">Use Google or an email magic link</div>
          <p className="mt-2 text-sm leading-7 text-base-content/70">
            Invitees can join with the same email address they were added with, even if they do not want to use Google.
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

      {statusMessage ? (<div className="alert alert-success text-sm">
          <span>{statusMessage}</span>
        </div>) : null}

      {error ? (<div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>) : null}
    </div>);
}

