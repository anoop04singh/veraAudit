import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiJson } from "../utils/api.js";

function SignalField() {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const timeRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const visibilityRef = useRef(true);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isReducedMotion = mediaQuery.matches;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function handlePointerMove(event) {
      pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visibilityRef.current = entry?.isIntersecting ?? true;
        if (visibilityRef.current && !frameRef.current) {
          lastFrameRef.current = 0;
          frameRef.current = requestAnimationFrame(draw);
        }
      },
      { threshold: 0.02 },
    );
    intersectionObserver.observe(canvas);

    if (!isReducedMotion) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
    }

    function draw(now) {
      if (!visibilityRef.current) {
        frameRef.current = 0;
        return;
      }

      if (lastFrameRef.current && now - lastFrameRef.current < 40) {
        frameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameRef.current = now;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const horizonY = height * 0.4;
      const baseY = height * 0.88;
      const t = timeRef.current;
      const pointer = pointerRef.current;

      ctx.clearRect(0, 0, width, height);

      for (let depth = 0; depth < 28; depth += 1) {
        const z = depth / 27;
        const perspective = 1 / (0.16 + z * 2.55);
        const y = horizonY + (1 - z) * (baseY - horizonY);

        for (let col = -26; col <= 26; col += 1) {
          const xNorm = col / 26;
          const wave =
            Math.sin(xNorm * 7.8 + t * 0.92 + z * 4.6) * 0.044 +
            Math.cos(z * 15.2 - t * 1.18 + xNorm * 2.8) * 0.038;
          const drift = pointer.x * 14 * (1 - z);
          const px = width * 0.5 + xNorm * width * 0.6 * perspective + drift;
          const py = y + wave * height * 1.02 * perspective + pointer.y * 5 * (1 - z);
          const radius = Math.max(0.4, 0.4 + perspective * 0.7);
          const redMix = Math.max(0, 1 - z * 1.1) * (0.5 + Math.max(0, wave) * 4.4);
          const alpha = 0.11 + perspective * 0.09;
          const r = Math.round(120 + redMix * 80);
          const g = Math.round(30 + redMix * 16);
          const b = Math.round(30 + redMix * 16);

          ctx.beginPath();
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.92, alpha)})`;
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      timeRef.current += 0.011;
      frameRef.current = requestAnimationFrame(draw);
    }

    if (!isReducedMotion) {
      frameRef.current = requestAnimationFrame(draw);
    } else {
      draw(0);
    }

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="signal-field-canvas" />;
}

function Counter({ target }) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);
  const nodeRef = useRef(null);
  const hasValue = Number.isFinite(target) && target >= 0;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !hasValue) return undefined;

    startedRef.current = false;
    setValue(0);
    const goal = target;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || startedRef.current) return;
        startedRef.current = true;
        const start = performance.now();
        const duration = 1200;

        function step(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(goal * eased));
          if (progress < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasValue, target]);

  return <span ref={nodeRef}>{hasValue ? value.toLocaleString() : "..."}</span>;
}

const evidenceCards = [
  {
    index: "01 / FETCH",
    title: "MODULE FETCH",
    body: "Tatum pulls package modules, normalized Move source, and recent transaction context before the audit run begins.",
    output: "Output: code + chain context",
  },
  {
    index: "02 / RAG",
    title: "RAG CONTEXT",
    body: "Relevant Sui and Move security knowledge is retrieved before inference so the model reasons with targeted contract risk patterns.",
    output: "Output: retrieved security context",
  },
  {
    index: "03 / ANALYSIS",
    title: "GEMINI ANALYSIS",
    body: "Gemini evaluates the package using the fetched chain state and injected RAG context to produce structured findings and severity.",
    output: "Output: audit verdict + findings",
  },
  {
    index: "04 / STORAGE",
    title: "WALRUS STORAGE",
    body: "The audit payload is written as immutable evidence, so any change creates a new identifier and breaks the proof trail.",
    output: "Output: Walrus blob ID",
  },
  {
    index: "05 / ANCHORING",
    title: "SUI ANCHOR",
    body: "Tatum is used again to submit the anchoring transaction that binds the contract, blob reference, and proof hash on-chain.",
    output: "Output: Sui transaction digest",
  },
];

const tatumCards = [
  {
    title: "FETCH LAYER",
    body: "Tatum reads Sui modules, package metadata, and transaction history so the audit starts from real chain state.",
  },
  {
    title: "WRITE LAYER",
    body: "The same integration is used to coordinate Walrus uploads and submit the final Sui anchoring transaction.",
  },
];

const taxonomyCards = [
  {
    title: "SAFE TO INTERACT",
    body: "A clear boolean verdict indicating whether the contract is fundamentally safe for end users to touch.",
    meta: "Type: Boolean (true / false)",
  },
  {
    title: "SEVERITY LEVEL",
    body: "Overall risk classification based on the highest-impact issue identified during analysis.",
    meta: "Values: Critical, High, Medium, Low, Informational",
  },
  {
    title: "DETAILED FINDINGS",
    body: "Issue-level evidence with affected locations, exploit description, and remediation guidance.",
    meta: "Format: Array of finding objects",
  },
];

export function LandingPage() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("in-view");
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadMetrics() {
      try {
        const data = await apiJson("/api/metrics");
        if (alive) setMetrics(data);
      } catch {
        if (alive) setMetrics(null);
      }
    }

    loadMetrics();
    const timer = setInterval(loadMetrics, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <section className="landing-stage">
        <div className="signal-field-shell">
          <SignalField />
        </div>

        <div className="landing-stage-inner section">
          <div className="hero-kicker-row">
            <p className="mono">SUI MAINNET</p>
            <p className="mono hero-kicker-copy">
              Immutable audits anchored through Walrus storage and Sui smart contracts.
            </p>
          </div>

          <div className="hero-grid">
            <div className="hero-copy">
              <h1 className="hero-display">
                <span>VERIFIABLE</span>
                <span className="hero-display-accent">AI AUDITS</span>
              </h1>

              <p className="hero-lead hero-lead-hero">
                Audit artifacts, Walrus evidence, and Sui attestation tied into one proof-first security flow.
              </p>

              <div className="hero-actions">
                <Link className="btn btn--primary" to="/audit">
                  Run Audit
                </Link>
                <Link className="btn btn--ghost-technical" to="https://github.com/anoop04singh/veraaudit" target="_blank" rel="noopener noreferrer">
                  GITHUB
                </Link>
              </div>
            </div>
          </div>

          <div className="hero-stats">
            <div className="hero-stat-list">
              <div className="hero-stat">
                <span className="mono hero-stat-label">TOTAL AUDITS</span>
                <strong>
                  <Counter target={metrics?.total_audits} />
                </strong>
              </div>
              <div className="hero-stat">
                <span className="mono hero-stat-label">CONTRACTS</span>
                <strong>
                  <Counter target={metrics?.unique_contracts} />
                </strong>
              </div>
              <div className="hero-stat">
                <span className="mono hero-stat-label">CRITICAL FLAGS</span>
                <strong>
                  <Counter target={metrics?.severity_distribution?.critical} />
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="content-block">
        <div className="section section-stack">
          <div className="section-heading reveal">
            <p className="eyebrow">ARCHITECTURE</p>
            <h2 className="s-h2">THE EVIDENCE CHAIN</h2>
            <p className="hero-lead">
              A robust pipeline transforms raw smart contract code into verifiable, immutable security proofs anchored on the Sui network.
            </p>
          </div>

          <div className="evidence-grid">
            {evidenceCards.map((card) => (
              <article className="evidence-card reveal" key={card.index}>
                <p className="eyebrow evidence-card-index">{card.index}</p>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <div className="evidence-output mono">{card.output}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-block">
        <div className="section section-stack section-stack-tight">
          <div className="section-heading reveal">
            <p className="eyebrow">TATUM INTEGRATION</p>
            <h2 className="s-h2">CHAIN DATA IN, ANCHORING OUT</h2>
            <p className="hero-lead">
              Tatum is the operational bridge for this workflow: it fetches modules and transaction data up front, then drives the Walrus upload and Sui anchoring steps at the end.
            </p>
          </div>

          <div className="split-grid two-cols">
            {tatumCards.map((card) => (
              <article className="split-item reveal" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-block">
        <div className="section rag-grid">
          <div className="section-heading reveal">
            <p className="eyebrow">INTELLIGENCE LAYER</p>
            <h2 className="s-h2">RAG-ENHANCED AUDITING</h2>
            <p className="hero-lead">
              Generic models miss contract-specific risk patterns. VeraAudit injects targeted Sui and Move security context before the model reasons.
            </p>

            <div className="bullet-stream">
              <p className="mono bullet-line">-&gt; INJECTS SUI / MOVE-SPECIFIC SECURITY CONTEXT INTO THE ANALYSIS MODEL.</p>
              <p className="mono bullet-line">-&gt; REFERENCES KNOWN VULNERABILITY PATTERNS BEFORE SCORING FINDINGS.</p>
              <p className="mono bullet-line">-&gt; IMPROVES DETECTION OF ACCESS CONTROL, REENTRANCY, AND OBJECT WRAPPING FLAWS.</p>
            </div>
          </div>

          <div className="console-card reveal">
            <p className="mono console-kicker">SYSTEM CONSOLE // RAG CONTEXT INJECTION</p>
            <div className="console-stream">
              <p className="console-line">&gt; INITIALIZING RAG VECTOR STORE...</p>
              <p className="console-line">&gt; LOADING SUI_MOVE_SECURITY_PATTERNS.IDX</p>
              <p className="console-line">&gt; QUERYING CONTEXT FOR: "public fun transfer_object"</p>
              <p className="console-line">&gt; FOUND 14 RELEVANT VULNERABILITY VECTORS</p>
              <p className="console-line">&gt; AUGMENTING MODEL PROMPT...</p>
              <p className="console-line console-line-final">ANALYSIS ENGINE READY.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="content-block">
        <div className="section section-stack">
          <div className="section-heading reveal">
            <p className="eyebrow">REPORT STRUCTURE</p>
            <h2 className="s-h2">AUDIT TAXONOMY</h2>
            <p className="hero-lead">
              Every report uses a fixed schema so teams can inspect security evidence quickly and compare outputs cleanly.
            </p>
          </div>

          <div className="taxonomy-grid">
            {taxonomyCards.map((card) => (
              <article className="taxonomy-card reveal" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <span className="mono taxonomy-meta">{card.meta}</span>
              </article>
            ))}
          </div>

          <article className="panel panel--statement reveal">
            <div className="core-value-shell">
              <div className="core-value-copy">
                <p className="eyebrow">CORE VALUE</p>
                <p className="pull-quote">Every audit becomes one clean evidence record.</p>
                <p className="hero-lead">
                  Model reasoning, immutable storage, and on-chain anchoring are composed into a single proof surface that is easy to inspect and easy to share.
                </p>
              </div>
              <div className="core-value-action">
                <Link className="btn btn--primary" to="/audit">
                  Open Audit Workspace
                </Link>
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
