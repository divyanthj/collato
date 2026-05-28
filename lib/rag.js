import { getDatabase } from "@/lib/mongodb";
import { openai } from "@/lib/openai";
const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_CHUNK_LENGTH = 900;
const CHUNK_OVERLAP = 120;
function normalizeWhitespace(value) {
    return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function splitLargeBlock(block, maxLength) {
    const text = normalizeWhitespace(block);
    if (!text) {
        return [];
    }
    if (text.length <= maxLength) {
        return [text];
    }
    const segments = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + maxLength, text.length);
        segments.push(text.slice(start, end).trim());
        if (end >= text.length) {
            break;
        }
        start = Math.max(end - CHUNK_OVERLAP, start + 1);
    }
    return segments.filter(Boolean);
}
function chunkText(input) {
    const text = normalizeWhitespace(input);
    if (!text) {
        return [];
    }
    const blocks = text.split(/\n\s*\n/).flatMap((block) => splitLargeBlock(block, MAX_CHUNK_LENGTH));
    const chunks = [];
    let current = "";
    for (const block of blocks) {
        if (!current) {
            current = block;
            continue;
        }
        if (`${current}\n\n${block}`.length <= MAX_CHUNK_LENGTH) {
            current = `${current}\n\n${block}`;
            continue;
        }
        chunks.push(current);
        current = block;
    }
    if (current) {
        chunks.push(current);
    }
    return chunks;
}
function cosineSimilarity(a, b) {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
        return 0;
    }
    let dotProduct = 0;
    let aMagnitude = 0;
    let bMagnitude = 0;
    for (let index = 0; index < a.length; index += 1) {
        dotProduct += a[index] * b[index];
        aMagnitude += a[index] * a[index];
        bMagnitude += b[index] * b[index];
    }
    if (!aMagnitude || !bMagnitude) {
        return 0;
    }
    return dotProduct / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}
