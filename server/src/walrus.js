import { createHash } from "crypto";
import { config, assertHas } from "./config.js";
import { enrichHttpError, withRetries } from "./retry.js";
import { tatumFetch } from "./tatumTransport.js";

function normalizeAuditBlob(auditBlob) {
  try {
    if (typeof auditBlob === "object" && auditBlob !== null) {
      return JSON.stringify(auditBlob);
    }

    if (typeof auditBlob === "string") {
      return JSON.stringify(JSON.parse(auditBlob));
    }

    throw new Error(`Invalid auditBlob type: ${typeof auditBlob}. Expected object or JSON string.`);
  } catch (error) {
    throw new Error(`Failed to prepare audit blob for Tatum Walrus upload: ${error.message}`);
  }
}

function buildWalrusFilename(jsonString, auditBlob) {
  const contractId = String(auditBlob?.contract_id ?? "audit").replace(/[^a-zA-Z0-9_-]/g, "_");
  const digest = createHash("sha256").update(jsonString).digest("hex").slice(0, 16);
  return `vera-audit-${contractId}-${digest}.json`;
}

function createTatumHeaders(extra = {}) {
  assertHas("TATUM_API_KEY", config.tatumApiKey);
  return {
    "x-api-key": config.tatumApiKey,
    ...extra,
  };
}

async function parseErrorResponse(response, fallbackLabel) {
  const bodyText = await response.text();
  const error = new Error(`${fallbackLabel} HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
  throw enrichHttpError(error, response, bodyText);
}

async function enqueueWalrusUpload({ file, filename }) {
  const form = new FormData();
  form.append("file", file, filename);

  const response = await tatumFetch(config.tatumWalrusUploadUrl, {
    method: "POST",
    headers: createTatumHeaders(),
    body: form,
  });

  if (!response.ok) {
    await parseErrorResponse(response, "Tatum Walrus upload");
  }

  return response.json();
}

async function getWalrusUploadStatus(jobId) {
  const response = await tatumFetch(`${config.tatumWalrusUploadUrl}/${jobId}`, {
    method: "GET",
    headers: createTatumHeaders(),
  });

  if (!response.ok) {
    await parseErrorResponse(response, "Tatum Walrus status");
  }

  return response.json();
}

export async function storeAuditBlob(auditBlob, options = {}) {
  const { onRetryLog } = options;
  const jsonString = normalizeAuditBlob(auditBlob);
  const fileBytes = new TextEncoder().encode(jsonString);

  if (fileBytes.byteLength > config.tatumWalrusMaxFileSizeBytes) {
    throw new Error(
      `Audit blob is ${fileBytes.byteLength} bytes; Tatum Walrus upload limit is ${config.tatumWalrusMaxFileSizeBytes} bytes.`,
    );
  }

  const filename = buildWalrusFilename(jsonString, auditBlob);
  const file = new File([fileBytes], filename, { type: "application/json" });

  const enqueue = await withRetries(
    "walrus.enqueue",
    () => enqueueWalrusUpload({ file, filename }),
    {
      maxAttempts: config.retryMaxAttempts,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
      onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
        const message =
          `Retrying Tatum Walrus upload ${attempt}/${maxAttempts - 1} in ${Math.ceil(delayMs / 1000)}s`;
        if (typeof onRetryLog === "function") {
          onRetryLog(message);
        }
        console.warn(`${message}: ${error.message}`);
      },
    },
  );

  if (!enqueue?.jobId || !enqueue?.blobId) {
    throw new Error("Tatum Walrus upload response missing jobId or blobId.");
  }

  console.log(`[Walrus] Upload job created. jobId=${enqueue.jobId} blobId=${enqueue.blobId}`);

  const certified = await withRetries(
    "walrus.pollCertification",
    async (attempt) => {
      const status = await getWalrusUploadStatus(enqueue.jobId);

      if (status?.status === "FAILED") {
        throw new Error(`Tatum Walrus certification failed: ${status.errorMessage ?? "Unknown error"}`);
      }

      if (status?.status !== "CERTIFIED") {
        const pendingError = new Error(
          `Tatum Walrus upload ${enqueue.jobId} is ${status?.status ?? "UNKNOWN"}; waiting for certification.`,
        );
        pendingError.statusCode = 425;
        throw pendingError;
      }

      return status;
    },
    {
      maxAttempts: config.tatumWalrusStatusMaxAttempts,
      baseDelayMs: config.tatumWalrusStatusPollMs,
      maxDelayMs: config.tatumWalrusStatusPollMs,
      onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
        const message =
          `Polling Tatum Walrus certification ${attempt}/${maxAttempts - 1} in ${Math.ceil(delayMs / 1000)}s`;
        if (typeof onRetryLog === "function") {
          onRetryLog(message);
        }
        console.log(`[Walrus] ${error.message} Next poll in ${delayMs}ms.`);
      },
    },
  );

  const walrusId = certified?.quiltPatchId ?? certified?.blobId;

  if (!walrusId) {
    throw new Error("Tatum Walrus certification response missing quiltPatchId/blobId.");
  }

  console.log(
    `[Walrus] Blob certified. quiltPatchId=${certified?.quiltPatchId ?? "n/a"} blobId=${certified?.blobId ?? "n/a"}`,
  );
  return walrusId;
}

export async function fetchWalrusBlob(blobId) {
  const url = `${config.walrusAggregator}/v1/blobs/by-quilt-patch-id/${blobId}`;
  console.log(`Fetching Walrus blob: ${blobId} from ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Walrus GET failed with status ${response.status}: ${bodyText.slice(0, 200)}`);
  }

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
