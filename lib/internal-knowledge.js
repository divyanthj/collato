import { NextResponse } from "next/server";
import crypto from "crypto";
import { getDatabase } from "@/lib/mongodb";
import {
  clearKnowledgeChunksForSource,
  indexKnowledgeSource,
  retrieveKnowledgeChunks,
} from "@/lib/rag";
import { findActiveInternalApiKeyBySecret } from "@/lib/internal-api-keys";

const SOURCES_COLLECTION = "internal_knowledge_sources";

export function requireInternalKnowledgeAuth(request) {
  const expectedSecret = process.env.COLLATO_INTERNAL_API_SECRET;
  const providedSecret =
    request.headers.get("x-collato-internal-secret") ||
    String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "COLLATO_INTERNAL_API_SECRET is not configured." },
      { status: 500 }
    );
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function secretsMatch(left = "", right = "") {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function authenticateInternalKnowledgeRequest(request) {
  const expectedSecret = process.env.COLLATO_INTERNAL_API_SECRET;
  const providedSecret =
    request.headers.get("x-collato-internal-secret") ||
    String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  if (!providedSecret) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      credential: null,
    };
  }

  if (expectedSecret && secretsMatch(providedSecret, expectedSecret)) {
    return {
      credential: {
        type: "global",
        organizationSlug: "",
        label: "Global internal secret",
      },
      error: null,
    };
  }

  const apiKey = await findActiveInternalApiKeyBySecret(providedSecret);

  if (!apiKey) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      credential: null,
    };
  }

  return {
    credential: {
      type: "organization_key",
      organizationSlug: apiKey.organizationSlug,
      label: apiKey.label,
      keyId: apiKey.keyId,
    },
    error: null,
  };
}

export function assertInternalKnowledgeTenant(credential, tenantSlug) {
  const requestedTenantSlug = String(tenantSlug || "").trim();

  if (!requestedTenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required." }, { status: 400 });
  }

  if (credential?.type === "global") {
    return null;
  }

  if (credential?.organizationSlug !== requestedTenantSlug) {
    return NextResponse.json(
      { error: "This integration key cannot access the requested tenant." },
      { status: 403 }
    );
  }

  return null;
}

export function normalizeKnowledgeSource(input = {}) {
  const tenantSlug = String(input.tenantSlug || "").trim();
  const sourceApp = String(input.sourceApp || "external").trim();
  const sourceType = String(input.sourceType || "source").trim();
  const sourceId = String(input.sourceId || "").trim();
  const title = String(input.title || sourceId || "Untitled source").trim();
  const text = String(input.text || "").trim();

  if (!tenantSlug || !sourceId || !text) {
    throw new Error("tenantSlug, sourceId, and text are required.");
  }

  const now = new Date();
  return {
    tenantSlug,
    sourceApp,
    sourceType,
    sourceId,
    title,
    text,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    createdAt: input.createdAt ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt ? new Date(input.updatedAt) : now,
    indexedAt: now,
  };
}

export async function upsertInternalKnowledgeSource(input) {
  const source = normalizeKnowledgeSource(input);
  const db = await getDatabase();
  const collection = db.collection(SOURCES_COLLECTION);

  await collection.updateOne(
    {
      tenantSlug: source.tenantSlug,
      sourceApp: source.sourceApp,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
    },
    { $set: source },
    { upsert: true }
  );

  await indexKnowledgeSource(source);

  return source;
}

export async function deleteInternalKnowledgeSource(input = {}) {
  const tenantSlug = String(input.tenantSlug || "").trim();
  const sourceApp = String(input.sourceApp || "").trim();
  const sourceType = String(input.sourceType || "").trim();
  const sourceId = String(input.sourceId || "").trim();

  if (!tenantSlug || !sourceId) {
    throw new Error("tenantSlug and sourceId are required.");
  }

  const db = await getDatabase();
  const collection = db.collection(SOURCES_COLLECTION);
  await collection.deleteMany({
    tenantSlug,
    ...(sourceApp ? { sourceApp } : {}),
    ...(sourceType ? { sourceType } : {}),
    sourceId,
  });
  await clearKnowledgeChunksForSource({ tenantSlug, sourceType, sourceId });

  return { tenantSlug, sourceType, sourceId };
}

export async function listInternalKnowledgeSources(input = {}) {
  const tenantSlug = String(input.tenantSlug || "").trim();
  const sourceApp = String(input.sourceApp || "").trim();
  const limit = Math.min(Number(input.limit || 50), 200);

  if (!tenantSlug) {
    throw new Error("tenantSlug is required.");
  }

  const db = await getDatabase();
  const docs = await db
    .collection(SOURCES_COLLECTION)
    .find({
      tenantSlug,
      ...(sourceApp ? { sourceApp } : {}),
    })
    .project({
      _id: 0,
      tenantSlug: 1,
      sourceApp: 1,
      sourceType: 1,
      sourceId: 1,
      title: 1,
      metadata: 1,
      createdAt: 1,
      updatedAt: 1,
      indexedAt: 1,
    })
    .sort({ indexedAt: -1 })
    .limit(limit)
    .toArray();

  return docs;
}

export async function queryInternalKnowledge(input = {}) {
  const tenantSlug = String(input.tenantSlug || "").trim();
  const question = String(input.question || "").trim();

  if (!tenantSlug || !question) {
    throw new Error("tenantSlug and question are required.");
  }

  return retrieveKnowledgeChunks({
    tenantSlug,
    question,
    limit: input.limit ?? 8,
  });
}
