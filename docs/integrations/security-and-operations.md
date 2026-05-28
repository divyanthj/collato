# Security And Operations

Collato integrations are powerful because they can index sensitive operational data. Treat the integration as internal infrastructure, not a public browser API.

## Security Model

Customer app:

- Owns user authentication.
- Owns admin authorization.
- Owns UI and browser routes.
- Calls Collato only from trusted server code.

Collato:

- Authenticates internal API calls with `COLLATO_INTERNAL_API_SECRET`.
- Separates retrieval by `tenantSlug`.
- Stores source metadata and searchable text.
- Sends retrieved context to the configured AI provider for answer generation.

## Secret Handling

Recommended setup:

1. In Collato, sign in as the organization owner.
2. Open Organization Settings.
3. Create an Internal API key.
4. Copy the key immediately. Collato stores only a hash and cannot show it again.
5. Store it as `COLLATO_INTERNAL_API_SECRET` in the customer app server environment.

Legacy Collato deployment-level env var:

```env
COLLATO_INTERNAL_API_SECRET=deployment-level-shared-secret
```

Required customer app env vars:

```env
COLLATO_INTERNAL_API_URL=https://collato.example.com
COLLATO_INTERNAL_API_SECRET=collato_sk_...
COLLATO_TENANT_SLUG=customer-slug
```

Rules:

- Never prefix the secret with `NEXT_PUBLIC_`.
- Never include the secret in client components, browser requests, or logs.
- Rotate the secret if it is exposed.
- Use different secrets per environment.
- Revoke unused or exposed organization keys from Collato Organization Settings.

## Tenant Isolation

Use a stable `tenantSlug` per customer/account/environment. Retrieval filters by `tenantSlug`, so a wrong tenant slug can mix knowledge boundaries.

Recommended:

- Production tenant: `acme`
- Staging tenant: `acme-staging`
- Local tenant: `acme-local`

Avoid generic tenant slugs like `default`, `test`, or `customer`.

## PII And Data Policy

Before indexing customer data, choose one policy:

- Full data: maximum answer quality, highest privacy risk.
- Redacted summaries: lower risk, may lose detailed answerability.
- Opt-in sources: safest rollout, requires more admin controls.

Document the chosen policy in the customer app. If full data is indexed, admins should understand that source text can be retrieved and included in AI context.

## Failure Handling

On-write sync should not block primary business flows.

Recommended behavior:

- Business write succeeds.
- Collato sync runs after the save.
- Sync errors are caught and logged.
- Admin UI can show stale/missing source state later.
- Backfill or retry can repair missed syncs.

For admin knowledge UI actions, surface errors directly because the user is explicitly using Collato.

## Backfill And Retry

Backfill must be idempotent:

- Use stable source IDs.
- Upsert the same source identity on every run.
- Continue after per-record failures.
- Print synced and failed counts.

Run backfill:

- Before first launch.
- After adding a new source type.
- After a known sync outage.
- After changing serialization policy.

## Monitoring

At minimum, log:

- Collato upsert failures.
- Collato delete failures.
- Backfill failed count.
- Query route errors.
- File extraction failures.

Useful admin indicators:

- Collato configured/not configured.
- Recent indexed sources.
- Last indexed timestamp.
- Backfill result.
- Failed sync count if the customer app stores one.

## Rollout Checklist

- Collato has `MONGODB_URI`, `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, and `COLLATO_INTERNAL_API_SECRET`.
- Customer app has `COLLATO_INTERNAL_API_URL`, `COLLATO_INTERNAL_API_SECRET`, and `COLLATO_TENANT_SLUG`.
- Admin proxy routes enforce admin-only access.
- Browser never calls Collato directly.
- Backfill has been run and can be rerun.
- Source list shows expected records.
- Sample queries return cited answers.
- Delete sync has been tested.
- Collato outage does not break primary writes.

## Operational Notes

- Source updates replace chunks for the same `tenantSlug`, `sourceType`, and `sourceId`.
- Source deletes remove matching stored source docs and chunks.
- Query uses retrieved chunks and asks the model to answer only from excerpts.
- If `OPENAI_API_KEY` is missing, query returns retrieved sources with a fallback answer.
- File upload depends on Vercel Blob configuration.

## Production Hardening Ideas

These are not required for a first integration, but are useful as usage grows:

- Per-customer secrets instead of one global secret.
- Audit logs for query access.
- Stored sync job table with retry status.
- Source-level privacy flags.
- Admin controls for indexed source categories.
- Retention and deletion policy.
- Rate limits on internal API endpoints.
- OpenAPI spec for generated clients.
