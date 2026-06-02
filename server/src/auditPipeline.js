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
    finding_titles: (auditResult.findings ?? []).slice(0, 5).map((finding) => finding.title),
    confidence: auditResult.confidence,
  };
}

function getExposedFunctionNames(moduleData, maxFunctions) {
  const functions = [];
  for (const [moduleName, module] of Object.entries(moduleData ?? {})) {
    const exposed = module?.exposedFunctions ?? {};
    for (const functionName of Object.keys(exposed)) {
      functions.push({ moduleName, functionName });
      if (functions.length >= maxFunctions) return functions;
    }
  }
  return functions;
}

function compactTransactionBlock(tx) {
  return {
    digest: tx?.digest,
    timestampMs: tx?.timestampMs,
    checkpoint: tx?.checkpoint,
    transaction: tx?.transaction
      ? {
          sender: tx.transaction?.data?.sender,
          gasBudget: tx.transaction?.data?.gasData?.budget,
          commands: tx.transaction?.data?.transaction?.transactions?.length,
        }
      : undefined,
    effects: tx?.effects
      ? {
          status: tx.effects?.status,
          gasUsed: tx.effects?.gasUsed,
          created: tx.effects?.created?.length ?? 0,
          mutated: tx.effects?.mutated?.length ?? 0,
          deleted: tx.effects?.deleted?.length ?? 0,
        }
      : undefined,
    events: (tx?.events ?? []).slice(0, 20).map((event) => ({
      id: event?.id,
      type: event?.type,
      packageId: event?.packageId,
      transactionModule: event?.transactionModule,
      sender: event?.sender,
      timestampMs: event?.timestampMs ?? tx?.timestampMs,
      parsedJson: event?.parsedJson,
    })),
  };
}

function isMissingReferencedEventsError(error) {
  return /Could not find the referenced transaction events/i.test(error?.message ?? "");
}

