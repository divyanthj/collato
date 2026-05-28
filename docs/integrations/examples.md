# Collato Integration Examples

These examples assume a Next.js App Router customer app, but the same server-side pattern works in any stack.

## Environment Variables

```env
COLLATO_INTERNAL_API_URL=https://collato.example.com
COLLATO_INTERNAL_API_SECRET=replace-with-shared-secret
COLLATO_TENANT_SLUG=acme
```

## Server-Only Client Helper

```js
const SOURCE_APP = "acme-admin";

const getConfig = () => ({
  baseUrl: String(process.env.COLLATO_INTERNAL_API_URL || "").replace(/\/$/, ""),
  secret: process.env.COLLATO_INTERNAL_API_SECRET || "",
  tenantSlug: process.env.COLLATO_TENANT_SLUG || "acme",
});

export const isCollatoConfigured = () => {
  const config = getConfig();
  return Boolean(config.baseUrl && config.secret);
};

async function callCollato(path, options = {}) {
  const config = getConfig();

  if (!config.baseUrl || !config.secret) {
    throw new Error("Collato knowledge service is not configured.");
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      "x-collato-internal-secret": config.secret,
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || `Collato request failed with ${response.status}`);
  }

  return payload;
}

export function buildKnowledgeSource({ sourceType, id, title, data }) {
  const config = getConfig();
  const sourceId = `${config.tenantSlug}:${sourceType}:${id}`;

  return {
    tenantSlug: config.tenantSlug,
    sourceApp: SOURCE_APP,
    sourceType,
    sourceId,
    title,
    text: JSON.stringify({ title, sourceType, sourceId, data }, null, 2),
    metadata: {
      sourceType,
      localId: String(id),
      adminPath: `/admin/${sourceType}/${id}`,
    },
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

export async function syncKnowledgeDocument({ sourceType, id, title, data }) {
  if (!isCollatoConfigured()) {
    return { skipped: true, reason: "not_configured" };
  }

  try {
    return await callCollato("/api/internal/knowledge/sources", {
      method: "POST",
      body: JSON.stringify(buildKnowledgeSource({ sourceType, id, title, data })),
    });
  } catch (error) {
    console.error("Collato sync failed:", error);
    return { error: error.message || "Sync failed" };
  }
}

export async function removeKnowledgeDocument({ sourceType, id }) {
  if (!isCollatoConfigured()) {
    return { skipped: true, reason: "not_configured" };
  }

  const config = getConfig();
  const sourceId = `${config.tenantSlug}:${sourceType}:${id}`;
  const params = new URLSearchParams({
    tenantSlug: config.tenantSlug,
    sourceApp: SOURCE_APP,
    sourceType,
  });

  try {
    return await callCollato(
      `/api/internal/knowledge/sources/${encodeURIComponent(sourceId)}?${params.toString()}`,
      { method: "DELETE" }
    );
  } catch (error) {
    console.error("Collato delete sync failed:", error);
    return { error: error.message || "Delete sync failed" };
  }
}

export async function listKnowledgeSources() {
  const config = getConfig();
  const params = new URLSearchParams({
    tenantSlug: config.tenantSlug,
    sourceApp: SOURCE_APP,
    limit: "80",
  });

  return callCollato(`/api/internal/knowledge/sources?${params.toString()}`);
}

export async function queryKnowledge(question) {
  const config = getConfig();
  return callCollato("/api/internal/knowledge/query", {
    method: "POST",
    body: JSON.stringify({
      tenantSlug: config.tenantSlug,
      question,
      limit: 8,
    }),
  });
}

export async function uploadKnowledgeFile({ file, title, manualNotes }) {
  const config = getConfig();
  const formData = new FormData();
  formData.append("tenantSlug", config.tenantSlug);
  formData.append("sourceApp", SOURCE_APP);
  formData.append("sourceType", "admin_file");
  formData.append("sourceId", `${config.tenantSlug}:admin_file:${Date.now()}`);
  formData.append("title", title || file.name || "Admin file");
  formData.append("manualNotes", manualNotes || "");
  formData.append("file", file);

  return callCollato("/api/internal/knowledge/files", {
    method: "POST",
    body: formData,
  });
}
```

## Admin Proxy Route: Query

```js
import { NextResponse } from "next/server";
import { queryKnowledge } from "@/lib/collato-knowledge";
import { getAdminSession } from "@/lib/admin-auth";

export async function POST(req) {
  const session = await getAdminSession();

  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const question = String(body.question || "").trim();

  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  return NextResponse.json(await queryKnowledge(question));
}
```

## Admin Proxy Route: File Upload

```js
import { NextResponse } from "next/server";
import { uploadKnowledgeFile } from "@/lib/collato-knowledge";
import { getAdminSession } from "@/lib/admin-auth";

export async function POST(req) {
  const session = await getAdminSession();

  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  return NextResponse.json(
    await uploadKnowledgeFile({
      file,
      title: String(formData.get("title") || file.name),
      manualNotes: String(formData.get("manualNotes") || ""),
    }),
    { status: 201 }
  );
}
```

## On-Write Sync

```js
export async function PATCH(req, { params }) {
  const session = await getAdminSession();

  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const order = await Order.findById(params.id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  order.status = body.status;
  await order.save();

  await syncKnowledgeDocument({
    sourceType: "order",
    id: order.id,
    title: `Order ${order.orderNumber || order.id}`,
    data: order.toJSON ? order.toJSON() : order,
  });

  return NextResponse.json({ order });
}
```

If Collato sync errors should never block the primary write, wrap the sync in a helper that catches and logs internally.

## Delete Sync

```js
export async function DELETE(_req, { params }) {
  const session = await getAdminSession();

  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const order = await Order.findByIdAndDelete(params.id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  await removeKnowledgeDocument({
    sourceType: "order",
    id: order.id,
  });

  return NextResponse.json({ ok: true });
}
```

## Minimal Query UI

```jsx
"use client";

import { useState, useTransition } from "react";

export default function KnowledgeConsole() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const ask = () => {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/knowledge/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Could not query knowledge.");
        }

        setAnswer(payload.answer || "");
        setSources(payload.sources || []);
      } catch (requestError) {
        setError(requestError.message || "Could not query knowledge.");
      }
    });
  };

  return (
    <section>
      <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
      <button type="button" onClick={ask} disabled={isPending || !question.trim()}>
        Ask
      </button>
      {error ? <p>{error}</p> : null}
      {answer ? <pre>{answer}</pre> : null}
      {sources.map((source) => (
        <div key={source.sourceId}>
          [{source.index}] {source.title}
        </div>
      ))}
    </section>
  );
}
```

## Backfill Script Shape

```js
#!/usr/bin/env node

const sourceConfigs = [
  {
    collection: "orders",
    sourceType: "order",
    title: (item) => `Order ${item.orderNumber || item._id}`,
  },
  {
    collection: "tickets",
    sourceType: "ticket",
    title: (item) => `Ticket ${item.number || item._id}`,
  },
];

for (const config of sourceConfigs) {
  const docs = await db.collection(config.collection).find({}).limit(500).toArray();

  for (const item of docs) {
    await upsertSource({
      sourceType: config.sourceType,
      id: String(item._id),
      title: config.title(item),
      data: item,
    });
  }
}
```

Backfill should reuse the same source ID format as on-write sync.
