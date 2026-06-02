import { Link } from "react-router-dom";
import { shortenHash, toSuiScanTxUrl, toWalrusBlobUrl } from "../utils/links.js";

export function AuditHistory({ audits, onSelectAudit, selectedBlobId }) {
  if (!audits?.length) {
    return <p className="muted">No audits found yet.</p>;
  }

  return (
    <div className="audits-grid">
      {audits.map((audit) => {
        const quiltId = audit.quilt_id ?? audit.blob_id ?? audit.walrus_blob_id;

        return (
          <article
            className={`audit-card audit-card--${audit.severity} ${selectedBlobId === quiltId ? "audit-card--selected" : ""}`}
            key={`${quiltId}-${audit.tx_digest}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectAudit?.(quiltId)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectAudit?.(quiltId);
              }
            }}
          >
            <div className="audit-card-header">
              <p className="audit-card-timestamp">
                {new Date(audit.audited_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <span className={`sev sev-${audit.severity}`}>{audit.severity.toUpperCase()}</span>
            </div>

            <div className="audit-card-body">
              <div className="audit-info-row">
                <span className="label">Contract</span>
                <p className="mono address-mono">{shortenHash(audit.contract_id ?? quiltId, 12, 8)}</p>
              </div>
              <div className="audit-info-row">
                <span className="label">Quilt</span>
                <a
                  className="smart-link mono"
                  href={toWalrusBlobUrl(quiltId)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {shortenHash(quiltId, 8, 5)}
                </a>
              </div>
              <div className="audit-info-row">
                <span className="label">Tx</span>
                <a
                  className="smart-link mono"
                  href={toSuiScanTxUrl(audit.tx_digest)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {shortenHash(audit.tx_digest, 8, 5)}
                </a>
              </div>
            </div>

            <div className="audit-card-footer">
              <Link className="btn btn--sm" to={`/verify/${quiltId}`} onClick={(event) => event.stopPropagation()}>
                View Report →
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
