import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MetricsBar } from "../components/MetricsBar.jsx";
import { apiJson } from "../utils/api.js";

export function HomePage() {
  const navigate = useNavigate();
  const [contractId, setContractId] = useState("");
  const [metrics,    setMetrics]    = useState(null);
  const [error,      setError]      = useState("");

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
    const id = setInterval(loadMetrics, 15000);
    return () => clearInterval(id);
  }, []);

  /* Reveal observer */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("in-view"); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal, .reveal-left, .reveal-scale").forEach(n => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!contractId.trim()) return;
    navigate(`/audit/${contractId.trim()}`);
  }

  return (
    <section className="section audit-hub">
      <div className="s-inner">

        {/* ── HERO ──────────────────────────────────────────── */}
        <div className="audit-hero-grid reveal in-view">
          <div className="audit-copy">
            <p className="eyebrow">Audit Workspace</p>
            <h1 className="hero-h1">
              <span className="h1-line">Run Or Verify</span>
              <span className="h1-line h1-line--push">Sui Contract Audits</span>
            </h1>
            <p className="hero-lead">
              Paste a Sui package ID to check audit history or trigger a fresh audit.
              Results are stored on Walrus and anchored on Sui testnet, with chain
              context fetched via Tatum RPC.
            </p>

            <form className="search-row" onSubmit={handleSubmit}>
              <input
                value={contractId}
                onChange={e => setContractId(e.target.value)}
                placeholder="Paste Sui package ID (0x...)"
                aria-label="Sui package ID"
              />
              <button type="submit" className="btn btn--primary">
                Open Contract
              </button>
            </form>

            <div className="tech-tag-row">
              {["Tatum RPC", "Gemini 2.0", "Walrus", "Sui Testnet"].map(t => (
                <span key={t} className="tech-tag">{t}</span>
              ))}
            </div>
          </div>

          <aside className="audit-visual" aria-hidden="true">
            <div className="orbital">
              <span className="orb orb-a" />
              <span className="orb orb-b" />
              <span className="orb orb-c" />
              <div className="orbital-core">VERIFY</div>
            </div>
            <div className="pipeline-mini">
              {["FETCH", "CTX", "AI", "BLOB", "SUI"].map(s => (
                <div key={s} className="p-step">{s}</div>
              ))}
            </div>
          </aside>
        </div>

        {/* ── METRICS ───────────────────────────────────────── */}
        <MetricsBar metrics={metrics} />

        {/* ── RECENT AUDITS ─────────────────────────────────── */}
        <div className="panel">
          <p className="eyebrow" style={{ marginBottom: "0.8rem" }}>Recent Audits</p>
          {error && (
            <p className="error-text" style={{ fontSize: "0.8rem" }}>{error}</p>
          )}
          {!metrics?.recent_audits?.length && (
            <p className="muted" style={{ fontSize: "0.82rem" }}>
              No events yet. Run your first audit above.
            </p>
          )}
          {!!metrics?.recent_audits?.length && (
            <div className="list">
              {metrics.recent_audits.map(item => (
                <div
                  className="list-item"
                  key={`${item.blob_id}-${item.tx_digest}`}
                >
                  <div className="list-head">
                    <p className="mono">{item.contract_id}</p>
                    <span className={`sev sev-${item.severity}`}>{item.severity}</span>
                  </div>
                  <p className="mono">{item.blob_id}</p>
                  <p className="mono" style={{ color: "#555" }}>{item.audited_at}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── PIPELINE EXPLAINER ────────────────────────────── */}
        <div className="panel">
          <p className="eyebrow" style={{ marginBottom: "0.8rem" }}>Audit Pipeline</p>
          <div className="flow-grid">
            {[
              { n: "1.", title: "Tatum Sui RPC Read",  body: "Module introspection + event/transaction context from Sui testnet." },
              { n: "2.", title: "Gemini Analysis",      body: "Structured findings with severity and technical reasoning metadata." },
              { n: "3.", title: "Walrus Write",         body: "Immutable content-addressed audit JSON for independent retrieval." },
              { n: "4.", title: "Sui Anchor",           body: "On-chain proof linking contract, auditor, blob ID, epoch, and hash." },
            ].map(f => (
              <div className="flow-item" key={f.n}>
                <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>{f.n}</p>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}