import test from "node:test";
import assert from "node:assert/strict";
import { runGeminiAudit, __setGeminiClientForTests } from "../src/gemini.js";
import { config } from "../src/config.js";

test("runGeminiAudit retries 429 and returns parsed JSON", async () => {
  const previousApiKey = config.geminiApiKey;
  const previousMaxAttempts = config.retryMaxAttempts;
  const previousBaseDelay = config.retryBaseDelayMs;
  const previousMaxDelay = config.retryMaxDelayMs;

  config.geminiApiKey = "test-key";
  config.retryMaxAttempts = 3;
  config.retryBaseDelayMs = 1;
  config.retryMaxDelayMs = 5;

  let calls = 0;
  __setGeminiClientForTests({
    models: {
      generateContent: async () => {
        calls += 1;
        if (calls === 1) {
          const error = new Error("429 Resource exhausted. Please retry in 0.01s");
          error.status = 429;
          throw error;
        }
        return {
          text: JSON.stringify({
            summary: "test",
            severity: "low",
            safe_to_interact: true,
            safe_to_interact_rationale: "No material user interaction risk was identified in the available evidence.",
            findings: [],
            positive_patterns: [],
            confidence: 0.55,
          }),
        };
      },
    },
  });

  const result = await runGeminiAudit({
    contractId: "0x1",
    moduleData: { m: {} },
    recentEvents: [],
  });

  assert.equal(calls, 2);
  assert.equal(result.summary, "test");
  assert.equal(result.severity, "low");
  assert.equal(result.safe_to_interact, true);

  __setGeminiClientForTests(null);
  config.geminiApiKey = previousApiKey;
  config.retryMaxAttempts = previousMaxAttempts;
  config.retryBaseDelayMs = previousBaseDelay;
  config.retryMaxDelayMs = previousMaxDelay;
});
