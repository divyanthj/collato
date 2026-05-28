"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertBanner } from "@/components/alert-banner";
import { readResponsePayload } from "@/lib/client-api";

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function envExample({ organizationSlug, secret }) {
  return [
    "COLLATO_INTERNAL_API_URL=https://collato.io",
    `COLLATO_INTERNAL_API_SECRET=${secret || "collato_sk_..."}`,
    `COLLATO_TENANT_SLUG=${organizationSlug}`,
  ].join("\n");
}

export function IntegrationApiKeyManager({ organization, initialKeys = [] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isPending, startTransition] = useTransition();
  const activeKeys = useMemo(() => keys.filter((key) => key.status === "active"), [keys]);

  const refreshKeys = async () => {
    const response = await fetch(`/api/internal-api-keys?organizationSlug=${encodeURIComponent(organization.slug)}`);
    const result = await readResponsePayload(response);

    if (!response.ok) {
      throw new Error(result.error ?? "Could not refresh integration keys");
    }

    setKeys(result.keys ?? []);
  };

  const handleCreate = () => {
    setError(null);
    setMessage(null);
    setNewSecret("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/internal-api-keys", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organizationSlug: organization.slug,
            label: label.trim() || "Integration key",
          }),
        });
        const result = await readResponsePayload(response);

        if (!response.ok) {
          throw new Error(result.error ?? "Could not create integration key");
        }

        setKeys((current) => [result.key, ...current]);
        setLabel("");
        setNewSecret(result.secret);
        setMessage("Integration key created. Copy it now; Collato will not show it again.");
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Could not create integration key");
      }
    });
  };

  const handleRevoke = (keyId) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/internal-api-keys", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organizationSlug: organization.slug,
            keyId,
          }),
        });
        const result = await readResponsePayload(response);

        if (!response.ok) {
          throw new Error(result.error ?? "Could not revoke integration key");
        }

        await refreshKeys();
        setMessage("Integration key revoked.");
      } catch (revokeError) {
        setError(revokeError instanceof Error ? revokeError.message : "Could not revoke integration key");
      }
    });
  };

  const handleCopy = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch (_error) {
      setError("Could not copy to clipboard. Select the text and copy it manually.");
    }
  };

  return (
    <div className="rounded-[1.5rem] bg-base-100 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-neutral">Integration API keys</div>
          <p className="mt-2 text-sm leading-6 text-base-content/65">
            Create organization-bound keys for customer apps that call Collato&apos;s internal knowledge APIs. Keys are
            stored hashed and shown only once.
          </p>
        </div>
        <div className={`badge self-start ${activeKeys.length ? "badge-success" : "badge-outline"}`}>
          {activeKeys.length} active
        </div>
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-warning/30 bg-warning/10 p-4 text-sm leading-6 text-base-content/78">
        Keep these keys server-side only. Do not put them in browser code, public repos, analytics tools, or screenshots.
        A key can only access tenant <code className="rounded bg-base-100 px-1">{organization.slug}</code>.
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <input
          className="input input-bordered"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Key label, e.g. Acme admin production"
          disabled={isPending}
        />
        <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={isPending}>
          {isPending ? "Working..." : "Create key"}
        </button>
      </div>

      {newSecret ? (
        <div className="mt-4 rounded-[1.25rem] border border-success/30 bg-success/10 p-4">
          <div className="text-sm font-semibold text-success">Copy this secret now</div>
          <p className="mt-2 text-sm leading-6 text-base-content/75">
            This is the only time the full key will be visible.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-base-300 bg-base-100 p-3 text-sm">{newSecret}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleCopy(newSecret, "Secret copied.")}>
              Copy secret
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleCopy(envExample({ organizationSlug: organization.slug, secret: newSecret }), "Env vars copied.")}
            >
              Copy env vars
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {keys.length > 0 ? (
          keys.map((key) => (
            <div key={key.keyId} className="rounded-[1.25rem] border border-base-300 bg-base-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-neutral">{key.label}</div>
                  <div className="mt-1 break-all text-sm text-base-content/60">{key.keyPreview}</div>
                  <div className="mt-2 text-xs leading-5 text-base-content/55">
                    Created {formatDate(key.createdAt)} by {key.createdByName || key.createdByEmail || "Unknown"}.
                    Last used: {formatDate(key.lastUsedAt)}.
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <span className={`badge ${key.status === "active" ? "badge-success" : "badge-outline"}`}>
                    {key.status}
                  </span>
                  {key.status === "active" ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => handleRevoke(key.keyId)}
                      disabled={isPending}
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-base-300 bg-base-50 p-6 text-center text-sm leading-6 text-base-content/60">
            No integration keys yet.
          </div>
        )}
      </div>

      {message ? <AlertBanner tone="success" className="mt-4">{message}</AlertBanner> : null}
      {error ? <AlertBanner tone="error" className="mt-4">{error}</AlertBanner> : null}
    </div>
  );
}
