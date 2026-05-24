export function AuditReport({ report }) {
  if (!report) return null;

  return (
    <section className="report">
      <div className="list-head">
        <h3>Latest audit summary</h3>
        <span className={`sev sev-${report.severity}`}>{report.severity}</span>
      </div>
      <p className="report-summary">{report.summary}</p>

      <h4>Findings</h4>
      <div className="list">
        {(report.findings ?? []).map((finding) => (
          <article className="list-item" key={finding.id}>
            <div className="list-head">
              <strong>{finding.id}</strong>
              <span className={`sev sev-${finding.severity}`}>{finding.severity}</span>
            </div>
            <p>{finding.title}</p>
            <p className="mono">{finding.location}</p>
            <p>{finding.description}</p>
            <p className="muted">Fix: {finding.recommendation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
