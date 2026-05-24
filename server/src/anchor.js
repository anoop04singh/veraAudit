import { createHash } from "crypto";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { config } from "./config.js";
import { withRetries } from "./retry.js";
import { tatumFetch } from "./tatumTransport.js";
import { getErrorStatusCode } from "./retry.js";

const severityMap = {
  clean: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function severityToInt(severity) {
  return severityMap[severity] ?? 1;
}

export async function anchorAuditOnSui({ contractId, blobId, auditHash, severity, timestampMs }) {
  if (!config.suiPrivateKey || !config.registryPackageId || !config.registryObjectId) {
    return {
      simulated: true,
      digest: `simulated_${createHash("sha1").update(blobId).digest("hex").slice(0, 12)}`,
      message: "On-chain anchoring skipped. Set SUI_PRIVATE_KEY, REGISTRY_PACKAGE_ID, and REGISTRY_OBJECT_ID.",
    };
  }

  const signer = Ed25519Keypair.fromSecretKey(config.suiPrivateKey);

  const buildClient = ({ url, useTatumHeader }) =>
    new SuiClient({
      url,
      fetch: (targetUrl, options = {}) => {
        const headers = new Headers(options.headers || {});
        if (useTatumHeader && config.tatumApiKey) {
          headers.set("x-api-key", config.tatumApiKey);
        }
        return tatumFetch(targetUrl, { ...options, headers });
      },
    });

  const executeAnchor = async (client) =>
    withRetries(
      "sui.anchorAudit",
      async () => {
        const tx = new Transaction();
        tx.moveCall({
          target: `${config.registryPackageId}::registry::submit_audit`,
          arguments: [
            tx.object(config.registryObjectId),
            tx.pure.address(contractId),
            tx.pure.string(blobId),
            tx.pure.string(auditHash),
            tx.pure.u8(severity),
            tx.pure.u64(timestampMs),
          ],
        });

        const result = await client.signAndExecuteTransaction({
          signer,
          transaction: tx,
          options: {
            showEffects: false,
            showEvents: false,
          },
        });

        return {
          simulated: false,
          digest: result.digest,
          effects: result.effects,
        };
      },
      {
        maxAttempts: config.retryMaxAttempts,
        baseDelayMs: config.retryBaseDelayMs,
        maxDelayMs: config.retryMaxDelayMs,
      },
    );

  const primaryClient = buildClient({
    url: config.tatumSuiRpc,
    useTatumHeader: true,
  });

  try {
    return await executeAnchor(primaryClient);
  } catch (error) {
    const status = getErrorStatusCode(error);
    const shouldFallback =
      status === 429 &&
      config.suiAnchorRpcFallback &&
      config.suiAnchorRpcFallback !== config.tatumSuiRpc;

    if (!shouldFallback) {
      throw error;
    }

    console.warn(
      `[Anchor] Primary RPC returned 429. Falling back to ${config.suiAnchorRpcFallback} for anchor submission.`,
    );

    const fallbackClient = buildClient({
      url: config.suiAnchorRpcFallback,
      useTatumHeader: false,
    });

    return executeAnchor(fallbackClient);
  }
}
