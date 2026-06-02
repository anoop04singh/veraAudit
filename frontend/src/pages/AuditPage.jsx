import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useSearchParams } from "react-router-dom";
import { AuditHistory } from "../components/AuditHistory.jsx";
import { AuditProgress } from "../components/AuditProgress.jsx";
import { AuditReport } from "../components/AuditReport.jsx";
import { apiJson, streamAudit } from "../utils/api.js";
import { shortenHash, toSuiScanObjectUrl } from "../utils/links.js";

const stepOrder = ["fetch", "context", "rag", "audit", "walrus", "anchor"];

function formatLogDetails(value, maxChars = 1800) {
  if (!value || (typeof value === "object" && Object.keys(value).length === 0)) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n... truncated` : text;
}

function asInitialSteps() {
  return stepOrder.map((step) => ({ step, message: step, status: "pending" }));
}

function severityFromInt(value) {
  if (value === 4) return "critical";
  if (value === 3) return "high";
  if (value === 2) return "medium";
  if (value === 1) return "low";
  return "clean";
}

function buildStreamAscii(tick, cols = 56, rows = 12) {
  const chars = ["▢", "▣", "▤", "▥", "█", "░", "░"];
  const lines = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const scannerPos = (tick * 0.5 + y * 0.3) % cols;
      const dist = Math.abs(x - scannerPos);
      const wave = Math.sin((x + tick * 0.15) * 0.22 + y * 0.35);
      const isActive = dist < 3 ? 1 : Math.max(0, (wave * 0.5 + 0.5));
      const idx = Math.floor(isActive * (chars.length - 1));
      line += chars[idx];
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function HudBar({ streaming, steps, hasError }) {
  if (!streaming && !hasError) return null;
  const done = steps.filter((s) => s.status === "done").length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <div className="hud-bar">
      <div className="hud-track">
        <div className="hud-fill" style={{ width: `${pct}%`, background: hasError ? "var(--high)" : "var(--ok)" }} />
      </div>
      <span className="hud-label">{hasError ? "FAILED" : done === steps.length ? "COMPLETE" : `${done}/${steps.length}`}</span>
    </div>
  );
}

function StreamingVisual({ tick, streaming }) {
  if (!streaming) return null;
  return (
    <div className="stream-visual stream-visual--audit">
      <div className="stream-visual-scanner">
        <pre aria-hidden="true" className="stream-visual-ascii">
          {buildStreamAscii(tick)}
        </pre>
        <div className="stream-visual-overlay" />
      </div>
      <div className="stream-visual-right">
        <p className="stream-visual-title">Contract Analysis</p>
        <p className="stream-visual-subtitle">Scanning bytecode...</p>
        <div className="stream-visual-dots">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export function AuditPage() {
  const { contractId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState([]);
  const [report, setReport] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [steps, setSteps] = useState(asInitialSteps());
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [backendLogs, setBackendLogs] = useState([]);

  const latest = useMemo(() => audits[0], [audits]);
  const selectedBlobId = searchParams.get("blob");

  function patchStep(stepKey, status, message) {
    setSteps((current) =>
      current.map((entry) => (entry.step === stepKey ? { ...entry, status, message: message ?? entry.message } : entry)),
    );
  }

  async function loadExisting() {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson(`/api/check/${contractId}`);
      if (data.found) {
        setAudits(
          (data.audits ?? []).map((audit) => ({
            ...audit,
            severity: typeof audit.severity === "number" ? severityFromInt(audit.severity) : audit.severity,
          })),
        );
      } else {
        setAudits([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runAudit() {
    setStreaming(true);
    setReport(null);
    setSteps(asInitialSteps());
    setError("");
    setBackendLogs([]);

    try {
      await streamAudit(contractId, (event, payload) => {
        if (event === "progress") {
          if (payload.status === "error") {
            patchStep(payload.step, "error", payload.message);
          } else {
            patchStep(payload.step, "running", payload.message);
          }
        }

        if (event === "step_output") {
          patchStep(payload.step, "done", payload.message);
          setBackendLogs((current) => [
            ...current,
            {
              step: payload.step ?? "system",
              message: payload.message ?? "Step output captured.",
              details: formatLogDetails(payload.output),
            },
          ]);
        }

        if (event === "step_log") {
          setBackendLogs((current) => [
            ...current,
            {
              step: payload.step ?? "system",
              message: payload.message ?? "",
              details: formatLogDetails(payload.details, 1200),
            },
          ]);
        }

        if (event === "complete") {
          stepOrder.forEach((step) => patchStep(step, "done", "Complete"));
          const completedBlobId = payload.quilt_id ?? payload.blob_id;
          setAudits((current) => [
            {
              contract_id: payload.contract_id,
              quilt_id: completedBlobId,
              walrus_blob_id: completedBlobId,
              blob_id: completedBlobId,
              audit_hash: payload.audit_hash,
              tx_digest: payload.tx_digest,
              severity: payload.severity,
              audited_at: payload.audited_at,
            },
            ...current,
          ]);
          if (completedBlobId) {
            setSearchParams({ blob: completedBlobId });
          }
          setReport({
            summary: payload.summary,
            severity: payload.severity,
            findings: [],
          });
          setStreaming(false);
        }

        if (event === "error") {
          setError(payload.message ?? "Audit failed.");
          setStreaming(false);
        }
      });
    } catch (err) {
      setError(err.message);
      setStreaming(false);
    }
  }

  async function loadBlob(blobId) {
    if (!blobId) return;
    try {
      const blob = await apiJson(`/api/blob/${blobId}`);
      setReport(blob);
    } catch {
      setReport(null);
    }
  }

  useEffect(() => {
    loadExisting();
  }, [contractId]);

  useEffect(() => {
    const fallbackBlobId = latest?.quilt_id ?? latest?.walrus_blob_id ?? latest?.blob_id;
    const blobIdToLoad = selectedBlobId ?? fallbackBlobId;
    if (!blobIdToLoad) return;
    loadBlob(blobIdToLoad);
  }, [selectedBlobId, latest?.quilt_id, latest?.walrus_blob_id, latest?.blob_id]);

  useEffect(() => {
    if (!loading && audits.length === 0) {
      runAudit();
    }
  }, [loading]);

  useEffect(() => {
    if (!streaming) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), 130);
    return () => clearInterval(timer);
  }, [streaming]);

  function handleSelectAudit(blobId) {
    if (!blobId) return;
    setSearchParams({ blob: blobId });
  }

  return (
    <>
      <section className="audit-hero section">
        <div className="s-inner audit-hero-inner">
          <div className="audit-hero-left">
            <p className="eyebrow">Audit Workspace</p>
            <h1 className="audit-hero-title">
              <span>Run or Verify</span>
              <span className="accent">Sui Contract</span>
              <span>Audits</span>
            </h1>
            <p className="audit-hero-desc">
              Paste a Sui package ID to check audit history or trigger a fresh audit. Results are stored on Walrus and anchored on Sui mainnet, with chain context fetched via Tatum RPC.
            </p>
          </div>
          <div className="audit-hero-visual">
            <div className="audit-orbit">
              <div className="audit-orbit-ring audit-orbit-ring-1" />
              <div className="audit-orbit-ring audit-orbit-ring-2" />
              <div className="audit-orbit-center">
                <span className="audit-orbit-label">VERIFY</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section audit-hub">
        <div className="s-inner">
        <motion.div
          className="audit-head"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="eyebrow mono">
            <a className="smart-link" href={toSuiScanObjectUrl(contractId)} target="_blank" rel="noreferrer">
              {shortenHash(contractId, 14, 10)}
            </a>
          </p>
          <h1 className="s-h2">Audit Timeline</h1>
        </motion.div>

        {loading && (
          <div className="status-banner">
            <span className="status-dot status-dot-pulse" />
            <span className="status-label">Checking on-chain history...</span>
          </div>
        )}

        {error && (
          <div className="status-banner status-banner-error">
            <span className="status-chip status-chip-error">ERROR</span>
            <span className="error-text">{error}</span>
          </div>
        )}

        <div className="actions-row">
          <button className="btn btn--primary" onClick={runAudit} disabled={streaming}>
            {streaming ? "Running Audit..." : "Run New Audit"}
          </button>
          {latest && <span className="subtle-text">Last run: {latest.audited_at ? new Date(latest.audited_at).toLocaleString() : "—"}</span>}
        </div>

        <HudBar streaming={streaming} steps={steps} hasError={!!error} />
        <StreamingVisual tick={tick} streaming={streaming} />

        {(streaming || error) && (
          <div className="pipeline-shell">
            <div className="pipeline-head">
              <span className="eyebrow">{error ? "Pipeline Status" : "Live Pipeline"}</span>
              <span className={`status-dot ${streaming ? "status-dot-pulse" : ""}`} style={{ background: error ? "var(--high)" : "var(--ok)" }} />
            </div>
            <AuditProgress steps={steps} backendLogs={backendLogs} />
          </div>
        )}

        {!streaming && (
          <>
            <div className="list-section">
              <p className="eyebrow">Audit History</p>
              <AuditHistory audits={audits} onSelectAudit={handleSelectAudit} selectedBlobId={selectedBlobId} />
            </div>

            {report && (
              <div className="panel">
                <AuditReport report={report} />
              </div>
            )}
          </>
        )}

        {!streaming && (
          <div className="panel">
            <p className="eyebrow" style={{ marginBottom: "0.8rem" }}>
              Audit Pipeline
            </p>
            <div className="flow-grid">
              {[
                { n: "1", title: "Tatum Sui RPC Read", body: "Module introspection + event/transaction context from Sui mainnet." },
                { n: "2", title: "RAG Retrieval", body: "Sui/Move security context retrieved with Gemini embeddings and targeted vulnerability queries." },
                { n: "3", title: "Gemini Analysis", body: "Structured findings with severity and technical reasoning metadata." },
                { n: "4", title: "Walrus Write", body: "Immutable audit JSON stored as a Walrus quilt patch for independent retrieval." },
                { n: "5", title: "Sui Anchor", body: "On-chain proof linking contract, auditor, quilt ID, epoch, and hash." },
              ].map((item) => (
                <div className="flow-item" key={item.n}>
                  <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>
                    {item.n}
                  </p>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
    </>
  );
}
