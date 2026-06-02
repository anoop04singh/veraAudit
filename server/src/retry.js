const RETRYABLE_HTTP_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function asString(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseDurationToMs(value) {
  if (!value) return null;

  const trimmed = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Math.round(Number(trimmed) * 1000));
  }

  const match = trimmed.match(/(\d+(\.\d+)?)s/i);
  if (match) {
    return Math.max(0, Math.round(Number(match[1]) * 1000));
  }

  return null;
}

function parseRetryAfterHeader(headers) {
  if (!headers || typeof headers.get !== "function") return null;
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return null;

  if (/^\d+$/.test(retryAfter)) {
    return Number(retryAfter) * 1000;
  }

  const epochMs = Date.parse(retryAfter);
  if (!Number.isNaN(epochMs)) {
    return Math.max(0, epochMs - Date.now());
  }

  return null;
}

function extractRetryDelayMs(error) {
  if (!error) return null;

  if (typeof error.retryAfterMs === "number") {
    return error.retryAfterMs;
  }

  const detail = asString(error?.details ?? error?.detail ?? error?.body);
  const detailMatch = detail.match(/retryDelay["']?\s*[:=]\s*["']?([0-9.]+s?)["']?/i);
  if (detailMatch) {
    return parseDurationToMs(detailMatch[1]);
  }

  const message = asString(error?.message);
  const messageMatch = message.match(/Please retry in\s*([0-9.]+s?)/i);
  if (messageMatch) {
    return parseDurationToMs(messageMatch[1]);
  }

  return null;
}

export function getErrorStatusCode(error) {
  const direct = Number(error?.status ?? error?.statusCode ?? error?.code);
  if (!Number.isNaN(direct) && direct > 0) return direct;

  const message = asString(error?.message);
  const messageMatch = message.match(/\b(4\d\d|5\d\d)\b/);
  if (messageMatch) return Number(messageMatch[1]);

  return null;
}

export function isRetryableError(error) {
  const status = getErrorStatusCode(error);
  if (status && RETRYABLE_HTTP_STATUS.has(status)) {
    return true;
  }

  const message = asString(error?.message ?? error);
  return /(RESOURCE_EXHAUSTED|Too Many Requests|rate limit|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|network error|Too many failures|quorum)/i.test(
    message,
  );
}

export function enrichHttpError(error, response, bodyText = "") {
  const retryAfterMs = parseRetryAfterHeader(response?.headers);
  error.status = response?.status;
  error.responseStatus = response?.status;
  error.responseBody = bodyText;
  if (retryAfterMs != null) {
    error.retryAfterMs = retryAfterMs;
  }
  return error;
}

export async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetries(taskName, fn, options = {}) {
  const {
    maxAttempts = 4,
    baseDelayMs = 1500,
    maxDelayMs = 30_000,
    onRetry,
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const retryable = isRetryableError(error);
      const canRetry = retryable && attempt < maxAttempts;

      if (!canRetry) {
        throw error;
      }

      const hintedDelay = extractRetryDelayMs(error);
      const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const jitter = Math.floor(Math.random() * 300);
      const delayMs = Math.min(Math.max(hintedDelay ?? exponential + jitter, baseDelayMs), maxDelayMs);

      if (typeof onRetry === "function") {
        onRetry({
          taskName,
          attempt,
          maxAttempts,
          delayMs,
          error,
        });
      }

      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error(`Task "${taskName}" failed.`);
}
