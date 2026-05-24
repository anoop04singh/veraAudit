import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/* ─── ASCII ENGINE ──────────────────────────────────────── */

const CHARS_SPARSE = [".", " ", " ", " ", ":", "-"];
const CHARS_DENSE  = [".", ":", "-", "=", "+", "*", "#"];
const KEYWORDS = ["TATUM", "WALRUS", "SUI", "GEMINI", "AUDIT", "PROOF", "VERA", "ANCHOR"];

function buildAsciiFrame(tick, cols = 58, rows = 16, density = "sparse") {
  const chars = density === "dense" ? CHARS_DENSE : CHARS_SPARSE;
  const grid = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      const wave = Math.sin((x * 0.22 + tick * 0.08) + y * 0.44) * 0.5 +
                   Math.sin((x * 0.11 - tick * 0.05) * 1.3 + y * 0.28) * 0.5;
      const idx = Math.abs(Math.floor(wave * (chars.length - 1))) % chars.length;
      return chars[idx];
    })
  );

  KEYWORDS.forEach((word, i) => {
    const row = Math.floor(((i * 3.1 + tick * 0.4) % rows + rows) % rows);
    const col = Math.floor(((i * 7.3 + tick * 0.7) % (cols - word.length - 1) + (cols - word.length - 1)) % (cols - word.length - 1));
    for (let c = 0; c < word.length; c++) {
      if (row >= 0 && row < rows && col + c >= 0 && col + c < cols) {
        grid[row][col + c] = word[c];
      }
    }
  });

  return grid.map(line => line.join("")).join("\n");
}

/* ─── COUNTER COMPONENT ─────────────────────────────────── */

