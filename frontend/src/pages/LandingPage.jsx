import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { apiJson } from "../utils/api.js";

/* ─── CANVAS ASCII ENGINE ───────────────────────────────────
   Adapted from anoop-studio / pattern-ascii-terminal.md
   Uses requestAnimationFrame + ResizeObserver (no rAF polling)
─────────────────────────────────────────────────────────── */
function AsciiHeroCanvas() {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const tickRef   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // ── Resize to container ──
    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width  = rect.width  || 520;
      canvas.height = rect.height || 300;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    // ── Config ──
    const CELL     = 11;
    const BASE_CH  = [" ", " ", " ", " ", ".", ".", "\u00B7", ":", "-", ","];
    const KEYWORDS = ["AUDIT", "PROOF", "VERA", "TATUM", "ANCHOR", ":WALRUS---", "SUI", "GEMINI"];

    // ── Frame renderer ──
    function draw() {
      tickRef.current += 0.4;
      const tick = tickRef.current;
      const W    = canvas.width;
      const H    = canvas.height;
      const cols = Math.floor(W / CELL);
      const rows = Math.floor(H / CELL);

      ctx.clearRect(0, 0, W, H);
      ctx.font         = `${CELL}px 'JetBrains Mono', monospace`;
      ctx.textBaseline = "top";

      // Background dot-wave field
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wave =
            Math.sin((c * 0.22 + tick * 0.07) + r * 0.44) * 0.5 +
            Math.sin((c * 0.11 - tick * 0.04) * 1.3 + r * 0.28) * 0.5;
          const norm = (wave + 1) / 2;
          const idx  = Math.floor(norm * (BASE_CH.length - 1));
          const ch   = BASE_CH[Math.max(0, Math.min(idx, BASE_CH.length - 1))];
          if (ch !== " ") {
            const alpha = 0.10 + norm * 0.20;
            ctx.fillStyle = `rgba(138, 127, 118, ${alpha.toFixed(2)})`;
            ctx.fillText(ch, c * CELL, r * CELL);
          }
        }
      }

      // Floating keyword labels
      KEYWORDS.forEach((word, i) => {
        const spd = 0.055 + i * 0.008;
        const maxCol = Math.max(1, cols - word.length - 2);
        const row = Math.floor(((i * 3.7 + tick * spd)       % rows   + rows  ) % rows  );
        const col = Math.floor(((i * 7.1 + tick * spd * 1.3) % maxCol + maxCol) % maxCol);
        // keyword ghost
        ctx.fillStyle = "rgba(58, 51, 48, 0.38)";
        ctx.fillText(word, col * CELL, row * CELL);
      });

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}

/* ─── COUNTER ───────────────────────────────────────────── */
function Counter({ target, duration = 1800, suffix = "" }) {
  const [val, setVal] = useState(0);
  const ref     = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const step = (now) => {
          const t    = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setVal(Math.round(ease * target));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ─── STATIC DATA ───────────────────────────────────────── */
const narrativeFlow = [
  { tag: "Trust Gap",     text: "Audit claims are easy to publish, hard to verify. PDFs can be edited, selectively disclosed, or detached from deployed code." },
  { tag: "Proof Surface", text: "VeraAudit converts every security claim into an independently checkable artifact trail — from AI reasoning to on-chain anchor." },
  { tag: "Walrus Layer",  text: "Audit payloads are immutable and content-addressed. Same bytes, same ID. Any change creates a different blob ID entirely." },
  { tag: "Sui Anchor",    text: "Each blob reference is timestamped on-chain with auditor identity and epoch evidence, creating a permanent proof record." },
  { tag: "Tatum Context", text: "Tatum Sui RPC feeds module introspection, history traces, and verifiable audit execution — ground truth from the chain itself." },
];

const endUsers = [
  { title: "Developers",  body: "Security baseline for any Sui package — severity, vulnerable functions, and recommendations before integrations." },
  { title: "DeFi Users",  body: "Open a verification URL, inspect the on-chain anchor + Walrus blob, decide with evidence instead of trust." },
  { title: "Protocols",   body: "Replace self-hosted PDFs with cryptographic proof links that third parties can independently validate." },
  { title: "Researchers", body: "Permanent vulnerability history across audits, versions, and severity shifts over time." },
];

const techStack = [
  { name: "Gemini 2.0",  role: "AI Audit Engine",   desc: "Structured reasoning and severity classification for Move smart contracts." },
  { name: "Walrus",      role: "Immutable Storage",  desc: "Content-addressed blob store — any edit produces a new ID." },
  { name: "Sui Testnet", role: "On-chain Anchor",    desc: "Blob ID + hash anchored with auditor address and epoch." },
  { name: "Tatum RPC",   role: "Chain Data Layer",   desc: "Module introspection, event history, and transaction context." },
];

const references = [
  { label: "Tatum Sui RPC docs", href: "https://docs.tatum.io/reference/rpc-sui" },
  { label: "Walrus docs",        href: "https://docs.wal.app/" },
  { label: "SuiVision",          href: "https://suivision.xyz/" },
  { label: "SuiScan",            href: "https://suiscan.xyz/" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.16, 1, 0.3, 1] } },
};

