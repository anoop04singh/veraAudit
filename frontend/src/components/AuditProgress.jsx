import { useEffect, useRef, useState } from "react";

const STEP_META = {
  fetch: {
    label: "FETCH",
    abbrev: "FTCH",
    tagClass: "log-tag--fetch",
    logs: [
      "Connecting to Tatum Sui RPC endpoint...",
      "Resolved package ID on Sui mainnet.",
      "Fetching normalized Move modules...",
      "Retrieving module bytecode and ABI...",
      "Module introspection complete.",
    ],
  },
  context: {
    label: "CONTEXT",
    abbrev: "CTX",
    tagClass: "log-tag--context",
    logs: [
      "Querying chain event history via Tatum...",
      "Fetching recent transaction digests...",
      "Building execution context window...",
      "Resolving package dependencies...",
      "Chain context assembled.",
    ],
  },
  rag: {
    label: "RAG",
    abbrev: "RAG",
    tagClass: "log-tag--rag",
    logs: [
      "Extracting module signatures and object signals...",
      "Generating targeted Sui and Move retrieval queries...",
      "Embedding query with Gemini embedding model...",
      "Ranking vulnerability patterns and official guidance...",
      "Security context assembled for Gemini.",
    ],
  },
  audit: {
    label: "GEMINI",
    abbrev: "AI",
    tagClass: "log-tag--audit",
    logs: [
      "Initializing Gemini 2.0 Flash session...",
      "Submitting module source and context...",
      "Streaming structured reasoning output...",
      "Classifying findings by severity...",
      "Scoring access control, arithmetic, and object safety...",
      "AI analysis complete. Findings structured.",
    ],
  },
  walrus: {
    label: "WALRUS",
    abbrev: "WLRS",
    tagClass: "log-tag--walrus",
    logs: [
      "Serializing audit JSON payload...",
      "Uploading to Walrus storage...",
      "Content-addressing blob...",
      "Blob registered. Computing SHA-256 hash...",
      "Immutable blob stored. ID assigned.",
    ],
  },
  anchor: {
    label: "ANCHOR",
    abbrev: "SUI",
    tagClass: "log-tag--anchor",
    logs: [
      "Building Sui transaction...",
      "Attaching blob ID and hash to PTB...",
      "Signing with auditor keypair...",
      "Broadcasting to Sui mainnet...",
      "Transaction confirmed. Digest recorded.",
      "Audit permanently anchored on-chain.",
    ],
  },
};

const STEP_ORDER = ["fetch", "context", "rag", "audit", "walrus", "anchor"];
const ENABLE_SYNTHETIC_LOGS = false;

function getTime() {
  return new Date().toTimeString().slice(0, 8);
}

function statusLabel(status) {
  if (status === "done") return "OK";
  if (status === "error") return "ERR";
  if (status === "active") return "RUN";
  return "---";
}

function ActiveDot() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--red)",
        animation: "step-pulse-red 1.4s ease-in-out infinite",
      }}
    />
  );
}

function StepNode({ stepKey, status, stepIndex, activeIndex }) {
  const meta = STEP_META[stepKey];
  const state =
    status === "done" ? "done" : status === "error" ? "error" : stepIndex === activeIndex ? "active" : "pending";

  return (
    <div className={`step-node step-node--${state}`}>
      <div className="step-icon" aria-hidden="true">
        {state === "done" ? "OK" : state === "error" ? "ER" : state === "active" ? <ActiveDot /> : meta.abbrev}
      </div>
      <div className="step-name">{meta.label}</div>
      <div className="step-status-text">
        {state === "done" ? "complete" : state === "error" ? "failed" : state === "active" ? "running" : "waiting"}
      </div>
    </div>
  );
}