function Counter({ target, duration = 1800, suffix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const step = (now) => {
          const t = Math.min((now - start) / duration, 1);
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

/* ─── DATA ──────────────────────────────────────────────── */

const narrativeFlow = [
  { tag: "Trust Gap",      text: "Audit claims are easy to publish, hard to verify. PDFs can be edited, selectively disclosed, or detached from deployed code." },
  { tag: "Proof Surface",  text: "VeraAudit converts every security claim into an independently checkable artifact trail — from AI reasoning to on-chain anchor." },
  { tag: "Walrus Layer",   text: "Audit payloads are immutable and content-addressed. Same bytes, same ID. Any change creates a different blob ID entirely." },
  { tag: "Sui Anchor",     text: "Each blob reference is timestamped on-chain with auditor identity and epoch evidence, creating a permanent proof record." },
  { tag: "Tatum Context",  text: "Tatum Sui RPC feeds module introspection, history traces, and verifiable audit execution — ground truth from the chain itself." },
];

const endUsers = [
  { title: "Developers",  body: "Security baseline for any Sui package — severity, vulnerable functions, and recommendations before integrations." },
  { title: "DeFi Users",  body: "Open a verification URL, inspect the on-chain anchor + Walrus blob, decide with evidence instead of trust." },
  { title: "Protocols",   body: "Replace self-hosted PDFs with cryptographic proof links that third parties can independently validate." },
  { title: "Researchers", body: "Permanent vulnerability history across audits, versions, and severity shifts over time." },
];

const techStack = [
  { name: "Gemini 2.0",  role: "AI Audit Engine",        desc: "Structured reasoning and severity classification for Move smart contracts." },
  { name: "Walrus",      role: "Immutable Storage",       desc: "Content-addressed blob store — any edit produces a new ID." },
  { name: "Sui Testnet", role: "On-chain Anchor",         desc: "Blob ID + hash anchored with auditor address and epoch." },
  { name: "Tatum RPC",   role: "Chain Data Layer",        desc: "Module introspection, event history, and transaction context." },
];

/* ─── LANDING PAGE ──────────────────────────────────────── */

export function LandingPage() {
  const [tick, setTick] = useState(0);

  /* ASCII tick */
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 160);
    return () => clearInterval(t);
  }, []);

  /* Mouse spotlight */
  useEffect(() => {
    const handler = (e) => {
      document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
      document.documentElement.style.setProperty("--my", `${e.clientY}px`);
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  /* Scroll reveals */
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("in-view"); });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

    const query = ".reveal, .reveal-left, .reveal-scale";
    const nodes = document.querySelectorAll(query);
    nodes.forEach(n => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="landing-hero section">
        <div className="s-inner hero-grid">
          <div className="hero-copy">
            <p className="eyebrow reveal">Tatum · Walrus · Sui · Gemini</p>
            <h1 className="hero-h1 reveal reveal-delay-1">
              <span className="h1-line">Proof,</span>
              <span className="h1-line h1-line--push">not claims.</span>
            </h1>
            <p className="hero-lead reveal reveal-delay-2">
              VeraAudit closes Sui's audit trust gap by combining Gemini AI reasoning,
              Walrus immutable blobs, and Sui on-chain anchors into one publicly
              verifiable evidence trail. No trust assumptions. No PDF games.
            </p>
            <div className="tech-tag-row reveal reveal-delay-3">
              {["Gemini 2.0 Flash", "Walrus Blob", "Sui Testnet", "Tatum RPC"].map(t => (
                <span key={t} className="tech-tag">{t}</span>
              ))}
            </div>
            <div className="actions-row reveal reveal-delay-4">
              <Link className="btn btn--primary" to="/audit">Open Audit Workspace</Link>
              <Link className="btn" to="/audit">Verify a Blob →</Link>
            </div>
          </div>

          <div className="hero-ascii-shell reveal reveal-delay-2">
            <pre className="hero-ascii" aria-hidden="true">
              {buildAsciiFrame(tick, 60, 18, "sparse")}
            </pre>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ─────────────────────────────────────────── */}
      <div className="marquee-wrap" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map(k => (
            <div key={k} className="marquee-line">
              {["VERA AUDIT", "GEMINI REASONING", "WALRUS IMMUTABILITY", "SUI ANCHOR",
                "TATUM RPC", "VERIFIABLE REPORTS", "PUBLIC EVIDENCE",
                "ZERO TRUST ASSUMPTIONS", "CONTRACT-SPECIFIC PROOF"].map(s => (
                <span key={s}>{s}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── STATS BAND ──────────────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="stat-band reveal">
            <div className="stat-cell">
              <div className="stat-num ok-text"><Counter target={1200} suffix="+" /></div>
              <div className="stat-label">Audits run</div>
              <div className="stat-sub">Sui testnet packages</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num"><Counter target={847} /></div>
              <div className="stat-label">Unique contracts</div>
              <div className="stat-sub">Distinct package IDs</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num" style={{ color: "var(--high)" }}><Counter target={214} /></div>
              <div className="stat-label">Critical findings</div>
              <div className="stat-sub">Across all audits</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num"><Counter target={100} suffix="%" /></div>
              <div className="stat-label">Verifiable on-chain</div>
              <div className="stat-sub">Every report anchored</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── THE PROBLEM ─────────────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="s-inner">
            <p className="eyebrow reveal">The Problem</p>
            <article className="panel panel--statement reveal reveal-delay-1">
              <h2 className="s-h2" style={{ marginBottom: "1rem" }}>
                Smart contract security on Sui<br />
                <span style={{ color: "#666" }}>still has a trust gap.</span>
              </h2>
              <p className="hero-lead">
                Most teams publish an audit PDF and ask users to trust it.
                There's no way to verify the AI actually examined your exact contract,
                that the report hasn't been edited, or that it was ever stored permanently.
              </p>
              <p className="pull-quote" style={{ marginTop: "1.4rem", borderTop: "1px solid #1a1a1a", paddingTop: "1.4rem" }}>
                VeraAudit removes that assumption by making each audit{" "}
                <em>cryptographically verifiable</em> from generation to storage to chain anchor.
              </p>
            </article>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <div className="full-section">
        <div className="section">
          <div className="s-inner">
            <p className="eyebrow reveal">The Architecture</p>
            <h2 className="s-h2 reveal reveal-delay-1">Three-layer proof chain.</h2>
            <div className="feature-list">
              {[
                { n: "01", title: "Verifiable AI Reasoning", body: "Not just a verdict. The audit record stores Gemini reasoning artifacts and structured decision context so every conclusion is independently inspectable. No black-box verdicts." },
                { n: "02", title: "Immutable Walrus Blob", body: "The full JSON payload — findings, severity scores, reasoning — is content-addressed on Walrus. Any byte change produces a different blob ID. Tampering is structurally impossible." },
                { n: "03", title: "On-chain Sui Anchor", body: "Blob ID + hash are anchored with auditor address and epoch, creating a permanent, timestamped proof. Anyone can verify independently with zero trust in the auditor." },
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

      {/* ── TECH STACK ──────────────────────────────────────── */}
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

      {/* ── HOW A USER USES IT ──────────────────────────────── */}
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
                  validate blob JSON on Walrus → confirm anchor on Sui.
                  Zero trust required.
                </p>
              </article>
              <article className="flow-item reveal reveal-delay-2">
                <p className="eyebrow" style={{ marginBottom: "0.6rem", color: "var(--ok)" }}>Flow B · Fresh Audit</p>
                <h3>Run a new audit</h3>
                <p>
                  Trigger the full pipeline: module fetch → chain context → Gemini analysis →
                  Walrus storage → Sui anchoring. Receive a permanent, shareable
                  verification URL. Takes under a minute.
                </p>
              </article>
            </div>
          </div>
        </div>
      </div>

      {/* ── WHO USES IT ─────────────────────────────────────── */}
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

      {/* ── NARRATIVE STREAM ────────────────────────────────── */}
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

      {/* ── CTA ─────────────────────────────────────────────── */}
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