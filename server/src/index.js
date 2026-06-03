import cors from "cors";
import express from "express";
import { createHash } from "crypto";
import { z } from "zod";
import { config } from "./config.js";
import { queryAuditEvents, suiRpc } from "./tatum.js";
import { fetchWalrusBlob, storeAuditBlob } from "./walrus.js";
import { runGeminiAudit } from "./gemini.js";
import { retrieveAuditContext } from "./rag.js";
import { anchorAuditOnSui, severityToInt } from "./anchor.js";
import { normalizeAuditEvent, severityLabel } from "./events.js";
import { createAuditPipeline } from "./auditPipeline.js";
import { getErrorStatusCode, isRetryableError } from "./retry.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "3mb" }));

const auditInput = z.object({
  contractId: z.string().min(3),
});

function getAuditEventType() {
  if (!config.registryPackageId) return "";
  return `${config.registryPackageId}::registry::AuditSubmitted`;
}

async function loadAuditEvents(limit = 200) {
  const moveEventType = getAuditEventType();
  if (!moveEventType) return [];
  const events = await queryAuditEvents(moveEventType, limit);
  return events.map(normalizeAuditEvent);
}

function sendSseHeaders(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
}

function emitSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const runAuditPipeline = createAuditPipeline({
  config,
  services: {
    suiRpc,
    retrieveAuditContext,
    runGeminiAudit,
    storeAuditBlob,
    anchorAuditOnSui,
    severityToInt,
  },
});

const inFlightAudits = new Map();

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    network: config.appNetworkLabel,
    tatumRpc: config.tatumSuiRpc,
    walrusAggregator: config.walrusAggregator,
    config: {
      tatumApiKeySet: !!config.tatumApiKey,
      suiPrivateKeySet: !!config.suiPrivateKey,
      registryConfigSet: !!(config.registryPackageId && config.registryObjectId && config.adminCapObjectId),
      suiClockObjectId: config.suiClockObjectId,
      tatumWalrusUploadUrl: config.tatumWalrusUploadUrl,
      walrusNetwork: config.walrusNetwork,
      retryMaxAttempts: config.retryMaxAttempts,
      contextModuleQueryConcurrency: config.contextModuleQueryConcurrency,
      ragEnabled: config.ragEnabled,
      ragUseEmbeddings: config.ragUseEmbeddings,
      geminiEmbeddingModel: config.geminiEmbeddingModel,
    },
  });
});

app.get("/api/test-tatum", async (_, res) => {
  try {
    if (!config.tatumApiKey) {
      return res.status(400).json({ error: "TATUM_API_KEY is not set in .env" });
    }

    const result = await suiRpc("sui_getLatestCheckpointSequenceNumber", []);
    return res.json({
      ok: true,
      message: "Tatum connection successful",
      latestCheckpoint: result,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
      tatumRpc: config.tatumSuiRpc,
    });
  }
});

app.get("/api/check/:contractId", async (req, res) => {
  try {
    const contractId = req.params.contractId.toLowerCase();
    const events = await loadAuditEvents(300);
    const audits = events.filter((entry) => entry.contract_id === contractId);

    if (audits.length === 0) {
      return res.json({ found: false, audits: [] });
    }

    return res.json({
      found: true,
      audits: audits.sort((a, b) => b.timestamp_ms - a.timestamp_ms),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/blob/:blobId", async (req, res) => {
  try {
    const blob = await fetchWalrusBlob(req.params.blobId);
    res.json(blob);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get("/api/verify/:blobId", async (req, res) => {
  try {
    const blobId = req.params.blobId;
    const blob = await fetchWalrusBlob(blobId);
    const events = await loadAuditEvents(500);
    const event = events.find((entry) => entry.walrus_blob_id === blobId);

    if (!event) {
      return res.json({
        verified: false,
        reason: "No on-chain audit event found for this quilt ID.",
      });
    }

    const hash = createHash("sha256").update(JSON.stringify(blob)).digest("hex");
    const hashMatches = event.audit_hash === hash;

    return res.json({
      verified: hashMatches,
      quilt_id: blobId,
      blob_id: blobId,
      blob_hash: hash,
      onchain_hash: event.audit_hash,
      tx_digest: event.tx_digest,
      contract_id: event.contract_id,
      audited_at: event.audited_at,
      severity: severityLabel(event.severity),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/audit", async (req, res) => {
  sendSseHeaders(res);

  let normalizedContractId = null;
  try {
    const parsed = auditInput.parse(req.body);
    normalizedContractId = parsed.contractId.toLowerCase();

    if (inFlightAudits.has(normalizedContractId)) {
      emitSse(res, "error", {
        message: `An audit is already running for ${normalizedContractId}. Please wait for it to finish.`,
        code: "AUDIT_ALREADY_RUNNING",
      });
      return;
    }

    const pipelinePromise = runAuditPipeline({
      contractId: normalizedContractId,
      emit: (event, payload) => emitSse(res, event, payload),
    });

    inFlightAudits.set(normalizedContractId, pipelinePromise);
    await pipelinePromise;
  } catch (error) {
    const status = getErrorStatusCode(error);
    const retryable = isRetryableError(error);
    const rateLimited = status === 429 || /rate limit|resource exhausted/i.test(error.message ?? "");

    emitSse(res, "step_log", {
      step: "system",
      message: `Audit pipeline failed: ${error.message}`,
      details: {
        status_code: status,
        retryable,
        rate_limited: rateLimited,
      },
    });

    emitSse(res, "error", {
      message: error.message,
      code: rateLimited ? "RATE_LIMITED" : "PIPELINE_FAILED",
      status_code: status,
      retryable,
    });
  } finally {
    if (normalizedContractId) {
      inFlightAudits.delete(normalizedContractId);
    }
    res.end();
  }
});

app.get("/api/metrics", async (_, res) => {
  try {
    const events = await loadAuditEvents(500);
    const severityDistribution = {
      clean: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const event of events) {
      const label = severityLabel(event.severity);
      severityDistribution[label] += 1;
    }

    const recent = events
      .sort((a, b) => b.timestamp_ms - a.timestamp_ms)
      .slice(0, 5)
      .map((event) => ({
        contract_id: event.contract_id,
        quilt_id: event.quilt_id ?? event.walrus_blob_id,
        blob_id: event.walrus_blob_id,
        tx_digest: event.tx_digest,
        severity: severityLabel(event.severity),
        audited_at: event.audited_at,
      }));

    return res.json({
      network: config.appNetworkLabel,
      total_audits: events.length,
      unique_contracts: new Set(events.map((entry) => entry.contract_id)).size,
      severity_distribution: severityDistribution,
      recent_audits: recent,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(config.port, () => {
  console.log(`VeraAudit API listening on http://localhost:${config.port}`);
});
