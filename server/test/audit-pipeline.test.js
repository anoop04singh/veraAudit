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
    maxContextFunctionQueries: 12,
    contextTransactionsPerFunction: 5,
    maxContextTransactions: 10,
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
        if (method === "suix_queryTransactionBlocks") {
          const moveFunction = params?.[0]?.filter?.MoveFunction;
          const module = moveFunction?.module ?? "registry";
          const functionName = moveFunction?.function ?? "submit_audit";
          return {
            data: [
              {
                digest: `tx-${module}-${functionName}`,
                timestampMs: "1000",
                events: [
                  { id: { txDigest: `tx-${module}` }, timestampMs: "1000", parsedJson: { module }, type: "event" },
                ],
                effects: { status: { status: "success" }, created: [], mutated: [], deleted: [] },
              },
            ],
          };
        }
        throw new Error(`Unexpected method ${method}`);
      },
      runGeminiAudit: async ({ recentTransactions }) => ({
        summary: "ok",
        severity: "low",
        findings: [{ id: "F-1", title: "x", severity: "low", location: "a", description: "b", recommendation: "c" }],
        positive_patterns: ["checks"],
        confidence: 0.74,
        recentTransactionsSeen: recentTransactions?.length,
      }),
      retrieveAuditContext: async () => ({
        enabled: true,
        embedding_used: false,
        context_text: "Sui Move access control context",
        chunks: [{ title: "Access control" }],
        queries: ["access control"],
        categories: ["access_control"],
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
  assert.deepEqual(progressSteps, ["fetch", "context", "rag", "audit", "walrus", "anchor"]);

  const outputSteps = events
    .filter((entry) => entry.event === "step_output")
    .map((entry) => entry.payload.step);
  assert.deepEqual(outputSteps, ["fetch", "context", "rag", "audit", "walrus", "anchor"]);

  const completion = events.find((entry) => entry.event === "complete");
  assert.ok(completion);
  assert.equal(completion.payload.contract_id, "0xabc");
  assert.equal(completion.payload.blob_id, "blob-1");
  assert.equal(completion.payload.tx_digest, "digest-1");
  assert.equal(completion.payload.findings_count, 1);
});

test("audit pipeline tolerates missing referenced events during event fallback", async () => {
  const events = [];
  const pipeline = createAuditPipeline({
    config: createBaseConfig(),
    services: {
      suiRpc: async (method) => {
        if (method === "sui_getNormalizedMoveModulesByPackage") {
          return { registry: { exposedFunctions: {} } };
        }
        if (method === "suix_queryEvents") {
          throw new Error(
            'Tatum RPC suix_queryEvents error: {"code":-32603,"message":"Could not find the referenced transaction events [TransactionDigest(example)]."}',
          );
        }
        throw new Error(`Unexpected method ${method}`);
      },
      retrieveAuditContext: async () => ({
        enabled: true,
        embedding_used: false,
        context_text: "context",
        chunks: [],
        queries: [],
        categories: [],
      }),
      runGeminiAudit: async () => ({
        summary: "ok",
        severity: "clean",
        findings: [],
        positive_patterns: [],
        confidence: 0.8,
      }),
      storeAuditBlob: async () => "blob-2",
      anchorAuditOnSui: async () => ({ digest: "digest-2", simulated: true }),
      severityToInt: () => 0,
    },
  });

  await pipeline({
    contractId: "0xabc",
    emit: (event, payload) => events.push({ event, payload }),
  });

  const contextOutput = events.find((entry) => entry.event === "step_output" && entry.payload.step === "context");
  assert.equal(contextOutput.payload.output.fallback_event_query_used, true);
  assert.match(contextOutput.payload.output.fallback_warning, /Could not find the referenced transaction events/);

  const completion = events.find((entry) => entry.event === "complete");
  assert.ok(completion);
  assert.equal(completion.payload.blob_id, "blob-2");
});
