import { Link } from "react-router-dom";
import { shortenHash, toSuiScanTxUrl, toWalrusBlobUrl } from "../utils/links.js";

export function AuditHistory({ audits, onSelectAudit, selectedBlobId }) {
  if (!audits?.length) {
    return <p className="muted">No audits found yet.</p>;
  }

  return (
    <div className="audits-grid">
      {audits.map((audit) => (
        <article
          className={`audit-card audit-card--${audit.severity} ${selectedBlobId === (audit.blob_id ?? audit.walrus_blob_id) ? "audit-card--selected" : ""}`}
          key={`${audit.blob_id ?? audit.walrus_blob_id}-${audit.tx_digest}`}
          role="button"
          tabIndex={0}
          onClick={() => onSelectAudit?.(audit.blob_id ?? audit.walrus_blob_id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectAudit?.(audit.blob_id ?? audit.walrus_blob_id);
            }
          }}
        >
          <div className="audit-card-header">
            <p className="audit-card-timestamp">{new Date(audit.audited_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <span className={`sev sev-${audit.severity}`}>{audit.severity.toUpperCase()}</span>
          </div>
          
          <div className="audit-card-body">
            <div className="audit-info-row">
              <span className="label">Contract</span>
              <p className="mono address-mono">{shortenHash(audit.contract_id ?? audit.blob_id, 12, 8)}</p>
            </div>
            <div className="audit-info-row">
              <span className="label">Blob</span>
              <a
                className="smart-link mono"
                href={toWalrusBlobUrl(audit.blob_id ?? audit.walrus_blob_id)}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {shortenHash(audit.blob_id ?? audit.walrus_blob_id, 8, 5)}
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
            <Link
              className="btn btn--sm"
              to={`/verify/${audit.blob_id ?? audit.walrus_blob_id}`}
              onClick={(event) => event.stopPropagation()}
            >
              View Report →
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}