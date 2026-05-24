import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AuditHistory } from "../components/AuditHistory.jsx";
import { AuditProgress } from "../components/AuditProgress.jsx";
import { AuditReport } from "../components/AuditReport.jsx";
import { apiJson, streamAudit } from "../utils/api.js";

/* ─── STEP ORDER / SEVERITY ─────────────────────────────── */

const stepOrder = ["fetch", "context", "audit", "walrus", "anchor"];

function asInitialSteps() {
  return stepOrder.map(step => ({ step, message: step, status: "pending" }));
}

function severityFromInt(v) {
  if (v === 4) return "critical";
  if (v === 3) return "high";
  if (v === 2) return "medium";
  if (v === 1) return "low";
  return "clean";
}

/* ─── ASCII BG DURING STREAM ────────────────────────────── */

const ASCII_CHARS = [".", "·", ":", "·", ".", " ", " ", " "];

function buildStreamAscii(tick, cols = 52, rows = 8) {
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      const v = Math.abs(Math.sin((x + tick * 0.3) * 0.18 + y * 0.5));
      return ASCII_CHARS[Math.floor(v * ASCII_CHARS.length) % ASCII_CHARS.length];
    }).join("")
  ).join("\n");
}

/* ─── HUD / STATUS BAR ──────────────────────────────────── */

function HudBar({ streaming, steps, error }) {
  const done    = steps.filter(s => s.status === "done").length;
  const total   = steps.length;
  const pct     = Math.round((done / total) * 100);
  const active  = steps.find((s, i) => s.status !== "done" && steps[i - 1]?.status === "done" || (i === 0 && s.status !== "done"));

  if (!streaming && !error) return null;

  return (
    <div style={{
      border: "1px solid var(--line)",
      background: "#060606",
      padding: "0.64rem 0.9rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
    }}>
      {/* Progress bar */}
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{
          height: 2, background: "var(--line2)",
          borderRadius: 1, overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            background: error ? "var(--high)" : "var(--ok)",
            transition: "width 600ms cubic-bezier(0.16,1,0.3,1)",
            borderRadius: 1,
          }} />
        </div>
      </div>
      <span style={{ fontSize: "0.68rem", color: "#555", flexShrink: 0, letterSpacing: "0.08em" }}>
        {error ? "FAILED" : done === total ? "COMPLETE" : `${done}/${total}`}
      </span>
    </div>
  );
}

/* ─── STREAMING VISUAL ──────────────────────────────────── */

