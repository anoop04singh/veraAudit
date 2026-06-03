import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MetricsBar } from "../components/MetricsBar.jsx";
import { apiJson } from "../utils/api.js";
import { shortenHash, toSuiScanTxUrl, toWalrusBlobUrl } from "../utils/links.js";

export function HomePage() {
  const navigate = useNavigate();
  const [contractId, setContractId] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");

  async function loadMetrics() {
    try {
      setError("");
      const data = await apiJson("/api/metrics");
      setMetrics(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadMetrics();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("in-view")),
      { threshold: 0.1 },
    );

    document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    if (!contractId.trim()) return;
    navigate(`/audit/${contractId.trim()}`);
  }

  return (
    <section className="section audit-hub">
      <div className="s-inner">
        <motion.div
          className="audit-hero-grid reveal in-view"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="audit-copy">
            <p className="eyebrow">AUDIT WORKSPACE</p>
            <h1 className="hero-h1">
              <span className="h1-line">RUN AUDITS.</span>
              <span className="h1-line h1-line--push">VERIFY EVIDENCE.</span>
            </h1>
            <p className="hero-lead">
              Inspect an existing audit trail or trigger a new proof run. Tatum fetches the package modules and transaction context, then the result is stored on Walrus and anchored on Sui.
            </p>

            <form className="search-row" onSubmit={handleSubmit}>
              <input
                value={contractId}
                onChange={(event) => setContractId(event.target.value)}
                placeholder="Paste Sui package ID (0x...)"
                aria-label="Sui package ID"
              />
              <button type="submit" className="btn btn--primary">
                Inspect Contract
              </button>
            </form>

            <div className="tech-tag-row">
              {["TATUM RPC", "GEMINI", "WALRUS", "SUI MAINNET"].map((item) => (
                <span key={item} className="tech-tag">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside className="audit-visual" aria-hidden="true">
            <div className="orbital">
              <span className="orb orb-a" />
              <span className="orb orb-b" />
              <span className="orb orb-c" />
            </div>
            <div className="pipeline-mini">
              {["FETCH", "CTX", "RAG", "AI", "BLOB", "SUI"].map((step) => (
                <div key={step} className="p-step">
                  {step}
                </div>
              ))}
            </div>
          </aside>
        </motion.div>

        <MetricsBar metrics={metrics} />

        <div className="panel reveal">
          <p className="eyebrow">RECENT AUDITS</p>
          <p className="section-caption">
            The latest evidence records for audited packages. Open any card to inspect the stored blob, transaction, and detailed report.
          </p>
          {error && <p className="error-text recent-error">{error}</p>}
          {!metrics?.recent_audits?.length && (
            <p className="muted recent-empty">No events yet. Run the first audit above.</p>
          )}

          {!!metrics?.recent_audits?.length && (
            <div className="list">
              {metrics.recent_audits.map((item) => {
                const blobId = item.quilt_id ?? item.blob_id ?? item.walrus_blob_id;
                const canOpenReport = Boolean(blobId);

                return (
                  <div
                    className="list-item list-item--interactive"
                    key={`${blobId}-${item.tx_digest}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!canOpenReport) return;
                      navigate(`/audit/${item.contract_id}?blob=${encodeURIComponent(blobId)}`);
                    }}
                    onKeyDown={(event) => {
                      if (!canOpenReport) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/audit/${item.contract_id}?blob=${encodeURIComponent(blobId)}`);
                      }
                    }}
                  >
                    <div className="list-head">
                      <p className="mono list-contract-id">
                        {shortenHash(item.contract_id)}
                      </p>
                      <span className={`sev sev-${item.severity}`}>{item.severity}</span>
                    </div>

                    <p className="mono">
                      blob:{" "}
                      <a
                        className="smart-link"
                        href={toWalrusBlobUrl(blobId)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {shortenHash(blobId)}
                      </a>
                    </p>

                    <p className="mono">
                      tx:{" "}
                      <a
                        className="smart-link"
                        href={toSuiScanTxUrl(item.tx_digest)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {shortenHash(item.tx_digest)}
                      </a>
                    </p>

                    <p className="mono subtle-text">{item.audited_at}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel reveal">
          <p className="eyebrow">AUDIT PIPELINE</p>
          <p className="section-caption">
            A concise view of how chain data, analysis, storage, and proof anchoring move through the system.
          </p>
          <div className="flow-grid">
            {[
              { n: "01", title: "TATUM MODULE FETCH", body: "Modules, package metadata, and transaction context are pulled from Sui mainnet." },
              { n: "02", title: "RAG RETRIEVAL", body: "Targeted Move security context is loaded before the model begins analysis." },
              { n: "03", title: "GEMINI ANALYSIS", body: "Structured findings generated with severity scores and technical reasoning." },
              { n: "04", title: "WALRUS WRITE", body: "Tatum is used to coordinate the immutable Walrus evidence upload." },
              { n: "05", title: "SUI ANCHOR", body: "Tatum submits the final Sui anchoring transaction for public verification." },
            ].map((item) => (
              <div className="flow-item" key={item.n}>
                <p className="eyebrow">{item.n}</p>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