export function AuditProgress({ steps, backendLogs = [] }) {
  const [logLines, setLogLines] = useState([]);
  const bodyRef = useRef(null);
  const prevStepsRef = useRef([]);
  const logCounter = useRef(0);
  const consumedBackendLogsRef = useRef(0);

  function addLog(tag, msg, cls = "") {
    const id = logCounter.current++;
    setLogLines((prev) => [...prev, { id, time: getTime(), tag, tagClass: STEP_META[tag]?.tagClass ?? "log-tag--sys", msg, cls }]);
  }

  useEffect(() => {
    if (!steps?.length) return;

    if (!ENABLE_SYNTHETIC_LOGS) {
      prevStepsRef.current = steps;
      return;
    }

    const prev = prevStepsRef.current;

    steps.forEach((step) => {
      const old = prev.find((entry) => entry.step === step.step);
      const meta = STEP_META[step.step];
      if (!meta) return;

      if ((!old || old.status === "pending") && step.status !== "pending") {
        addLog(step.step, `Starting ${meta.label.toLowerCase()} phase...`, "log-msg--hl");

        meta.logs.forEach((line, index) => {
          setTimeout(() => addLog(step.step, line), 350 + index * 320);
        });
      }

      if (old && old.status !== "done" && step.status === "done") {
        const delay = (meta.logs.length + 1) * 320;
        setTimeout(() => addLog(step.step, step.message ?? `${meta.label} complete.`, "log-msg--ok"), delay);
      }

      if (step.status === "error") {
        addLog(step.step, `Error in ${meta.label}: ${step.message ?? "unknown"}`, "log-msg--err");
      }
    });

    prevStepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    setLogLines([
      {
        id: -1,
        time: getTime(),
        tag: "sys",
        tagClass: "log-tag--sys",
        msg: "VeraAudit pipeline initialized.",
        cls: "log-msg--hl",
      },
    ]);
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [logLines]);

  useEffect(() => {
    if (!backendLogs?.length) return;

    const start = consumedBackendLogsRef.current;
    const next = backendLogs.slice(start);
    if (!next.length) return;

    consumedBackendLogsRef.current = backendLogs.length;
    setLogLines((prev) => [
      ...prev,
      ...next.map((line) => ({
        id: logCounter.current++,
        time: getTime(),
        tag: line.step ?? "sys",
        tagClass: STEP_META[line.step]?.tagClass ?? "log-tag--sys",
        msg: line.message,
        details: line.details,
        cls: "",
      })),
    ]);
  }, [backendLogs]);

  useEffect(() => {
    if (backendLogs.length === 0) consumedBackendLogsRef.current = 0;
  }, [backendLogs.length]);

  const doneCount = steps.filter((step) => step.status === "done").length;
  const fillPct = STEP_ORDER.length > 0 ? (doneCount / STEP_ORDER.length) * 100 : 0;
  const isComplete = doneCount === STEP_ORDER.length;
  const hasError = steps.some((step) => step.status === "error");
  const activeIdx = steps.findIndex((step) => step.status === "running");

  return (
    <div className="progress-shell">
      <div className="step-pipeline" role="list" aria-label="Audit pipeline steps">
        <div className="step-fill-track" style={{ width: `${fillPct}%` }} aria-hidden="true" />
        {STEP_ORDER.map((key, index) => {
          const step = steps.find((entry) => entry.step === key) ?? { step: key, status: "pending", message: "" };
          return <StepNode key={key} stepKey={key} status={step.status} stepIndex={index} activeIndex={activeIdx} />;
        })}
      </div>

      <div className="terminal-shell" role="log" aria-label="Audit progress log" aria-live="polite">
        <div className="terminal-bar" aria-hidden="true">
          <span className="terminal-dot red" />
          <span className="terminal-dot amber" />
          <span className="terminal-dot green" />
          <span className="terminal-title">{hasError ? "PIPELINE FAILED" : isComplete ? "AUDIT COMPLETE" : "PIPELINE RUNNING"}</span>
        </div>

        <div className="terminal-body" ref={bodyRef}>
          {logLines.map((line) => (
            <div className="log-line" key={line.id}>
              <span className="log-time">{line.time}</span>
              <span className={`log-tag ${line.tagClass}`}>[{line.tag.toUpperCase()}]</span>
              <span className={`log-msg ${line.cls ?? ""}`}>
                {line.msg}
                {line.details && <pre className="log-details">{line.details}</pre>}
              </span>
            </div>
          ))}

          {!isComplete && !hasError && (
            <div className="log-line">
              <span className="log-time">{getTime()}</span>
              <span className="log-tag log-tag--sys">[SYS]</span>
              <span className="log-msg">
                <span className="cursor-blink" aria-hidden="true" />
              </span>
            </div>
          )}

          {isComplete && (
            <div className="log-line">
              <span className="log-time">{getTime()}</span>
              <span className="log-tag log-tag--anchor">[DONE]</span>
              <span className="log-msg log-msg--ok">All pipeline stages complete. Audit anchored on-chain.</span>
            </div>
          )}
        </div>
      </div>

      <div className="progress-list" aria-label="Step status summary">
        {steps.map((step) => {
          const meta = STEP_META[step.step];
          const active = activeIdx === STEP_ORDER.indexOf(step.step);
          return (
            <div className="progress-row" key={step.step}>
              <p>
                <span
                  style={{
                    color:
                      step.status === "done"
                        ? "var(--ok)"
                        : step.status === "error"
                          ? "var(--high)"
                          : active
                            ? "var(--red)"
                            : "var(--muted2)",
                    marginRight: "0.6rem",
                    fontSize: "0.68rem",
                    letterSpacing: "0.06em",
                  }}
                >
                  {meta?.label ?? step.step}
                </span>
                {step.message && step.message !== step.step ? step.message : meta?.logs?.[0] ?? "-"}
              </p>
              <span
                style={{
                  color:
                    step.status === "done"
                      ? "var(--ok)"
                      : step.status === "error"
                        ? "var(--high)"
                        : active
                          ? "var(--ink)"
                          : "var(--muted2)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.08em",
                }}
              >
                {statusLabel(
                  step.status === "done" ? "done" : step.status === "error" ? "error" : step.status === "running" ? "active" : "pending",
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
