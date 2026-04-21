const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function stripWrappingQuotes(value) {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1));
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function toTitleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getDisplayNameFromEmail(email, fallback = "Signed in user") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const localPart = normalizedEmail.split("@")[0] || "";
  const normalizedLocalPart = localPart
    .replace(/[._+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedLocalPart) {
    return fallback;
  }
  return toTitleCase(normalizedLocalPart) || fallback;
}

function shouldBackfillName(createdByName) {
  const name = String(createdByName || "").trim().toLowerCase();
  return !name || name === "signed in user";
}

async function backfillCollection(collection, filter, dryRun) {
  const cursor = collection.find(filter, {
    projection: { _id: 1, createdBy: 1, createdByName: 1 }
  });

  let scanned = 0;
  let updated = 0;
  const bulkOps = [];
  const batchSize = 500;

  for await (const doc of cursor) {
    scanned += 1;
    const nextName = getDisplayNameFromEmail(doc.createdBy);
    if (!nextName || nextName === "Signed in user") {
      continue;
    }
    if (!shouldBackfillName(doc.createdByName)) {
      continue;
    }

    updated += 1;
    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { createdByName: nextName } }
      }
    });

    if (!dryRun && bulkOps.length >= batchSize) {
      await collection.bulkWrite(bulkOps, { ordered: false });
      bulkOps.length = 0;
    }
  }

  if (!dryRun && bulkOps.length > 0) {
    await collection.bulkWrite(bulkOps, { ordered: false });
  }

  return { scanned, updated };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const projectRoot = path.resolve(__dirname, "..");
  loadEnvFromFile(path.join(projectRoot, ".env.local"));
  loadEnvFromFile(path.join(projectRoot, ".env"));

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set in environment or .env.local");
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000
  });

  try {
    await client.connect();
    const db = client.db("collato");
    const targets = [
      { name: "workspace_updates", collection: db.collection("workspace_updates") },
      { name: "workspace_tasks", collection: db.collection("workspace_tasks") },
      { name: "workspace_chat_messages", collection: db.collection("workspace_chat_messages") }
    ];

    console.log(dryRun ? "Running in DRY RUN mode." : "Running backfill.");

    for (const target of targets) {
      const result = await backfillCollection(
        target.collection,
        {
          createdBy: { $type: "string", $ne: "" },
          $or: [{ createdByName: { $exists: false } }, { createdByName: "" }, { createdByName: "Signed in user" }]
        },
        dryRun
      );
      console.log(
        `${target.name}: scanned=${result.scanned}, toUpdate=${result.updated}${dryRun ? " (not written)" : ""}`
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