export function createAuditPipeline({ config, services }) {
  const {
    suiRpc,
    retrieveAuditContext,
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

    markStepStart("fetch", "Fetching package modules from Sui mainnet...");
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
      module_names: moduleNames,
      exposed_function_count: getExposedFunctionNames(moduleData, 10_000).length,
      payload_size: formatBytes(jsonSizeBytes(moduleData)),
    });

    markStepStart("context", "Fetching recent package transaction history...");
    const functionTargets = getExposedFunctionNames(moduleData, config.maxContextFunctionQueries);
    log("context", "Querying function-scoped transaction blocks via Tatum.", {
      function_targets: functionTargets,
    });

    const txBatches = await mapWithConcurrency(
      functionTargets,
      config.contextModuleQueryConcurrency,
      async ({ moduleName, functionName }) =>
        suiRpc(
          "suix_queryTransactionBlocks",
          [
            {
              filter: {
                MoveFunction: {
                  package: normalizedContractId,
                  module: moduleName,
                  function: functionName,
                },
              },
              options: {
                showInput: true,
                showEffects: true,
                showEvents: true,
                showObjectChanges: false,
                showBalanceChanges: false,
              },
            },
            null,
            config.contextTransactionsPerFunction,
            true,
          ],
          {
            onRetryLog: (retryMessage) => log("context", `${moduleName}::${functionName}: ${retryMessage}`),
          },
        ),
    );

    const txByDigest = new Map();
    for (const batch of txBatches) {
      for (const tx of batch?.data ?? []) {
        if (tx?.digest && !txByDigest.has(tx.digest)) {
          txByDigest.set(tx.digest, compactTransactionBlock(tx));
        }
      }
    }

    let eventFallbackUsed = false;
    let eventFallbackWarning = "";
    let fallbackEvents = [];

    if (txByDigest.size === 0 && moduleNames.length > 0) {
      eventFallbackUsed = true;
      log("context", "No function transaction blocks returned. Falling back to guarded module event query.");
      const fallbackBatches = await mapWithConcurrency(
        moduleNames,
        config.contextModuleQueryConcurrency,
        async (moduleName) => {
          try {
            return await suiRpc(
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
            );
          } catch (error) {
            if (isMissingReferencedEventsError(error)) {
              eventFallbackWarning = error.message;
              log("context", "Tatum event index referenced a missing transaction event; continuing with transaction context.", {
                module: moduleName,
                reason: error.message,
              });
              return { data: [] };
            }
            throw error;
          }
        },
      );
      fallbackEvents = fallbackBatches.flatMap((batch) => batch?.data ?? []);
    }

    const recentTransactions = Array.from(txByDigest.values())
      .sort((a, b) => Number(b.timestampMs ?? 0) - Number(a.timestampMs ?? 0))
      .slice(0, config.maxContextTransactions);

    const embeddedEvents = recentTransactions.flatMap((tx) => tx.events ?? []);
    const recentEvents = [...embeddedEvents, ...fallbackEvents]
      .sort((a, b) => Number(b.timestampMs ?? 0) - Number(a.timestampMs ?? 0))
      .slice(0, config.maxContextEvents);

    markStepDone("context", "Chain context assembled.", {
      queried_modules: moduleNames.length,
      queried_functions: functionTargets.length,
      transaction_count: recentTransactions.length,
      event_count: recentEvents.length,
      fallback_event_query_used: eventFallbackUsed,
      fallback_warning: eventFallbackWarning || undefined,
      sample_transactions: recentTransactions.slice(0, 5).map((tx) => tx.digest),
      payload_size: formatBytes(jsonSizeBytes({ recentTransactions, recentEvents })),
    });

    markStepStart("rag", "Retrieving Sui/Move security context...");
    log("rag", "Generating targeted retrieval queries from module ABI and Tatum chain context.");
    const ragContext = await retrieveAuditContext({
      contractId: normalizedContractId,
      moduleData,
      recentEvents,
      onRetryLog: (retryMessage) => log("rag", retryMessage),
    });
    markStepDone("rag", "RAG context assembled.", {
      chunks: ragContext.chunks?.length ?? 0,
      categories: ragContext.categories ?? [],
      embedding_used: ragContext.embedding_used ?? false,
      top_sources: (ragContext.chunks ?? []).slice(0, 3).map((chunk) => chunk.title),
      warning: ragContext.warning || undefined,
    });

    markStepStart("audit", `Running Gemini audit (${config.geminiModel})...`);
    log("audit", "Submitting module data, Tatum chain context, and retrieved Sui/Move guidance to Gemini.");
    const auditResult = await runGeminiAudit({
      contractId: normalizedContractId,
      moduleData,
      recentEvents,
      recentTransactions,
      ragContext,
      onRetryLog: (retryMessage) => log("audit", retryMessage),
    });
    markStepDone("audit", "AI analysis complete.", normalizeAuditOutput(auditResult));

    const auditedAtMs = nowMs();
    const auditBlob = {
      version: "1.2",
      network: config.appNetworkLabel,
      contract_id: normalizedContractId,
      audited_at: new Date(auditedAtMs).toISOString(),
      audited_at_ms: auditedAtMs,
      model: config.geminiModel,
      embedding_model: config.geminiEmbeddingModel,
      module_snapshot: moduleData,
      transaction_snapshot: recentTransactions,
      event_snapshot: recentEvents,
      rag_context: {
        enabled: ragContext.enabled,
        embedding_used: ragContext.embedding_used,
        queries: ragContext.queries,
        categories: ragContext.categories,
        chunks: ragContext.chunks,
        warning: ragContext.warning,
      },
      ...auditResult,
    };

    markStepStart("walrus", "Storing audit blob on Walrus...");
    log("walrus", "Uploading immutable audit payload.");
    const quiltId = await storeAuditBlob(auditBlob, {
      onRetryLog: (retryMessage) => log("walrus", retryMessage),
    });
    const auditHash = createHash("sha256").update(JSON.stringify(auditBlob)).digest("hex");
    markStepDone("walrus", "Walrus blob stored.", {
      quilt_id: quiltId,
      blob_id: quiltId,
      audit_hash: auditHash,
      payload_size: formatBytes(jsonSizeBytes(auditBlob)),
    });

    markStepStart("anchor", "Anchoring quilt reference on Sui...");
    log("anchor", "Submitting anchor transaction.");
    const anchor = await anchorAuditOnSui({
      contractId: normalizedContractId,
      quiltId,
      auditHash,
      severity: severityToInt(auditResult.severity),
    });
    markStepDone("anchor", "On-chain anchor complete.", {
      tx_digest: anchor.digest,
      simulated: anchor.simulated ?? false,
    });

    const totalDurationMs = nowMs() - startedAt;
    emit("complete", {
      contract_id: normalizedContractId,
      quilt_id: quiltId,
      blob_id: quiltId,
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
