export function AuditReport({ report }) {
  if (!report) return null;
  const findings = report.findings ?? [];
  const ragChunks = report.rag_context?.chunks ?? [];
  const severityCount = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    clean: findings.filter(f => f.severity === 'clean').length,
  };

  return (
    <section className="report">
      <div className="report-header">
        <div className="report-header-copy">
          <p className="eyebrow">AUDIT DETAILS</p>
          <h3>Audit Report</h3>
          <p className="report-summary">{report.summary}</p>
        </div>
        <span className={`sev sev-${report.severity} sev--large`}>{report.severity.toUpperCase()}</span>
      </div>

      <div className="findings-overview">
        <div className="findings-stat findings-stat--critical">
          <span className="stat-value">{severityCount.critical}</span>
          <span className="stat-label">Critical</span>
        </div>
        <div className="findings-stat findings-stat--high">
          <span className="stat-value">{severityCount.high}</span>
          <span className="stat-label">High</span>
        </div>
        <div className="findings-stat findings-stat--medium">
          <span className="stat-value">{severityCount.medium}</span>
          <span className="stat-label">Medium</span>
        </div>
        <div className="findings-stat findings-stat--low">
          <span className="stat-value">{severityCount.low}</span>
          <span className="stat-label">Low</span>
        </div>
      </div>

      <div className="findings-section">
        <div className="findings-header">
          <h4>Findings ({findings.length})</h4>
          <p className="findings-desc">Ordered by severity level</p>
        </div>
        <div className="findings-list">
          {!findings.length && <p className="muted">No findings detected. Contract audit passed.</p>}
          {findings.map((finding) => (
            <div className={`finding-card finding-card--${finding.severity}`} key={finding.id}>
              <div className="finding-header">
                <div className="finding-title-row">
                  <span className={`sev sev-${finding.severity}`}>{finding.severity}</span>
                  <h5 className="finding-title">{finding.title}</h5>
                </div>
              </div>
              <div className="finding-body finding-body-grid">
                <div className="finding-field">
                  <span className="field-label">Location</span>
                  <p className="mono field-value">{finding.location}</p>
                </div>
                <div className="finding-field">
                  <span className="field-label">Issue</span>
                  <p className="field-value">{finding.description}</p>
                </div>
                <div className="finding-field finding-field--recommendation">
                  <span className="field-label">Recommendation</span>
                  <p className="field-value">{finding.recommendation}</p>
                </div>
                {finding.reference && (
                  <div className="finding-field">
                    <span className="field-label">Reference</span>
                    <p className="field-value">
                      {/^https?:\/\//i.test(finding.reference) ? (
                        <a className="smart-link" href={finding.reference} target="_blank" rel="noreferrer">
                          {finding.reference}
                        </a>
                      ) : (
                        finding.reference
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!!ragChunks.length && (
        <div className="findings-section">
          <div className="findings-header">
            <h4>RAG Context ({ragChunks.length})</h4>
            <p className="findings-desc">
              {report.rag_context?.embedding_used ? "Ranked with Gemini embeddings" : "Ranked with lexical fallback"}
            </p>
          </div>
          <div className="rag-source-grid">
            {ragChunks.slice(0, 6).map((chunk) => {
              const isExternal = /^https?:\/\//i.test(chunk.source_url ?? "");
              const content = (
                <>
                  <span className="field-label">{chunk.vuln_category}</span>
                  <strong>{chunk.title}</strong>
                  <span className="mono">score {chunk.score}</span>
                </>
              );

              return isExternal ? (
                <a className="rag-source-card" href={chunk.source_url} target="_blank" rel="noreferrer" key={chunk.id}>
                  {content}
                </a>
              ) : (
                <article className="rag-source-card" key={chunk.id}>
                  {content}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
