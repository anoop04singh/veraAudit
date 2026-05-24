import { config } from "./config.js";
import { enrichHttpError, withRetries } from "./retry.js";
import { tatumFetch } from "./tatumTransport.js";

const JSON_RPC_VERSION = "2.0";

export async function suiRpc(method, params = [], options = {}) {
  const { onRetryLog } = options;

  const headers = {
    "content-type": "application/json",
  };

  if (config.tatumApiKey) {
    headers["x-api-key"] = config.tatumApiKey;
  }

  return withRetries(
    `tatum.${method}`,
    async () => {
      const response = await tatumFetch(config.tatumSuiRpc, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: JSON_RPC_VERSION,
          id: 1,
          method,
          params,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Tatum RPC HTTP ${response.status} for ${method}`);
        throw enrichHttpError(error, response, errorText.slice(0, 800));
      }

      const payload = await response.json();
      if (payload.error) {
        const error = new Error(`Tatum RPC ${method} error: ${JSON.stringify(payload.error)}`);
        error.status = Number(payload.error?.code) || undefined;
        error.details = payload.error;
        throw error;
      }

      return payload.result;
    },
    {
      maxAttempts: config.retryMaxAttempts,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
      onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
        if (typeof onRetryLog === "function") {
          onRetryLog(
            `Tatum ${method} retry ${attempt}/${maxAttempts - 1} in ${Math.ceil(delayMs / 1000)}s: ${error.message}`,
          );
        }
      },
    },
  );
}

export async function queryAuditEvents(moveEventType, limit = 100, options = {}) {
  const result = await suiRpc("suix_queryEvents", [
    { MoveEventType: moveEventType },
    null,
    limit,
    true,
  ], options);

  return result?.data ?? [];
}