async function createEmbeddings(texts) {
    if (texts.length === 0) {
        return [];
    }
    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts
    });
    return response.data.map((item) => item.embedding);
}
function buildFileChunkInputs(file) {
    const sourceLabel = `File: ${file.fileName}`;
    return chunkText(file.knowledgeText).map((text, index) => ({
        workspaceSlug: file.workspaceSlug,
        sourceType: "file",
        sourceId: file.id,
        chunkIndex: index,
        sourceLabel,
        title: file.fileName,
        text,
        createdAt: new Date(file.createdAt)
    }));
}
function buildInternalSourceChunkInputs(source) {
    const tenantSlug = String(source.tenantSlug ?? source.workspaceSlug ?? "").trim();
    const sourceApp = String(source.sourceApp ?? "internal").trim();
    const sourceType = String(source.sourceType ?? "source").trim();
    const sourceId = String(source.sourceId ?? source.id ?? "").trim();
    const title = String(source.title ?? source.fileName ?? sourceId).trim() || sourceId;
    const text = String(source.text ?? source.knowledgeText ?? "").trim();
    return chunkText(text).map((chunkTextValue, index) => ({
        tenantSlug,
        workspaceSlug: tenantSlug,
        sourceApp,
        sourceType,
        sourceId,
        chunkIndex: index,
        sourceLabel: source.sourceLabel ?? `${sourceApp}: ${sourceType} | ${title}`,
        title,
        text: chunkTextValue,
        metadata: source.metadata ?? {},
        createdAt: new Date(source.createdAt ?? Date.now()),
        updatedAt: new Date(source.updatedAt ?? Date.now())
    }));
}
function buildUpdateText(update) {
    const sections = [
        `Channel: ${update.channel}`,
        `Submitted by: ${update.createdByName}`,
        `Summary: ${update.structured.summary}`,
        update.structured.keyPoints.length ? `Key points: ${update.structured.keyPoints.join("; ")}` : "",
        update.structured.actionItems.length ? `Action items: ${update.structured.actionItems.join("; ")}` : "",
        `Knowledge contribution: ${update.structured.knowledgeContribution}`,
        `Raw update: ${update.body}`
    ];
    return sections.filter(Boolean).join("\n");
}
function buildUpdateChunkInputs(update) {
    const sourceLabel = `Update: ${update.createdByName} | ${new Date(update.createdAt).toLocaleDateString()}`;
    return chunkText(buildUpdateText(update)).map((text, index) => ({
        workspaceSlug: update.workspaceSlug,
        sourceType: "update",
        sourceId: update.id,
        chunkIndex: index,
        sourceLabel,
        title: `${update.channel} update`,
        text,
        createdAt: new Date(update.createdAt)
    }));
}
async function replaceChunks(sourceType, sourceId, chunks) {
    const db = await getDatabase();
    const collection = db.collection("workspace_knowledge_chunks");
    const tenantSlug = String(chunks[0]?.tenantSlug ?? "").trim();
    await collection.deleteMany({
        sourceType,
        sourceId,
        ...(tenantSlug ? { tenantSlug } : {})
    });
    if (chunks.length === 0) {
        return;
    }
    const embeddings = await createEmbeddings(chunks.map((chunk) => chunk.text));
    const documents = chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index]
    }));
    await collection.insertMany(documents);
}
export async function indexWorkspaceFile(file) {
    if (file.aiPrivate) {
        await clearWorkspaceChunksForSource({
            sourceType: "file",
            sourceId: file.id
        });
        return;
    }
    await replaceChunks("file", file.id, buildFileChunkInputs(file));
}
export async function indexWorkspaceUpdate(update) {
    if (update.aiPrivate) {
        await clearWorkspaceChunksForSource({
            sourceType: "update",
            sourceId: update.id
        });
        return;
    }
    await replaceChunks("update", update.id, buildUpdateChunkInputs(update));
}
export async function ensureWorkspaceChunkCoverage(input) {
    const db = await getDatabase();
    const collection = db.collection("workspace_knowledge_chunks");
    const existing = await collection
        .find({ workspaceSlug: input.workspaceSlug }, { projection: { _id: 0, sourceType: 1, sourceId: 1 } })
        .toArray();
    const sourceKeys = new Set(existing.map((item) => `${String(item.sourceType)}:${String(item.sourceId)}`));
    for (const file of input.files) {
        if (file.aiPrivate) {
            if (sourceKeys.has(`file:${file.id}`)) {
                await clearWorkspaceChunksForSource({
                    sourceType: "file",
                    sourceId: file.id
                });
            }
            continue;
        }
        if (!sourceKeys.has(`file:${file.id}`)) {
            await indexWorkspaceFile(file);
        }
    }
    for (const update of input.updates) {
        if (update.aiPrivate) {
            if (sourceKeys.has(`update:${update.id}`)) {
                await clearWorkspaceChunksForSource({
                    sourceType: "update",
                    sourceId: update.id
                });
            }
            continue;
        }
        if (!sourceKeys.has(`update:${update.id}`)) {
            await indexWorkspaceUpdate(update);
        }
    }
}
export async function retrieveWorkspaceChunks(input) {
    const db = await getDatabase();
    const collection = db.collection("workspace_knowledge_chunks");
    const questionText = normalizeWhitespace(input.question);
    if (!questionText) {
        return [];
    }
    const questionEmbedding = (await createEmbeddings([questionText]))[0];
    if (!questionEmbedding) {
        return [];
    }
    const storedChunks = await collection
        .find({ workspaceSlug: input.workspaceSlug }, {
        projection: {
            _id: 0,
            sourceType: 1,
            sourceId: 1,
            sourceLabel: 1,
            title: 1,
            text: 1,
            embedding: 1,
            createdAt: 1
        }
    })
        .toArray();
    const ranked = storedChunks
        .map((chunk) => ({
        sourceType: (chunk.sourceType === "update" ? "update" : "file"),
        sourceId: String(chunk.sourceId),
        sourceLabel: String(chunk.sourceLabel),
        title: String(chunk.title),
        text: String(chunk.text),
        similarity: cosineSimilarity(Array.isArray(chunk.embedding) ? chunk.embedding.map((value) => Number(value)) : [], questionEmbedding),
        createdAt: chunk.createdAt instanceof Date
            ? chunk.createdAt.getTime()
            : new Date(String(chunk.createdAt ?? new Date(0))).getTime()
    }))
        .sort((left, right) => {
        if (right.similarity !== left.similarity) {
            return right.similarity - left.similarity;
        }
        return right.createdAt - left.createdAt;
    });
    const limit = input.limit ?? 6;
    const uniqueSourceIds = new Set();
    const results = [];
    for (const chunk of ranked) {
        const sourceKey = `${chunk.sourceType}:${chunk.sourceId}`;
        if (uniqueSourceIds.has(sourceKey) && results.length >= limit) {
            continue;
        }
        results.push({
            sourceType: chunk.sourceType,
            sourceId: chunk.sourceId,
            sourceLabel: chunk.sourceLabel,
            title: chunk.title,
            text: chunk.text,
            similarity: chunk.similarity
        });
        uniqueSourceIds.add(sourceKey);
        if (results.length >= limit) {
            break;
        }
    }
    return results;
}
export async function indexKnowledgeSource(source) {
    const sourceType = String(source.sourceType ?? "source").trim();
    const sourceId = String(source.sourceId ?? source.id ?? "").trim();
    const tenantSlug = String(source.tenantSlug ?? source.workspaceSlug ?? "").trim();
    if (!tenantSlug || !sourceId) {
        throw new Error("tenantSlug and sourceId are required to index knowledge.");
    }
    await replaceChunks(sourceType, sourceId, buildInternalSourceChunkInputs({
        ...source,
        tenantSlug,
        sourceType,
        sourceId
    }));
}
export async function retrieveKnowledgeChunks(input) {
    const db = await getDatabase();
    const collection = db.collection("workspace_knowledge_chunks");
    const questionText = normalizeWhitespace(input.question);
    const tenantSlug = String(input.tenantSlug ?? input.workspaceSlug ?? "").trim();
    if (!questionText || !tenantSlug) {
        return [];
    }
    const questionEmbedding = (await createEmbeddings([questionText]))[0];
    if (!questionEmbedding) {
        return [];
    }
    const storedChunks = await collection
        .find({ tenantSlug }, {
        projection: {
            _id: 0,
            tenantSlug: 1,
            sourceApp: 1,
            sourceType: 1,
            sourceId: 1,
            sourceLabel: 1,
            title: 1,
            text: 1,
            metadata: 1,
            embedding: 1,
            createdAt: 1
        }
    })
        .toArray();
    const ranked = storedChunks
        .map((chunk) => ({
        tenantSlug: String(chunk.tenantSlug ?? tenantSlug),
        sourceApp: String(chunk.sourceApp ?? ""),
        sourceType: String(chunk.sourceType ?? "source"),
        sourceId: String(chunk.sourceId),
        sourceLabel: String(chunk.sourceLabel),
        title: String(chunk.title),
        text: String(chunk.text),
        metadata: chunk.metadata ?? {},
        similarity: cosineSimilarity(Array.isArray(chunk.embedding) ? chunk.embedding.map((value) => Number(value)) : [], questionEmbedding),
        createdAt: chunk.createdAt instanceof Date
            ? chunk.createdAt.getTime()
            : new Date(String(chunk.createdAt ?? new Date(0))).getTime()
    }))
        .sort((left, right) => {
        if (right.similarity !== left.similarity) {
            return right.similarity - left.similarity;
        }
        return right.createdAt - left.createdAt;
    });
    const limit = input.limit ?? 8;
    const results = [];
    for (const chunk of ranked) {
        results.push(chunk);
        if (results.length >= limit) {
            break;
        }
    }
    return results;
}
export async function clearKnowledgeChunksForSource(input) {
    const db = await getDatabase();
    const collection = db.collection("workspace_knowledge_chunks");
    const tenantSlug = String(input.tenantSlug ?? input.workspaceSlug ?? "").trim();
    const sourceType = String(input.sourceType ?? "").trim();
    const sourceId = String(input.sourceId ?? "").trim();
    await collection.deleteMany({
        ...(tenantSlug ? { tenantSlug } : {}),
        ...(sourceType ? { sourceType } : {}),
        sourceId
    });
}
export async function clearWorkspaceChunksForSource(input) {
    const db = await getDatabase();
    const collection = db.collection("workspace_knowledge_chunks");
    await collection.deleteMany({
        sourceType: input.sourceType,
        sourceId: input.sourceId
    });
}
