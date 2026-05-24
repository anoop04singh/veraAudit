import test from "node:test";
import assert from "node:assert/strict";
import { getErrorStatusCode, isRetryableError, withRetries } from "../src/retry.js";

test("withRetries retries on 429 and succeeds", async () => {
  let calls = 0;
  const result = await withRetries(
    "retry-429",
    async () => {
      calls += 1;
      if (calls < 3) {
        const error = new Error("429 Too Many Requests");
        error.status = 429;
        error.retryAfterMs = 1;
        throw error;
      }
      return "ok";
    },
    { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 5 },
  );

  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("withRetries does not retry non-retryable errors", async () => {
  let calls = 0;
  await assert.rejects(
    withRetries(
      "no-retry",
      async () => {
        calls += 1;
        const error = new Error("validation failed");
        error.status = 400;
        throw error;
      },
      { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 5 },
    ),
    /validation failed/,
  );
  assert.equal(calls, 1);
});

test("error helpers detect retryable status", () => {
  const err = new Error("Resource exhausted");
  err.status = 429;
  assert.equal(getErrorStatusCode(err), 429);
  assert.equal(isRetryableError(err), true);
});
