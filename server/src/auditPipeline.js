import { createHash } from "crypto";
import { withRetries } from "./retry.js";

function nowMs() {
  return Date.now();
}

function jsonSizeBytes(value) {
  return Buffer.byteLength(JSON.stringify(value));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function mapWithConcurrency(items, limit, mapper) {
  if (items.length === 0) return [];
  const size = Math.max(1, Number(limit) || 1);
  const result = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
  return result;
}

function defaultEmit() {}

function normalizeAuditOutput(auditResult) {
  return {
    summary: auditResult.summary,
    severity: auditResult.severity,
    findings_count: Array.isArray(auditResult.findings) ? auditResult.findings.length : 0,
    confidence: auditResult.confidence,
  };
}

export function createAuditPipeline({ config, services }) {
  const {
    suiRpc,
    runGeminiAudit,
    storeAuditBlob,
    anchorAuditOnSui,
    severityToInt,
  } = services;

  return async function runAuditPipeline({ contractId, emit = defaultEmit }) {
    const normalizedContractId = contractId.toLowerCase();
    const durations = {};
    const startedAt = nowMs();

    const log = (step, message, details = undefined) => {
      emit("step_log", { step, message, details });
    };

    const markStepStart = (step, message) => {
      durations[step] = { startedAt: nowMs() };
      emit("progress", { step, message, status: "running" });
    };

    const markStepDone = (step, message, output = undefined) => {
      const finishedAt = nowMs();
      const durationMs = Math.max(0, finishedAt - (durations[step]?.startedAt ?? finishedAt));
      durations[step] = {
        ...(durations[step] ?? {}),
        finishedAt,
        durationMs,
      };

      emit("step_output", {
        step,
        message,
        duration_ms: durationMs,
        output,
      });
    };

    markStepStart("fetch", "Fetching package modules from Sui testnet...");
    log("fetch", "Requesting normalized modules through Tatum RPC.");
    const moduleData = await withRetries(
      "pipeline.fetchModules",
      () =>
        suiRpc("sui_getNormalizedMoveModulesByPackage", [normalizedContractId], {
          onRetryLog: (retryMessage) => log("fetch", retryMessage),
        }),
      {
        maxAttempts: config.retryMaxAttempts,
        baseDelayMs: config.retryBaseDelayMs,
        maxDelayMs: config.retryMaxDelayMs,
        onRetry: ({ attempt, maxAttempts, delayMs, error }) =>
          log(
            "fetch",
            `Retrying module fetch ${attempt}/${maxAttempts - 1} in ${Math.ceil(delayMs / 1000)}s`,
            { reason: error.message },
          ),
      },
    );
    const moduleNames = Object.keys(moduleData ?? {});
    markStepDone("fetch", "Module introspection complete.", {
      module_count: moduleNames.length,
      payload_size: formatBytes(jsonSizeBytes(moduleData)),
    });

    markStepStart("context", "Fetching recent package events...");
    log("context", "Querying module-scoped events via Tatum.");
    const eventBatches = await mapWithConcurrency(
      moduleNames,
      config.contextModuleQueryConcurrency,
      async (moduleName) =>
        suiRpc(
          "suix_queryEvents",
          [
            { MoveModule: { package: normalizedContractId, module: moduleName } },
            null,
            25,
            true,
          ],
          {
            onRetryLog: (retryMessage) => log("context", `${moduleName}: ${retryMessage}`),
          },
        ),
    );

    const recentEvents = eventBatches
      .flatMap((batch) => batch?.data ?? [])
      .sort((a, b) => Number(b.timestampMs ?? 0) - Number(a.timestampMs ?? 0))
      .slice(0, config.maxContextEvents);

    markStepDone("context", "Chain context assembled.", {
      queried_modules: moduleNames.length,
      event_count: recentEvents.length,
      payload_size: formatBytes(jsonSizeBytes(recentEvents)),
    });

    markStepStart("audit", `Running Gemini audit (${config.geminiModel})...`);
    log("audit", "Submitting module data and chain context to Gemini.");
    const auditResult = await runGeminiAudit({
      contractId: normalizedContractId,
      moduleData,
      recentEvents,
      onRetryLog: (retryMessage) => log("audit", retryMessage),
    });
    markStepDone("audit", "AI analysis complete.", normalizeAuditOutput(auditResult));

    const auditedAtMs = nowMs();
    const auditBlob = {
      version: "1.1",
      network: config.appNetworkLabel,
      contract_id: normalizedContractId,
      audited_at: new Date(auditedAtMs).toISOString(),
      audited_at_ms: auditedAtMs,
      model: config.geminiModel,
      module_snapshot: moduleData,
      event_snapshot: recentEvents,
      ...auditResult,
    };

    markStepStart("walrus", "Storing audit blob on Walrus...");
    log("walrus", "Uploading immutable audit payload.");
    const blobId = await storeAuditBlob(auditBlob, {
      onRetryLog: (retryMessage) => log("walrus", retryMessage),
    });
    const auditHash = createHash("sha256").update(JSON.stringify(auditBlob)).digest("hex");
    markStepDone("walrus", "Walrus blob stored.", {
      blob_id: blobId,
      audit_hash: auditHash,
      payload_size: formatBytes(jsonSizeBytes(auditBlob)),
    });

    markStepStart("anchor", "Anchoring blob reference on Sui...");
    log("anchor", "Submitting anchor transaction.");
    const anchor = await anchorAuditOnSui({
      contractId: normalizedContractId,
      blobId,
      auditHash,
      severity: severityToInt(auditResult.severity),
      timestampMs: auditedAtMs,
    });
    markStepDone("anchor", "On-chain anchor complete.", {
      tx_digest: anchor.digest,
      simulated: anchor.simulated ?? false,
    });

    const totalDurationMs = nowMs() - startedAt;
    emit("complete", {
      contract_id: normalizedContractId,
      blob_id: blobId,
      audit_hash: auditHash,
      tx_digest: anchor.digest,
      anchor_simulated: anchor.simulated ?? false,
      summary: auditResult.summary,
      severity: auditResult.severity,
      findings_count: Array.isArray(auditResult.findings) ? auditResult.findings.length : 0,
      audited_at: new Date(auditedAtMs).toISOString(),
      duration_ms: totalDurationMs,
      step_durations: Object.fromEntries(
        Object.entries(durations).map(([step, value]) => [step, value.durationMs ?? 0]),
      ),
    });
  };
}
