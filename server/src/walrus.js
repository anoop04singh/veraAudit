import { config } from "./config.js";
import { enrichHttpError, withRetries } from "./retry.js";

export async function storeAuditBlob(auditBlob, options = {}) {
  const { onRetryLog } = options;
  const body = JSON.stringify(auditBlob);
  const url = `${config.walrusPublisher}/v1/blobs?epochs=${config.walrusEpochs}`;

  const response = await withRetries(
    "walrus.putBlob",
    async () => {
      const result = await fetch(url, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body,
      });

      if (!result.ok) {
        const bodyText = await result.text();
        const error = new Error(`Walrus PUT failed with status ${result.status}`);
        throw enrichHttpError(error, result, bodyText.slice(0, 800));
      }
      return result;
    },
    {
      maxAttempts: config.retryMaxAttempts,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
      onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
        if (typeof onRetryLog === "function") {
          onRetryLog(
            `Walrus PUT retry ${attempt}/${maxAttempts - 1} in ${Math.ceil(delayMs / 1000)}s: ${error.message}`,
          );
        }
      },
    },
  );

  const payload = await response.json();
  if (payload.newlyCreated?.blobObject?.blobId) {
    return payload.newlyCreated.blobObject.blobId;
  }

  if (payload.alreadyCertified?.blobId) {
    return payload.alreadyCertified.blobId;
  }

  throw new Error(`Unexpected Walrus response: ${JSON.stringify(payload)}`);
}

export async function fetchWalrusBlob(blobId, options = {}) {
  const { onRetryLog } = options;
  const url = `${config.walrusAggregator}/v1/blobs/${blobId}`;
  const response = await withRetries(
    "walrus.getBlob",
    async () => {
      const result = await fetch(url);
      if (!result.ok) {
        const bodyText = await result.text();
        const error = new Error(`Walrus GET failed with status ${result.status}`);
        throw enrichHttpError(error, result, bodyText.slice(0, 800));
      }
      return result;
    },
    {
      maxAttempts: config.retryMaxAttempts,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
      onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
        if (typeof onRetryLog === "function") {
          onRetryLog(
            `Walrus GET retry ${attempt}/${maxAttempts - 1} in ${Math.ceil(delayMs / 1000)}s: ${error.message}`,
          );
        }
      },
    },
  );

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
