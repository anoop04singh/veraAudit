import { Link } from "react-router-dom";
import { shortenHash, toSuiScanObjectUrl, toSuiScanTxUrl, toWalrusBlobUrl } from "../utils/links.js";

export function AuditHistory({ audits, onSelectAudit, selectedBlobId }) {
  if (!audits?.length) {
    return <p className="muted">No audits found yet.</p>;
  }

  return (
    <div className="audits-grid">
      {audits.map((audit) => {
        const blobId = audit.quilt_id ?? audit.blob_id ?? audit.walrus_blob_id;

        return (
          <article
            className={`audit-card audit-card--${audit.severity} ${selectedBlobId === blobId ? "audit-card--selected" : ""}`}
            key={`${blobId}-${audit.tx_digest}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectAudit?.(blobId)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectAudit?.(blobId);
              }
            }}
          >
            <div className="audit-card-header">
              <div className="audit-card-titleblock">
                <span className="audit-card-kicker">Audit event</span>
                <p className="mono audit-card-primary">{shortenHash(audit.contract_id ?? blobId, 10, 8)}</p>
              </div>
              <p className="audit-card-timestamp">
                {new Date(audit.audited_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div className="audit-card-body">
              <div className="audit-info-row">
                <span className="label">Contract</span>
                <a
                  className="smart-link mono address-mono"
                  href={toSuiScanObjectUrl(audit.contract_id)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {shortenHash(audit.contract_id ?? blobId, 12, 8)}
                </a>
              </div>

              <div className="audit-info-row">
                <span className="label">Blob</span>
                <a
                  className="smart-link mono"
                  href={toWalrusBlobUrl(blobId)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {shortenHash(blobId, 8, 5)}
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
              <span className={`sev sev-${audit.severity}`}>{audit.severity.toUpperCase()}</span>
              <Link className="btn btn--sm" to={`/verify/${blobId}`} onClick={(event) => event.stopPropagation()}>
                Verify Proof
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
