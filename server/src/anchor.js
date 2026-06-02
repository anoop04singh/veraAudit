import { createHash } from "crypto";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { JsonRpcHTTPTransport, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { config } from "./config.js";
import { withRetries, getErrorStatusCode, enrichHttpError } from "./retry.js";
import { tatumFetch } from "./tatumTransport.js";

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

function createRpcFetch(isTatum) {
  return async (targetUrl, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (isTatum && config.tatumApiKey) {
      headers.set("x-api-key", config.tatumApiKey);
      return tatumFetch(targetUrl, { ...options, headers });
    }
    return fetch(targetUrl, { ...options, headers });
  };
}

function createSuiClient(url, isTatum) {
  return new SuiJsonRpcClient({
    url,
    network: "mainnet",
    transport: new JsonRpcHTTPTransport({
      url,
      fetch: createRpcFetch(isTatum),
      rpc: isTatum && config.tatumApiKey ? { headers: { "x-api-key": config.tatumApiKey } } : undefined,
    }),
  });
}

async function buildAndSignTransaction({ contractId, quiltId, auditHash, severity, client }) {
  const tx = new Transaction();
  const signer = Ed25519Keypair.fromSecretKey(config.suiPrivateKey);
  tx.setSenderIfNotSet(signer.toSuiAddress());
  tx.moveCall({
    target: `${config.registryPackageId}::registry::submit_audit`,
    arguments: [
      tx.object(config.adminCapObjectId),
      tx.object(config.registryObjectId),
      tx.object(config.suiClockObjectId),
      tx.pure.address(contractId),
      tx.pure.string(quiltId),
      tx.pure.string(auditHash),
      tx.pure.u8(severity),
    ],
  });

  const txBytes = await tx.build({ client });
  const signedTx = await signer.signTransaction(txBytes);

  return {
    txBytes: signedTx.bytes,
    signatures: [signedTx.signature],
  };
}

async function executeJsonRpc(url, txData, { useTatum }) {
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "sui_executeTransactionBlock",
    params: [
      txData.txBytes,
      txData.signatures,
      { showEffects: true, showEvents: false },
      "WaitForEffectsCert",
    ],
  };

  const headers = {
    "Content-Type": "application/json",
  };

  if (useTatum) {
    headers["x-api-key"] = config.tatumApiKey;
  }

  const send = useTatum ? tatumFetch : fetch;
  const response = await send(url, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw enrichHttpError(new Error(`HTTP ${response.status}: ${response.statusText}`), response, bodyText);
  }

  const result = await response.json();

  if (result.error) {
    const error = new Error(result.error.message || JSON.stringify(result.error));
    error.statusCode = result.error.code;
    throw error;
  }

  if (!result.result?.digest) {
    throw new Error("Invalid response: missing transaction digest");
  }

  return {
    simulated: false,
    digest: result.result.digest,
    effects: result.result.effects,
  };
}

async function executeViaTarget(target, input) {
  const client = createSuiClient(target.url, target.useTatum);
  const txData = await buildAndSignTransaction({
    ...input,
    client,
  });

  return withRetries(
    target.retryName,
    () => executeJsonRpc(target.url, txData, { useTatum: target.useTatum }),
    {
      maxAttempts: config.retryMaxAttempts,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
    },
  );
}

export async function anchorAuditOnSui({ contractId, quiltId, auditHash, severity }) {
  if (
    !config.suiPrivateKey ||
    !config.registryPackageId ||
    !config.registryObjectId ||
    !config.adminCapObjectId ||
    !config.suiClockObjectId
  ) {
    return {
      simulated: true,
      digest: `simulated_${createHash("sha1").update(quiltId).digest("hex").slice(0, 12)}`,
      message:
        "On-chain anchoring skipped. Set SUI_PRIVATE_KEY, REGISTRY_PACKAGE_ID, REGISTRY_OBJECT_ID, ADMIN_CAP_OBJECT_ID, and SUI_CLOCK_OBJECT_ID.",
    };
  }

  const tatumTarget = {
    url: config.tatumSuiRpc,
    useTatum: true,
    retryName: "sui.anchorAudit.tatum",
  };

  const fullnodeTarget = {
    url: config.suiAnchorRpcFallback,
    useTatum: false,
    retryName: "sui.anchorAudit.fullnode",
  };

  try {
    console.log("[Anchor] Executing transaction via Tatum JSON-RPC...");
    return await executeViaTarget(tatumTarget, { contractId, quiltId, auditHash, severity });
  } catch (tatumError) {
    const status = getErrorStatusCode(tatumError);
    console.warn(`[Anchor] Tatum endpoint failed (${status}). Falling back to fullnode JSON-RPC.`);

    try {
      console.log("[Anchor] Executing transaction via fullnode JSON-RPC fallback...");
      return await executeViaTarget(fullnodeTarget, { contractId, quiltId, auditHash, severity });
    } catch (fullnodeError) {
      throw new Error(
        `Anchor failed with both endpoints. Tatum: ${tatumError.message}, Fullnode: ${fullnodeError.message}`,
      );
    }
  }
}
