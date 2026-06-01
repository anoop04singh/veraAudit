import { GoogleGenAI } from "@google/genai";
import { config, assertHas } from "./config.js";
import { withRetries } from "./retry.js";
import { RAG_KNOWLEDGE } from "./ragKnowledge.js";

const TOKEN_RE = /[a-z0-9_:$]+/gi;
const embeddingCache = new Map();
let singletonClient = null;
let clientOverride = null;

function getClient() {
  if (clientOverride) return clientOverride;
  if (!singletonClient) {
    singletonClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return singletonClient;
}

export function __setRagClientForTests(client) {
  clientOverride = client;
}

function tokensFrom(value) {
  return String(value ?? "")
    .toLowerCase()
    .match(TOKEN_RE) ?? [];
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function collectModuleSignals(moduleData) {
  const moduleNames = Object.keys(moduleData ?? {});
  const exposedFunctions = [];
  const structNames = [];
  const fieldNames = [];

  for (const [moduleName, module] of Object.entries(moduleData ?? {})) {
    for (const [name, fn] of Object.entries(module?.exposedFunctions ?? {})) {
      const visibility = String(fn?.visibility ?? "");
      exposedFunctions.push(`${moduleName}::${name}:${visibility}`);
      for (const param of fn?.parameters ?? []) {
        fieldNames.push(JSON.stringify(param));
      }
    }

    for (const [name, struct] of Object.entries(module?.structs ?? {})) {
      structNames.push(`${moduleName}::${name}`);
      for (const field of struct?.fields ?? []) {
        fieldNames.push(field?.name);
        fieldNames.push(JSON.stringify(field?.type));
      }
    }
  }

  return {
    moduleNames: unique(moduleNames),
    exposedFunctions: unique(exposedFunctions).slice(0, 80),
    structNames: unique(structNames).slice(0, 80),
    fieldNames: unique(fieldNames).slice(0, 120),
  };
}

function inferCategories(signals) {
  const haystack = [
    ...signals.moduleNames,
    ...signals.exposedFunctions,
    ...signals.structNames,
    ...signals.fieldNames,
  ].join(" ").toLowerCase();

  const categories = new Set(["access_control", "object_management", "shared_objects"]);
  if (/admin|owner|auth|cap|role|permission|registry|submit|record|audit/.test(haystack)) {
    categories.add("access_control");
    categories.add("capability");
  }
  if (/transfer|recipient|send|withdraw|deposit|vault|treasury|coin|balance/.test(haystack)) {
    categories.add("transfer");
    categories.add("arithmetic");
  }
  if (/loan|flash|receipt|repay|borrow/.test(haystack)) {
    categories.add("flash_loan");
  }
  if (/upgrade|version|migrate/.test(haystack)) {
    categories.add("upgradeability");
  }
  if (/severity|string|vector|url|metadata|status|type/.test(haystack)) {
    categories.add("input_validation");
  }
  return Array.from(categories);
}

function buildRetrievalQueries({ contractId, moduleData, recentEvents }) {
  const signals = collectModuleSignals(moduleData);
  const categories = inferCategories(signals);
  const fnText = signals.exposedFunctions.slice(0, 24).join(", ");
  const structText = signals.structNames.slice(0, 24).join(", ");
  const eventTypes = unique((recentEvents ?? []).map((event) => event?.type)).slice(0, 20).join(", ");

  return {
    signals,
    categories,
    queries: [
      `Sui Move access control vulnerabilities for package ${contractId}: ${fnText}`,
      `Sui object ownership and shared object validation for structs: ${structText}`,
      `Move capability leakage risks and privileged functions: ${fnText}`,
      `Sui transaction and event history security context: ${eventTypes}`,
      "Move arithmetic precision invariant transfer treasury coin balance vulnerabilities",
      "Sui package upgrade registry attestation input validation risks",
      "Move hot potato flash loan receipt repayment shared object risks",
    ],
  };
}

function lexicalScore(query, chunk, categories) {
  const queryTokens = new Set(tokensFrom(query));
  const docTokens = new Set(tokensFrom(`${chunk.title} ${chunk.vuln_category} ${chunk.text}`));
  let score = 0;

  for (const token of queryTokens) {
    if (docTokens.has(token)) score += token.length > 4 ? 2 : 1;
  }

  if (categories.includes(chunk.vuln_category)) score += 7;
  score += Math.max(0, 4 - chunk.tier);
  if (chunk.source_type === "vulnerability_qa") score += 2;
  return score;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  if (!aNorm || !bNorm) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function readEmbeddingValues(response) {
  return response?.embedding?.values ?? response?.embeddings?.[0]?.values ?? response?.embeddings?.values ?? null;
}

async function embedText(text, { onRetryLog } = {}) {
  return (await embedMany([text], { onRetryLog }))[0];
}

async function embedMany(texts, { onRetryLog } = {}) {
  const cacheKeys = texts.map((text) => String(text ?? "").slice(0, 4000));
  const missingKeys = unique(cacheKeys.filter((key) => !embeddingCache.has(key)));

  if (missingKeys.length === 0) {
    return cacheKeys.map((key) => embeddingCache.get(key));
  }

  assertHas("GEMINI_API_KEY", config.geminiApiKey);
  const client = getClient();

  const response = await withRetries(
    "gemini.embedContent",
    async () =>
      client.models.embedContent({
        model: config.geminiEmbeddingModel,
        contents: missingKeys,
        config: {
          outputDimensionality: config.geminiEmbeddingDimensions,
          taskType: "SEMANTIC_SIMILARITY",
        },
      }),
    {
      maxAttempts: config.ragEmbeddingRetryMaxAttempts,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
      onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
        onRetryLog?.(
          `Embedding retry ${attempt}/${maxAttempts - 1} in ${Math.ceil(delayMs / 1000)}s: ${error.message}`,
        );
      },
    },
  );

  const embeddings = response?.embeddings ?? [];
  if (Array.isArray(embeddings) && embeddings.length >= missingKeys.length) {
    missingKeys.forEach((key, index) => {
      const values = embeddings[index]?.values;
      if (Array.isArray(values)) {
        embeddingCache.set(key, values);
      }
    });
  } else {
    const values = readEmbeddingValues(response);
    if (Array.isArray(values) && missingKeys.length === 1) {
      embeddingCache.set(missingKeys[0], values);
    }
  }

  const result = cacheKeys.map((key) => embeddingCache.get(key));
  if (result.some((values) => !Array.isArray(values))) {
    throw new Error("Gemini embedding response did not include vector values.");
  }

  return result;
}

async function retrieveWithEmbeddings({ queries, categories, onRetryLog }) {
  const documents = RAG_KNOWLEDGE.map((chunk) => `${chunk.title}\n${chunk.text}`);
  const [queryEmbedding, ...chunkEmbeddings] = await embedMany([queries.join("\n"), ...documents], { onRetryLog });
  const scored = [];

  for (const [index, chunk] of RAG_KNOWLEDGE.entries()) {
    const chunkEmbedding = chunkEmbeddings[index];
    const semantic = cosineSimilarity(queryEmbedding, chunkEmbedding) * 100;
    const lexical = lexicalScore(queries.join(" "), chunk, categories);
    scored.push({
      ...chunk,
      score: semantic + lexical,
      semantic_score: Number(semantic.toFixed(4)),
      lexical_score: lexical,
    });
  }

  return scored;
}

function retrieveLexically({ queries, categories }) {
  const queryText = queries.join(" ");
  return RAG_KNOWLEDGE.map((chunk) => ({
    ...chunk,
    score: lexicalScore(queryText, chunk, categories),
    semantic_score: null,
    lexical_score: lexicalScore(queryText, chunk, categories),
  }));
}

function assembleContext(chunks) {
  return chunks
    .map((chunk, index) =>
      [
        `[RAG-${index + 1}] ${chunk.title}`,
        `source=${chunk.source_url}`,
        `category=${chunk.vuln_category}; tier=${chunk.tier}; type=${chunk.source_type}`,
        chunk.text,
      ].join("\n"),
    )
    .join("\n\n");
}

export async function retrieveAuditContext({ contractId, moduleData, recentEvents, onRetryLog }) {
  if (!config.ragEnabled) {
    return {
      enabled: false,
      embedding_used: false,
      context_text: "",
      chunks: [],
      queries: [],
      categories: [],
      warning: "RAG disabled by configuration.",
    };
  }

  const { queries, categories, signals } = buildRetrievalQueries({ contractId, moduleData, recentEvents });
  let embeddingUsed = false;
  let warning = "";
  let scored;

  if (config.ragUseEmbeddings) {
    try {
      scored = await retrieveWithEmbeddings({ queries, categories, onRetryLog });
      embeddingUsed = true;
    } catch (error) {
      warning = `Embedding retrieval unavailable; using lexical fallback. ${error.message}`;
      onRetryLog?.(warning);
      scored = retrieveLexically({ queries, categories });
    }
  } else {
    scored = retrieveLexically({ queries, categories });
  }

  const chunks = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, config.ragTopK)
    .map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      source_url: chunk.source_url,
      source_type: chunk.source_type,
      tier: chunk.tier,
      vuln_category: chunk.vuln_category,
      score: Number(chunk.score.toFixed(4)),
      semantic_score: chunk.semantic_score,
      lexical_score: chunk.lexical_score,
      text: chunk.text,
    }));

  return {
    enabled: true,
    embedding_used: embeddingUsed,
    context_text: assembleContext(chunks),
    chunks,
    queries,
    categories,
    signals,
    warning,
  };
}
