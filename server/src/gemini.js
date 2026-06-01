import { GoogleGenAI } from "@google/genai";
import { config, assertHas } from "./config.js";
import { withRetries } from "./retry.js";

const auditSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    severity: {
      type: "string",
      enum: ["clean", "low", "medium", "high", "critical"],
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          severity: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
          },
          location: { type: "string" },
          description: { type: "string" },
          recommendation: { type: "string" },
          reference: { type: "string" },
        },
        required: ["id", "title", "severity", "location", "description", "recommendation"],
      },
    },
    positive_patterns: {
      type: "array",
      items: { type: "string" },
    },
    confidence: {
      type: "number",
    },
  },
  required: ["summary", "severity", "findings", "positive_patterns", "confidence"],
};

function truncateJsonByChars(value, maxChars) {
  const json = JSON.stringify(value, null, 2);
  if (json.length <= maxChars) {
    return { json, truncated: false };
  }
  const sliced = json.slice(0, maxChars);
  return { json: `${sliced}\n... [truncated]`, truncated: true };
}

function sanitizeEventsForPrompt(events) {
  return events.map((event) => ({
    id: event?.id,
    timestampMs: event?.timestampMs,
    type: event?.type,
    parsedJson: event?.parsedJson,
    sender: event?.sender,
  }));
}

function sanitizeRagContext(ragContext) {
  if (!ragContext?.context_text) return "";
  if (ragContext.context_text.length <= config.maxRagCharsForAudit) return ragContext.context_text;
  return `${ragContext.context_text.slice(0, config.maxRagCharsForAudit)}\n... [truncated]`;
}

function sanitizeTransactionsForPrompt(transactions) {
  return (transactions ?? []).map((tx) => ({
    digest: tx?.digest,
    timestampMs: tx?.timestampMs,
    checkpoint: tx?.checkpoint,
    sender: tx?.transaction?.sender,
    gasBudget: tx?.transaction?.gasBudget,
    commandCount: tx?.transaction?.commands,
    status: tx?.effects?.status,
    gasUsed: tx?.effects?.gasUsed,
    created: tx?.effects?.created,
    mutated: tx?.effects?.mutated,
    deleted: tx?.effects?.deleted,
    eventTypes: (tx?.events ?? []).map((event) => event.type),
  }));
}

function buildAuditPrompt({ contractId, moduleData, recentEvents, recentTransactions, ragContext }) {
  const moduleSlice = truncateJsonByChars(moduleData, config.maxModuleCharsForAudit);
  const txSlice = truncateJsonByChars(sanitizeTransactionsForPrompt(recentTransactions), config.maxTransactionCharsForAudit);
  const eventSlice = truncateJsonByChars(sanitizeEventsForPrompt(recentEvents), config.maxEventCharsForAudit);
  const ragText = sanitizeRagContext(ragContext);

  return [
    "You are an expert Sui Move smart contract security auditor.",
    "Audit the contract package and return strict JSON matching the provided schema.",
    "Use the retrieved Sui/Move security context to ground findings and recommendations.",
    "When a finding is informed by retrieved context, include a short reference field using the matching RAG source label or URL.",
    "Do not invent vulnerabilities that are not supported by the module snapshot, event context, or retrieved context.",
    "Focus on Move/Sui-specific risks:",
    "- object ownership and shared object misuse",
    "- missing authority checks",
    "- capability leakage",
    "- arithmetic and invariant safety",
    "- unsafe object transfer patterns",
    "",
    `Contract package ID: ${contractId}`,
    "",
    "Retrieved Sui/Move security context:",
    ragText || "No retrieved context available.",
    "",
    "Normalized modules:",
    moduleSlice.json,
    "",
    "Recent transaction context from Tatum:",
    txSlice.json,
    "",
    "Recent event context:",
    eventSlice.json,
    "",
    "Prompt metadata:",
    `module_context_truncated=${moduleSlice.truncated}`,
    `transaction_context_truncated=${txSlice.truncated}`,
    `event_context_truncated=${eventSlice.truncated}`,
    `rag_enabled=${ragContext?.enabled ?? false}`,
    `rag_embedding_used=${ragContext?.embedding_used ?? false}`,
    `rag_context_count=${ragContext?.chunks?.length ?? 0}`,
  ].join("\n");
}

let singletonClient = null;
let clientOverride = null;

function getGeminiClient() {
  if (clientOverride) {
    return clientOverride;
  }
  if (!singletonClient) {
    singletonClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return singletonClient;
}

export function __setGeminiClientForTests(client) {
  clientOverride = client;
}

export async function runGeminiAudit({ contractId, moduleData, recentEvents, recentTransactions, ragContext, onRetryLog }) {
  assertHas("GEMINI_API_KEY", config.geminiApiKey);

  const client = getGeminiClient();
  const prompt = buildAuditPrompt({ contractId, moduleData, recentEvents, recentTransactions, ragContext });
  const response = await withRetries(
    "gemini.generateContent",
    async () =>
      client.models.generateContent({
        model: config.geminiModel,
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: auditSchema,
        },
      }),
    {
      maxAttempts: config.retryMaxAttempts,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
      onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
        if (typeof onRetryLog === "function") {
          onRetryLog(
            `Gemini retry ${attempt}/${maxAttempts - 1} in ${Math.ceil(delayMs / 1000)}s: ${error.message}`,
          );
        }
      },
    },
  );

  const text = response.text ?? "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned non-JSON output.");
  }

  return parsed;
}