function StreamingVisual({ tick, streaming }) {
  if (!streaming) return null;

  return (
    <div style={{
      border: "1px solid var(--line2)",
      background: "#030303",
      padding: "0.7rem 1rem",
      overflow: "hidden",
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
    }}>
      <pre aria-hidden="true" style={{
        margin: 0,
        color: "#1e1e1e",
        fontSize: "0.52rem",
        lineHeight: 1.08,
        letterSpacing: "0.06em",
        whiteSpace: "pre",
        userSelect: "none",
        flex: 1,
        overflow: "hidden",
      }}>
        {buildStreamAscii(tick)}
      </pre>
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div style={{
          fontSize: "0.62rem",
          color: "#e0e0e0",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "0.3rem",
        }}>
          Pipeline active
        </div>
        <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
          {["#1a3a2a", "#1a2e3a", "#2a1e3a", "#3a2a18", "#3a1a1a"].map((c, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: "50%",
              background: c,
              animation: `blink ${0.8 + i * 0.12}s step-end infinite`,
              animationDelay: `${i * 0.18}s`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── AUDIT PAGE ────────────────────────────────────────── */

export function AuditPage() {
  const { contractId } = useParams();
  const [loading,   setLoading]   = useState(true);
  const [audits,    setAudits]    = useState([]);
  const [report,    setReport]    = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [steps,     setSteps]     = useState(asInitialSteps());
  const [error,     setError]     = useState("");
  const [tick,      setTick]      = useState(0);
  const [backendLogs, setBackendLogs] = useState([]);

  const latest = useMemo(() => audits[0], [audits]);

  /* ASCII tick for streaming visual */
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => setTick(v => v + 1), 150);
    return () => clearInterval(t);
  }, [streaming]);

  function patchStep(key, status, message) {
    setSteps(curr =>
      curr.map(entry =>
        entry.step !== key ? entry : { ...entry, status, message: message ?? entry.message }
      )
    );
  }

  async function loadExisting() {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson(`/api/check/${contractId}`);
      if (data.found) {
        const prepared = (data.audits ?? []).map(audit => ({
          ...audit,
          severity: typeof audit.severity === "number"
            ? severityFromInt(audit.severity)
            : audit.severity,
        }));
        setAudits(prepared);
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
          } else if (payload.status === "running") {
            patchStep(payload.step, "running", payload.message);
          } else {
            patchStep(payload.step, "running", payload.message);
          }
        }
        if (event === "step_output") {
          patchStep(payload.step, "done", payload.message);
        }
        if (event === "complete") {
          stepOrder.forEach((step) => patchStep(step, "done", "Complete"));
          setAudits(curr => [{
            contract_id:    payload.contract_id,
            walrus_blob_id: payload.blob_id,
            blob_id:        payload.blob_id,
            audit_hash:     payload.audit_hash,
            tx_digest:      payload.tx_digest,
            severity:       payload.severity,
            audited_at:     payload.audited_at,
          }, ...curr]);
          setReport({
            summary:  payload.summary,
            severity: payload.severity,
            findings: [],
          });
          setStreaming(false);
        }
        if (event === "error") {
          setError(payload.message ?? "Audit failed.");
          setStreaming(false);
        }
        if (event === "step_log") {
          setBackendLogs((curr) => [
            ...curr,
            {
              step: payload.step ?? "system",
              message: payload.message ?? "",
              details: payload.details ?? null,
            },
          ]);
        }
        if (event === "step_output") {
          const details =
            payload.output && Object.keys(payload.output).length > 0
              ? ` ${JSON.stringify(payload.output)}`
              : "";
          setBackendLogs((curr) => [
            ...curr,
            {
              step: payload.step ?? "system",
              message: `${payload.message ?? "Step output captured."}${details}`.slice(0, 600),
              details: payload.output ?? null,
            },
          ]);
        }
      });
    } catch (err) {
      setError(err.message);
      setStreaming(false);
    }
  }

  async function loadBlob() {
    if (!latest?.walrus_blob_id && !latest?.blob_id) return;
    try {
      const blobId = latest.walrus_blob_id ?? latest.blob_id;
      const blob = await apiJson(`/api/blob/${blobId}`);
      setReport(blob);
    } catch {
      setReport(null);
    }
  }

  useEffect(() => { loadExisting(); }, [contractId]);

  useEffect(() => {
    if (!audits.length) return;
    loadBlob();
  }, [audits[0]?.walrus_blob_id, audits[0]?.blob_id]);

  useEffect(() => {
    if (!loading && audits.length === 0) runAudit();
  }, [loading]);

  /* ─── RENDER ──────────────────────────────────────────── */
  return (
    <section className="section audit-hub">
      <div className="s-inner">

        {/* ── HEADER ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <p className="eyebrow mono" style={{ fontSize: "0.66rem" }}>{contractId}</p>
          <h1 className="s-h2">Audit Timeline</h1>
        </div>

        {/* ── STATUS ──────────────────────────────────────── */}
        {loading && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.7rem",
            padding: "0.8rem", border: "1px solid var(--line2)", background: "#070707",
          }}>
            <span style={{
              display: "inline-block", width: 8, height: 8, borderRadius: "50%",
              background: "#333", animation: "step-pulse 1.2s ease-in-out infinite",
            }} />
            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
              Checking on-chain history...
            </span>
          </div>
        )}

        {error && (
          <div style={{
            border: "1px solid rgba(248,113,113,0.2)",
            background: "#0e0808", padding: "0.8rem",
            display: "flex", alignItems: "center", gap: "0.6rem",
          }}>
            <span style={{ color: "var(--high)", fontSize: "0.68rem", letterSpacing: "0.1em" }}>
              ✗ ERROR
            </span>
            <span className="error-text" style={{ fontSize: "0.82rem" }}>{error}</span>
          </div>
        )}

        {/* ── ACTIONS ─────────────────────────────────────── */}
        <div className="actions-row">
          <button
            className="btn btn--primary"
            onClick={runAudit}
            disabled={streaming}
          >
            {streaming ? "Running Audit..." : "Run New Audit"}
          </button>
          {latest && (
            <span style={{ color: "var(--muted)", fontSize: "0.76rem", alignSelf: "center" }}>
              Last run: {latest.audited_at ?? "—"}
            </span>
          )}
        </div>

        {/* ── HUD BAR ─────────────────────────────────────── */}
        <HudBar streaming={streaming} steps={steps} error={!!error} />

        {/* ── ASCII BG DURING STREAM ───────────────────────── */}
        <StreamingVisual tick={tick} streaming={streaming} />

        {/* ── PIPELINE + TERMINAL ─────────────────────────── */}
        {(streaming || error) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              marginBottom: "0.6rem",
            }}>
              <span className="eyebrow">{error ? "Pipeline Status" : "Live Pipeline"}</span>
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                background: error ? "var(--high)" : "var(--ok)",
                animation: streaming ? "step-pulse 1s ease-in-out infinite" : "none",
              }} />
            </div>
            <AuditProgress steps={steps} backendLogs={backendLogs} />
          </div>
        )}

        {/* ── HISTORY ─────────────────────────────────────── */}
        {!streaming && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p className="eyebrow">Audit History</p>
              <AuditHistory audits={audits} />
            </div>

            {/* ── REPORT ──────────────────────────────────── */}
            {report && (
              <div className="panel">
                <AuditReport report={report} />
              </div>
            )}
          </>
        )}

        {/* ── PIPELINE EXPLAINER ──────────────────────────── */}
        {!streaming && (
          <div className="panel">
            <p className="eyebrow" style={{ marginBottom: "0.8rem" }}>Audit Pipeline</p>
            <div className="flow-grid">
              {[
                { n: "1", title: "Tatum Sui RPC Read",  body: "Module introspection + event/transaction context from Sui testnet." },
                { n: "2", title: "Gemini Analysis",      body: "Structured findings with severity and technical reasoning metadata." },
                { n: "3", title: "Walrus Write",         body: "Immutable content-addressed audit JSON for independent retrieval." },
                { n: "4", title: "Sui Anchor",           body: "On-chain proof linking contract, auditor, blob ID, epoch, and hash." },
              ].map(f => (
                <div className="flow-item" key={f.n}>
                  <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>{f.n}</p>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
