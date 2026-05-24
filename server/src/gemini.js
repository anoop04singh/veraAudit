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

function buildAuditPrompt({ contractId, moduleData, recentEvents }) {
  const moduleSlice = truncateJsonByChars(moduleData, config.maxModuleCharsForAudit);
  const eventSlice = truncateJsonByChars(sanitizeEventsForPrompt(recentEvents), config.maxEventCharsForAudit);

  return [
    "You are an expert Sui Move smart contract security auditor.",
    "Audit the contract package and return strict JSON matching the provided schema.",
    "Focus on Move/Sui-specific risks:",
    "- object ownership and shared object misuse",
    "- missing authority checks",
    "- capability leakage",
    "- arithmetic and invariant safety",
    "- unsafe object transfer patterns",
    "",
    `Contract package ID: ${contractId}`,
    "",
    "Normalized modules:",
    moduleSlice.json,
    "",
    "Recent event context:",
    eventSlice.json,
    "",
    "Prompt metadata:",
    `module_context_truncated=${moduleSlice.truncated}`,
    `event_context_truncated=${eventSlice.truncated}`,
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

export async function runGeminiAudit({ contractId, moduleData, recentEvents, onRetryLog }) {
  assertHas("GEMINI_API_KEY", config.geminiApiKey);

  const client = getGeminiClient();
  const prompt = buildAuditPrompt({ contractId, moduleData, recentEvents });
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
