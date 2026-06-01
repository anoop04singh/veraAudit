import test from "node:test";
import assert from "node:assert/strict";
import { retrieveAuditContext, __setRagClientForTests } from "../src/rag.js";
import { config } from "../src/config.js";

function restore(previous) {
  Object.assign(config, previous);
  __setRagClientForTests(null);
}

test("retrieveAuditContext ranks Sui access-control guidance with lexical fallback", async () => {
  const previous = {
    ragEnabled: config.ragEnabled,
    ragUseEmbeddings: config.ragUseEmbeddings,
    ragTopK: config.ragTopK,
  };

  config.ragEnabled = true;
  config.ragUseEmbeddings = false;
  config.ragTopK = 4;

  const result = await retrieveAuditContext({
    contractId: "0xabc",
    moduleData: {
      registry: {
        exposedFunctions: {
          submit_audit: { visibility: "Public", parameters: ["&mut AuditRegistry", "address", "String"] },
        },
        structs: {
          AuditRegistry: { fields: [{ name: "entries", type: "vector<AuditEntry>" }] },
        },
      },
    },
    recentEvents: [],
  });

  assert.equal(result.enabled, true);
  assert.equal(result.embedding_used, false);
  assert.ok(result.categories.includes("access_control"));
  assert.ok(result.chunks.length > 0);
  assert.match(result.context_text, /access control|Registry|attestation/i);

  restore(previous);
});

test("retrieveAuditContext uses Gemini embeddings when available", async () => {
  const previous = {
    geminiApiKey: config.geminiApiKey,
    ragEnabled: config.ragEnabled,
    ragUseEmbeddings: config.ragUseEmbeddings,
    ragTopK: config.ragTopK,
    ragEmbeddingRetryMaxAttempts: config.ragEmbeddingRetryMaxAttempts,
  };

  config.geminiApiKey = "test-key";
  config.ragEnabled = true;
  config.ragUseEmbeddings = true;
  config.ragTopK = 3;
  config.ragEmbeddingRetryMaxAttempts = 1;

  let calls = 0;
  __setRagClientForTests({
    models: {
      embedContent: async ({ contents }) => {
        calls += 1;
        const inputs = Array.isArray(contents) ? contents : [contents];
        const embeddings = inputs.map((input) => {
          const text = String(input ?? "");
          const accessWeight = /access|registry|capability|audit/i.test(text) ? 1 : 0.25;
          return {
            values: [accessWeight, text.length % 7, 0.5],
          };
        });
        return {
          embeddings,
        };
      },
    },
  });

  const result = await retrieveAuditContext({
    contractId: "0xabc",
    moduleData: {
      registry: {
        exposedFunctions: {
          submit_audit: { visibility: "Public", parameters: ["&mut AuditRegistry"] },
        },
      },
    },
    recentEvents: [],
  });

  assert.equal(result.embedding_used, true);
  assert.ok(calls >= 1);
  assert.ok(result.chunks.length <= 3);

  restore(previous);
});