/* ─── LANDING PAGE ──────────────────────────────────────── */
export function LandingPage() {
  const [metrics, setMetrics] = useState(null);

  /* Scroll reveals */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("in-view"); }),
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal, .reveal-left, .reveal-scale").forEach(n => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try { const d = await apiJson("/api/metrics"); if (alive) setMetrics(d); } catch { /* noop */ }
    }
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="landing-hero section">
        <div className="s-inner hero-grid">

          <div className="hero-copy">
            <motion.p
              className="eyebrow"
              initial="hidden" animate="show" variants={fadeUp}
            >
              Tatum · Walrus · Sui · Gemini
            </motion.p>

            {/* h1 — ink / ink-dim, never red */}
            <motion.h1
              className="hero-h1"
              initial="hidden" animate="show" variants={fadeUp}
              transition={{ delay: 0.06 }}
            >
              <span className="h1-line">Proof,</span>
              <span className="h1-line h1-line--push">not claims.</span>
            </motion.h1>

            <motion.p
              className="hero-lead"
              initial="hidden" animate="show" variants={fadeUp}
              transition={{ delay: 0.12 }}
            >
              VeraAudit closes Sui's audit trust gap by combining Gemini AI reasoning,
              Walrus immutable blobs, and Sui on-chain anchors into one publicly
              verifiable evidence trail. No trust assumptions. No PDF games.
            </motion.p>

            <motion.div
              className="tech-tag-row"
              initial="hidden" animate="show" variants={fadeUp}
              transition={{ delay: 0.18 }}
            >
              {["Gemini 2.0 Flash", "Walrus Blob", "Sui Testnet", "Tatum RPC"].map(t => (
                <span key={t} className="tech-tag">{t}</span>
              ))}
            </motion.div>

            <motion.div
              className="actions-row"
              initial="hidden" animate="show" variants={fadeUp}
              transition={{ delay: 0.24 }}
            >
              <Link className="btn btn--primary" to="/audit">Open Audit Workspace</Link>
              <Link className="btn" to="/audit">Verify a Blob →</Link>
            </motion.div>

            <motion.div
              className="reference-row"
              initial="hidden" animate="show" variants={fadeUp}
              transition={{ delay: 0.28 }}
            >
              {references.map(item => (
                <a key={item.href} className="smart-link" href={item.href} target="_blank" rel="noreferrer">
                  {item.label}
                </a>
              ))}
            </motion.div>
          </div>

          {/* ── ASCII CANVAS VISUAL ─────────────────────── */}
          <motion.div
            className="hero-ascii-shell"
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.14 }}
          >
            <AsciiHeroCanvas />
            <div className="hero-ascii-corner" aria-hidden="true">ASCII</div>
          </motion.div>
        </div>
      </section>

      {/* ── MARQUEE ──────────────────────────────────────── */}
      <div className="marquee-wrap" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map(k => (
            <div key={k} className="marquee-line">
              {[
                "VERA AUDIT", "GEMINI REASONING", "WALRUS IMMUTABILITY",
                "SUI ANCHOR", "TATUM RPC", "VERIFIABLE REPORTS",
                "PUBLIC EVIDENCE", "ZERO TRUST ASSUMPTIONS", "CONTRACT-SPECIFIC PROOF",
              ].map(s => <span key={s}>{s}</span>)}
            </div>
          ))}
        </div>
      </div>

      {/* ── STATS BAND ───────────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="stat-band reveal">
            <div className="stat-cell">
              <div className="stat-num ok-text"><Counter target={metrics?.total_audits ?? 0} /></div>
              <div className="stat-label">Audits run</div>
              <div className="stat-sub">Sui testnet packages</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num"><Counter target={metrics?.unique_contracts ?? 0} /></div>
              <div className="stat-label">Unique contracts</div>
              <div className="stat-sub">Distinct package IDs</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num" style={{ color: "var(--high)" }}>
                <Counter target={metrics?.severity_distribution?.critical ?? 0} />
              </div>
              <div className="stat-label">Critical findings</div>
              <div className="stat-sub">Across all audits</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num" style={{ color: "var(--med)" }}>
                <Counter target={metrics?.severity_distribution?.high ?? 0} />
              </div>
              <div className="stat-label">High severity</div>
              <div className="stat-sub">Active risk count</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── THE PROBLEM ──────────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="s-inner">
            <p className="eyebrow reveal">The Problem</p>
            <article className="panel panel--statement reveal reveal-delay-1">
              <h2 className="s-h2" style={{ marginBottom: "1rem" }}>
                Smart contract security on Sui<br />
                <span className="s-h2-dim">still has a trust gap.</span>
              </h2>
              <p className="hero-lead">
                Most teams publish an audit PDF and ask users to trust it.
                There's no way to verify the AI actually examined your exact contract,
                that the report hasn't been edited, or that it was ever stored permanently.{" "}
                <span className="inline-doc-links">
                  See{" "}
                  <a className="smart-link" href="https://docs.wal.app/" target="_blank" rel="noreferrer">
                    Walrus storage guarantees
                  </a>{" "}
                  and{" "}
                  <a className="smart-link" href="https://docs.tatum.io/reference/rpc-sui" target="_blank" rel="noreferrer">
                    Tatum RPC reference
                  </a>.
                </span>
              </p>
              <p className="pull-quote" style={{ marginTop: "1.4rem", borderTop: "1px solid var(--border)", paddingTop: "1.4rem" }}>
                VeraAudit removes that assumption by making each audit{" "}
                <em>cryptographically verifiable</em> from generation to storage to chain anchor.
              </p>
            </article>
          </div>
        </div>
      </div>

      {/* ── ARCHITECTURE ─────────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="s-inner">
            <p className="eyebrow reveal">The Architecture</p>
            <h2 className="s-h2 reveal reveal-delay-1">Three-layer proof chain.</h2>
            <div className="feature-list">
              {[
                { n: "01", title: "Verifiable AI Reasoning",  body: "Not just a verdict. The audit record stores Gemini reasoning artifacts and structured decision context so every conclusion is independently inspectable. No black-box verdicts." },
                { n: "02", title: "Immutable Walrus Blob",    body: "The full JSON payload — findings, severity scores, reasoning — is content-addressed on Walrus. Any byte change produces a different blob ID. Tampering is structurally impossible." },
                { n: "03", title: "On-chain Sui Anchor",      body: "Blob ID + hash are anchored with auditor address and epoch, creating a permanent, timestamped proof. Anyone can verify independently with zero trust in the auditor." },
              ].map((f, i) => (
                <div className={`feature-row reveal reveal-delay-${i + 1}`} key={f.n}>
                  <div className="feature-num">{f.n}</div>
                  <div className="feature-body">
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── TECH STACK ───────────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="s-inner">
            <p className="eyebrow reveal">Technology Stack</p>
            <div className="split-grid two-cols">
              {techStack.map((t, i) => (
                <div className={`split-item reveal reveal-delay-${i + 1}`} key={t.name}>
                  <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>{t.role}</p>
                  <h3 style={{ marginBottom: "0.4rem" }}>{t.name}</h3>
                  <p>{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── USER FLOWS ───────────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="s-inner">
            <p className="eyebrow reveal">User Flows</p>
            <div className="flow-grid">
              <article className="flow-item reveal reveal-delay-1">
                <p className="eyebrow" style={{ marginBottom: "0.6rem", color: "var(--low)" }}>Flow A · Existing Audits</p>
                <h3>Verify a known package</h3>
                <p>
                  Paste a package ID → inspect audit timeline → open latest findings →
                  validate blob JSON on Walrus → confirm anchor on Sui. Zero trust required.
                </p>
              </article>
              <article className="flow-item reveal reveal-delay-2">
                <p className="eyebrow" style={{ marginBottom: "0.6rem", color: "var(--ok)" }}>Flow B · Fresh Audit</p>
                <h3>Run a new audit</h3>
                <p>
                  Trigger the full pipeline: module fetch → chain context → Gemini analysis →
                  Walrus storage → Sui anchoring. Receive a permanent, shareable verification URL.
                  Takes under a minute.
                </p>
              </article>
            </div>
          </div>
        </div>
      </div>

      {/* ── WHO USES IT ──────────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="s-inner">
            <p className="eyebrow reveal">Who Uses It</p>
            <div className="split-grid two-cols">
              {endUsers.map((u, i) => (
                <div className={`split-item reveal reveal-delay-${i + 1}`} key={u.title}>
                  <h3>{u.title}</h3>
                  <p>{u.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── NARRATIVE STREAM ─────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="s-inner">
            <p className="eyebrow reveal">End-to-End Story</p>
            <div className="narrative-stream">
              {narrativeFlow.map((item, i) => (
                <article className={`story-card reveal reveal-delay-${Math.min(i + 1, 5)}`} key={item.tag}>
                  <p className="story-tag">{item.tag}</p>
                  <p className="story-text">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA ──────────────────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="s-inner">
            <article className="panel panel--statement reveal">
              <p className="eyebrow" style={{ marginBottom: "1.2rem" }}>Core Value</p>
              <p className="pull-quote">
                For the first time on Sui, you can{" "}
                <em>prove</em> that a specific AI auditor examined a specific contract
                and reached specific conclusions — with evidence on{" "}
                <em>decentralised infrastructure</em> and proof anchored on-chain.
              </p>
              <div className="actions-row" style={{ marginTop: "2rem" }}>
                <Link className="btn btn--primary" to="/audit">
                  Open Audit Workspace
                </Link>
              </div>
            </article>
          </div>
        </div>
      </div>
    </>
  );
}