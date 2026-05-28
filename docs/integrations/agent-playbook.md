# AI Agent Playbook For Customer App Integrations

This playbook is written for an AI coding agent integrating Collato into a customer's own app.

## Copy-Paste Agent Prompt

```text
You are integrating Collato as an internal knowledge service into this customer app.

First inspect the app's auth/admin patterns, routing style, database models, and write flows. Do not expose Collato credentials to the browser.

Implement:
1. A server-only Collato client helper using COLLATO_INTERNAL_API_URL, a Collato UI-created Internal API key in COLLATO_INTERNAL_API_SECRET, and COLLATO_TENANT_SLUG.
2. Admin-only app routes that proxy source listing, file uploads, knowledge queries, and backfill to Collato.
3. A native admin knowledge UI that can ask questions, upload files/notes, list indexed sources, and run a backfill/retry.
4. On-write sync after important create/update/status/payment flows. The primary business write must still succeed if Collato sync fails.
5. Delete sync when indexed records are deleted or archived.
6. An idempotent backfill script that indexes existing records using stable source IDs.
7. Build/test verification and a short env var note.

Use stable source IDs in this format:
{tenantSlug}:{sourceType}:{id}

Do not guess product scope silently. If the data privacy policy is unclear, ask whether to index full data, redacted summaries, or opt-in sources.
```

## Phase 1: Inspect The Customer App

Find these before editing:

- Admin auth helper and non-admin failure pattern.
- API route style and server/client conventions.
- Database models or collections that contain durable operational knowledge.
- Existing file upload patterns.
- Important write flows: create, update, status changes, payment confirmation, delete/archive.
- Existing build/test command.

Useful search terms:

```bash
rg -n "admin|isAdmin|getServerSession|auth|role" app pages src
rg -n "create\\(|findByIdAndUpdate|save\\(|delete|status|payment" app pages src models lib
rg -n "upload|file|FormData|multipart" app pages src components lib
```

## Phase 2: Add Server-Side Collato Client

Create a helper that:

- Reads `COLLATO_INTERNAL_API_URL`.
- Reads `COLLATO_INTERNAL_API_SECRET`, which should be an organization-bound key created in Collato Organization Settings.
- Reads `COLLATO_TENANT_SLUG`.
- Sends `x-collato-internal-secret` on every request.
- Handles JSON and `FormData`.
- Returns `{ skipped: true, reason: "not_configured" }` for optional on-write sync if config is missing.
- Throws for admin UI/proxy routes where the user expects Collato to work.

Recommended helper operations:

- `upsertKnowledgeSource(source)`
- `deleteKnowledgeSource({ sourceType, id })`
- `listKnowledgeSources()`
- `queryKnowledge(question)`
- `uploadKnowledgeFile({ file, title, manualNotes })`
- `syncKnowledgeDocument({ sourceType, id, title, data })`
- `removeKnowledgeDocument({ sourceType, id })`

## Phase 3: Add Admin-Only Proxy Routes

The browser calls the customer app, not Collato.

Add routes equivalent to:

- `GET /api/admin/knowledge/sources`
- `POST /api/admin/knowledge/query`
- `POST /api/admin/knowledge/files`
- `POST /api/admin/knowledge/backfill`

Each route must:

- Authenticate the user.
- Verify admin permission.
- Call the server-side Collato helper.
- Return Collato's payload or a clear error.

## Phase 4: Add Native Admin UI

The first UI should be simple and useful:

- Configuration warning if Collato env vars are missing.
- Question textarea and answer display.
- Sources list with title, type, source ID, and indexed date.
- File upload with title and manual notes.
- Backfill/refresh button.
- Error and success states.

Do not brand the UI as Collato unless the customer asked for that. It should feel native to the customer app.

## Phase 5: Select Sources To Index

Good default source categories:

- Orders, subscriptions, tickets, projects, cases, tasks, invoices.
- Product/SKU/catalog data.
- Policies, SOPs, manuals, internal notes.
- Production, route, scheduling, or operational snapshots.
- Support/admin notes and workflow state.

For each source type define:

- Stable `sourceType`.
- Stable `sourceId`.
- Human-readable `title`.
- Full or summarized `text`.
- Useful `metadata`, including local ID and admin path.

Example source:

```json
{
  "tenantSlug": "acme",
  "sourceApp": "acme-admin",
  "sourceType": "ticket",
  "sourceId": "acme:ticket:123",
  "title": "Ticket #123 - Refund request",
  "text": "{\n  \"status\": \"open\",\n  \"customer\": \"...\",\n  \"messages\": [...]\n}",
  "metadata": {
    "localId": "123",
    "adminPath": "/admin/tickets/123",
    "status": "open"
  }
}
```

## Phase 6: Wire On-Write Sync

After a business write succeeds:

1. Build a source payload from the saved record.
2. Call Collato upsert.
3. Catch and log errors.
4. Return the normal business response even if Collato failed.

For delete/archive flows:

1. Delete or archive the app record.
2. Call Collato delete for the matching source.
3. Catch and log errors.

Sync these flows first:

- Record creation.
- Status updates.
- Payment/approval/fulfillment changes.
- File/SOP imports.
- Deletes and archives.

## Phase 7: Add Backfill

Backfill should:

- Connect to the customer database.
- Iterate the selected source collections.
- Use the same stable source ID builder as on-write sync.
- Limit batches in v1 if needed.
- Continue after individual failures.
- Print synced and failed counts.
- Be safe to rerun.

## Acceptance Criteria

- Non-admin cannot access the knowledge UI or proxy routes.
- Browser code never contains `COLLATO_INTERNAL_API_SECRET`.
- Admin can upload a file and see it in the source list.
- Admin can ask a question and see an answer with sources.
- Backfill can be rerun without duplicate sources.
- Updating the same app record updates the same Collato source.
- Deleting a record removes it from future answers.
- Collato outage does not block primary app writes.
- Build and existing tests pass.

## Common Pitfalls

- Calling Collato directly from the browser.
- Generating random source IDs for records that should update in place.
- Blocking payment/order/status writes on Collato sync.
- Indexing only a pretty title and not enough searchable content.
- Forgetting delete sync, which leaves stale answers.
- Mixing tenants by using a shared or missing `tenantSlug`.
