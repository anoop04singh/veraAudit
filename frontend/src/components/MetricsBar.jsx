import { useEffect, useRef, useState } from "react";

/* Animated counter that triggers on scroll intersection */
function Counter({ value }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  const numeric = typeof value === "number" ? value : parseInt(value, 10) || 0;

  useEffect(() => {
    if (!ref.current || isNaN(numeric)) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const dur = 1400;
        const step = (now) => {
          const t = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(ease * numeric));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [numeric]);

  if (typeof value !== "number") return <span ref={ref}>{value}</span>;
  return <span ref={ref}>{display.toLocaleString()}</span>;
}

function Stat({ label, value, accent }) {
  return (
    <div className="metric-card reveal">
      <p className="metric-value" style={accent ? { color: accent } : undefined}>
        <Counter value={value} />
      </p>
      <p className="metric-label">{label}</p>
    </div>
  );
}

export function MetricsBar({ metrics }) {
  if (!metrics) return null;
  const dist = metrics.severity_distribution ?? {};

  return (
    <section className="metrics-grid" aria-label="Audit metrics">
      <Stat label="Total Audits"       value={metrics.total_audits}    />
      <Stat label="Unique Contracts"   value={metrics.unique_contracts} />
      <Stat label="Critical Findings"  value={dist.critical ?? 0} accent="var(--high)" />
      <Stat label="High Severity"      value={dist.high ?? 0}     accent="var(--med)"  />
    </section>
  );
}