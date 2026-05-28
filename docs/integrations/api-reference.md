# Collato Internal Knowledge API Reference

Base URL: the deployed Collato origin, for example `https://collato.example.com`.

All endpoints require server-to-server authentication. Prefer an organization-bound Internal API key created from Collato Organization Settings. Send either:

```http
x-collato-internal-secret: <COLLATO_INTERNAL_API_SECRET>
```

or:

```http
Authorization: Bearer <COLLATO_INTERNAL_API_SECRET>
```

Organization-bound keys can only access the matching `tenantSlug`. If a key for one organization requests another tenant, Collato returns `403`.

The legacy deployment-level `COLLATO_INTERNAL_API_SECRET` is still supported for trusted system jobs, but customer integrations should use UI-created organization keys.

## POST `/api/internal/knowledge/sources`

Upsert a structured source record and index it for retrieval.

### Request

```json
{
  "tenantSlug": "acme",
  "sourceApp": "acme-admin",
  "sourceType": "invoice",
  "sourceId": "acme:invoice:inv_123",
  "title": "Invoice INV-123",
  "text": "{\n  \"invoiceNumber\": \"INV-123\",\n  \"customer\": \"Nisha Rao\",\n  \"total\": 9500\n}",
  "metadata": {
    "localId": "inv_123",
    "adminPath": "/admin/invoices/inv_123",
    "status": "sent"
  },
  "createdAt": "2026-05-01T10:00:00.000Z",
  "updatedAt": "2026-05-21T09:30:00.000Z"
}
```

### Required Fields

- `tenantSlug`
- `sourceId`
- `text`

Defaults:

- `sourceApp`: `external`
- `sourceType`: `source`
- `title`: `sourceId` or `Untitled source`
- `metadata`: `{}`
- `createdAt`, `updatedAt`: current time

### Response

```json
{
  "source": {
    "tenantSlug": "acme",
    "sourceApp": "acme-admin",
    "sourceType": "invoice",
    "sourceId": "acme:invoice:inv_123",
    "title": "Invoice INV-123",
    "text": "...",
    "metadata": {
      "localId": "inv_123",
      "adminPath": "/admin/invoices/inv_123",
      "status": "sent"
    },
    "createdAt": "2026-05-01T10:00:00.000Z",
    "updatedAt": "2026-05-21T09:30:00.000Z",
    "indexedAt": "2026-05-21T09:31:00.000Z"
  }
}
```

### Behavior

Collato stores the source in `internal_knowledge_sources`, chunks `text`, creates embeddings, and replaces existing chunks with the same `tenantSlug`, `sourceType`, and `sourceId`.

## GET `/api/internal/knowledge/sources`

List recent indexed sources for a tenant.

### Query Parameters

| Parameter | Required | Notes |
| --- | --- | --- |
| `tenantSlug` | Yes | Tenant namespace. |
| `sourceApp` | No | Filter to one integrating app. |
| `limit` | No | Defaults to `50`, max `200`. |

### Example

```http
GET /api/internal/knowledge/sources?tenantSlug=acme&sourceApp=acme-admin&limit=80
```

### Response

```json
{
  "sources": [
    {
      "tenantSlug": "acme",
      "sourceApp": "acme-admin",
      "sourceType": "invoice",
      "sourceId": "acme:invoice:inv_123",
      "title": "Invoice INV-123",
      "metadata": {
        "localId": "inv_123"
      },
      "createdAt": "2026-05-01T10:00:00.000Z",
      "updatedAt": "2026-05-21T09:30:00.000Z",
      "indexedAt": "2026-05-21T09:31:00.000Z"
    }
  ]
}
```

## DELETE `/api/internal/knowledge/sources/[id]`

Delete a source and its chunks.

`[id]` is the URL-encoded `sourceId`.

### Query Parameters

| Parameter | Required | Notes |
| --- | --- | --- |
| `tenantSlug` | Yes | Tenant namespace. |
| `sourceApp` | No | Narrows deletion. Recommended. |
| `sourceType` | No | Narrows deletion. Recommended. |

### Example

```http
DELETE /api/internal/knowledge/sources/acme%3Ainvoice%3Ainv_123?tenantSlug=acme&sourceApp=acme-admin&sourceType=invoice
```

### Response

```json
{
  "deleted": {
    "tenantSlug": "acme",
    "sourceType": "invoice",
    "sourceId": "acme:invoice:inv_123"
  }
}
```

## POST `/api/internal/knowledge/files`

Upload a file, extract knowledge text, store the original file in Vercel Blob, and index the extracted content as a source.

### Request

Use `multipart/form-data`.

| Field | Required | Notes |
| --- | --- | --- |
| `tenantSlug` | Yes | Tenant namespace. |
| `file` | Yes | File object. |
| `sourceApp` | No | Defaults to `external`. |
| `sourceType` | No | Defaults to `file`. |
| `sourceId` | No | Defaults to `${sourceApp}:file:${Date.now()}`. Stable IDs are recommended for retries. |
| `title` | No | Defaults to file name. |
| `manualNotes` | No | Additional context appended to extracted text. |

### Supported Extraction

- Text-like files: text MIME types, `.txt`, `.md`, `.csv`, `.json`, `.xml`
- `.docx`
- PDF
- Images via AI extraction

Unsupported files can still be indexed if useful `manualNotes` are supplied.

### Response

```json
{
  "source": {
    "tenantSlug": "acme",
    "sourceApp": "acme-admin",
    "sourceType": "sop",
    "sourceId": "acme:sop:onboarding-v2",
    "title": "Onboarding SOP",
    "metadata": {
      "fileName": "onboarding.pdf",
      "fileType": "application/pdf",
      "fileSize": 182938,
      "extractionStatus": "extracted",
      "extractionSummary": "Text extracted automatically from the uploaded PDF.",
      "blobUrl": "https://...",
      "blobDownloadUrl": "https://...",
      "blobPathname": "workspace-files/acme/...",
      "blobAccess": "private",
      "storageProvider": "vercel_blob"
    },
    "indexedAt": "2026-05-21T09:31:00.000Z"
  }
}
```

## POST `/api/internal/knowledge/query`

Retrieve relevant chunks and generate a source-grounded answer.

### Request

```json
{
  "tenantSlug": "acme",
  "question": "Which invoices are overdue and what should we follow up on?",
  "limit": 8
}
```

### Response

```json
{
  "answer": "Invoice INV-123 appears overdue based on the retrieved source [1]. The follow-up should reference...",
  "sources": [
    {
      "index": 1,
      "tenantSlug": "acme",
      "sourceApp": "acme-admin",
      "sourceType": "invoice",
      "sourceId": "acme:invoice:inv_123",
      "sourceLabel": "acme-admin: invoice | Invoice INV-123",
      "title": "Invoice INV-123",
      "similarity": 0.72,
      "metadata": {
        "localId": "inv_123"
      }
    }
  ]
}
```

If `OPENAI_API_KEY` is not configured in Collato, the endpoint still returns matching `sources` with a fallback answer.

## Common Errors

| Status | Meaning |
| --- | --- |
| `400` | Missing required fields, invalid multipart body, or query validation error. |
| `401` | Missing/invalid internal secret. |
| `500` | Collato internal secret not configured, database failure, extraction failure, or AI/provider failure. |

## Integration Rule

Customer apps should wrap all Collato calls in server-side helpers. Do not call these endpoints from browser JavaScript.
