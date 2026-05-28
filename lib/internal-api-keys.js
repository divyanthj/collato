import crypto from "crypto";
import { getDatabase } from "@/lib/mongodb";
import { getOrganizationBySlug, isOrganizationOwner } from "@/lib/data";

const API_KEYS_COLLECTION = "internal_api_keys";
const KEY_PREFIX = "collato_sk";

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return normalize(value).toLowerCase();
}

function hashSecret(secret) {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

function createRawSecret() {
  return `${KEY_PREFIX}_${crypto.randomBytes(32).toString("base64url")}`;
}

function createKeyPreview(secret) {
  return `${secret.slice(0, 14)}...${secret.slice(-4)}`;
}

function mapApiKey(doc) {
  return {
    id: String(doc._id),
    keyId: String(doc.keyId),
    organizationSlug: String(doc.organizationSlug),
    organizationName: String(doc.organizationName || ""),
    label: String(doc.label || "Integration key"),
    keyPreview: String(doc.keyPreview || ""),
    status: doc.status === "revoked" ? "revoked" : "active",
    scopes: Array.isArray(doc.scopes) ? doc.scopes : [],
    createdByEmail: String(doc.createdByEmail || ""),
    createdByName: String(doc.createdByName || ""),
    createdAt: new Date(String(doc.createdAt ?? new Date())).toISOString(),
    lastUsedAt: doc.lastUsedAt ? new Date(String(doc.lastUsedAt)).toISOString() : null,
    revokedAt: doc.revokedAt ? new Date(String(doc.revokedAt)).toISOString() : null,
    revokedByEmail: String(doc.revokedByEmail || ""),
  };
}

async function assertOwner(organizationSlug, userEmail) {
  const normalizedSlug = normalize(organizationSlug);
  const normalizedEmail = normalizeEmail(userEmail);

  if (!normalizedSlug || !normalizedEmail) {
    throw new Error("Organization and user are required.");
  }

  const organization = await getOrganizationBySlug(normalizedSlug);

  if (!organization) {
    throw new Error("Organization not found.");
  }

  if (!(await isOrganizationOwner(normalizedSlug, normalizedEmail))) {
    throw new Error("Only the organization owner can manage integration keys.");
  }

  return organization;
}

export async function listInternalApiKeys({ organizationSlug, userEmail }) {
  await assertOwner(organizationSlug, userEmail);
  const db = await getDatabase();
  const docs = await db
    .collection(API_KEYS_COLLECTION)
    .find({ organizationSlug: normalize(organizationSlug) })
    .sort({ createdAt: -1 })
    .toArray();

  return docs.map((doc) => mapApiKey(doc));
}

export async function createInternalApiKey({
  organizationSlug,
  label,
  createdByEmail,
  createdByName,
}) {
  const organization = await assertOwner(organizationSlug, createdByEmail);
  const secret = createRawSecret();
  const now = new Date();
  const db = await getDatabase();
  const keyId = crypto.randomUUID();
  const document = {
    keyId,
    organizationSlug: organization.slug,
    organizationName: organization.name,
    label: normalize(label).slice(0, 80) || "Integration key",
    keyHash: hashSecret(secret),
    keyPreview: createKeyPreview(secret),
    status: "active",
    scopes: ["knowledge:read", "knowledge:write"],
    createdByEmail: normalizeEmail(createdByEmail),
    createdByName: normalize(createdByName),
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null,
    revokedByEmail: "",
  };
  const result = await db.collection(API_KEYS_COLLECTION).insertOne(document);

  return {
    key: mapApiKey({
      _id: result.insertedId,
      ...document,
    }),
    secret,
  };
}

export async function revokeInternalApiKey({
  organizationSlug,
  keyId,
  revokedByEmail,
}) {
  await assertOwner(organizationSlug, revokedByEmail);
  const db = await getDatabase();
  const result = await db.collection(API_KEYS_COLLECTION).findOneAndUpdate(
    {
      organizationSlug: normalize(organizationSlug),
      keyId: normalize(keyId),
      status: "active",
    },
    {
      $set: {
        status: "revoked",
        revokedAt: new Date(),
        revokedByEmail: normalizeEmail(revokedByEmail),
      },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new Error("Active integration key not found.");
  }

  return mapApiKey(result);
}

export async function findActiveInternalApiKeyBySecret(secret) {
  const providedSecret = normalize(secret);

  if (!providedSecret.startsWith(`${KEY_PREFIX}_`)) {
    return null;
  }

  const db = await getDatabase();
  const doc = await db.collection(API_KEYS_COLLECTION).findOne({
    keyHash: hashSecret(providedSecret),
    status: "active",
  });

  if (!doc) {
    return null;
  }

  await db.collection(API_KEYS_COLLECTION).updateOne(
    { _id: doc._id },
    {
      $set: {
        lastUsedAt: new Date(),
      },
    }
  );

  return mapApiKey(doc);
}
