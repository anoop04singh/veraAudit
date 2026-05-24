import { config } from "./config.js";
import { sleep } from "./retry.js";

let queueTail = Promise.resolve();
let nextAllowedAt = 0;

async function reserveTatumSlot() {
  const now = Date.now();
  const target = Math.max(now, nextAllowedAt);
  const waitMs = Math.max(0, target - now);
  nextAllowedAt = target + Math.max(0, config.tatumMinIntervalMs);
  if (waitMs > 0) {
    await sleep(waitMs);
  }
}

export function scheduleTatumRequest(task) {
  const run = queueTail.then(async () => {
    await reserveTatumSlot();
    return task();
  });

  // Keep the queue alive even if current request fails.
  queueTail = run.catch(() => {});
  return run;
}

export async function tatumFetch(url, options) {
  return scheduleTatumRequest(() => fetch(url, options));
}
