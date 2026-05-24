import test from "node:test";
import assert from "node:assert/strict";
import { createAuditPipeline } from "../src/auditPipeline.js";

function createBaseConfig() {
  return {
    appNetworkLabel: "sui:testnet",
    geminiModel: "gemini-2.5-flash",
    retryMaxAttempts: 2,
    retryBaseDelayMs: 1,
    retryMaxDelayMs: 5,
    contextModuleQueryConcurrency: 2,
    maxContextEvents: 10,
  };
}

test("audit pipeline emits progress, outputs and completion payload", async () => {
  const events = [];
  const pipeline = createAuditPipeline({
    config: createBaseConfig(),
    services: {
      suiRpc: async (method, params) => {
        if (method === "sui_getNormalizedMoveModulesByPackage") {
          return { registry: { exposedFunctions: ["submit_audit"] }, vault: {} };
        }
        if (method === "suix_queryEvents") {
          const module = params?.[0]?.MoveModule?.module ?? "registry";
          return {
            data: [
              { id: { txDigest: `tx-${module}` }, timestampMs: "1000", parsedJson: { module } },
            ],
          };
        }
        throw new Error(`Unexpected method ${method}`);
      },
      runGeminiAudit: async () => ({
        summary: "ok",
        severity: "low",
        findings: [{ id: "F-1", title: "x", severity: "low", location: "a", description: "b", recommendation: "c" }],
        positive_patterns: ["checks"],
        confidence: 0.74,
      }),
      storeAuditBlob: async () => "blob-1",
      anchorAuditOnSui: async () => ({ digest: "digest-1", simulated: true }),
      severityToInt: () => 1,
    },
  });

  await pipeline({
    contractId: "0xabc",
    emit: (event, payload) => events.push({ event, payload }),
  });

  const progressSteps = events
    .filter((entry) => entry.event === "progress")
    .map((entry) => entry.payload.step);
  assert.deepEqual(progressSteps, ["fetch", "context", "audit", "walrus", "anchor"]);

  const outputSteps = events
    .filter((entry) => entry.event === "step_output")
    .map((entry) => entry.payload.step);
  assert.deepEqual(outputSteps, ["fetch", "context", "audit", "walrus", "anchor"]);

  const completion = events.find((entry) => entry.event === "complete");
  assert.ok(completion);
  assert.equal(completion.payload.contract_id, "0xabc");
  assert.equal(completion.payload.blob_id, "blob-1");
  assert.equal(completion.payload.tx_digest, "digest-1");
  assert.equal(completion.payload.findings_count, 1);
});
