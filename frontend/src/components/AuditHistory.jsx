import { Link } from "react-router-dom";
import { shortenHash, toSuiVisionTxUrl, toWalrusBlobUrl } from "../utils/links.js";

export function AuditHistory({ audits, onSelectAudit, selectedBlobId }) {
  if (!audits?.length) {
    return <p className="muted">No audits found yet.</p>;
  }

  return (
    <div className="list">
      {audits.map((audit) => (
        <article
          className={`list-item list-item--interactive ${selectedBlobId === (audit.blob_id ?? audit.walrus_blob_id) ? "list-item-selected" : ""}`}
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
          <div className="list-head">
            <p className="mono">{audit.audited_at}</p>
            <span className={`sev sev-${audit.severity}`}>{audit.severity}</span>
          </div>

          <p className="mono">
            Blob:{" "}
            <a
              className="smart-link"
              href={toWalrusBlobUrl(audit.blob_id ?? audit.walrus_blob_id)}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {shortenHash(audit.blob_id ?? audit.walrus_blob_id)}
            </a>
          </p>
          <p className="mono">
            Tx:{" "}
            <a
              className="smart-link"
              href={toSuiVisionTxUrl(audit.tx_digest)}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {shortenHash(audit.tx_digest)}
            </a>
          </p>
          <div className="actions-row">
            <Link
              className="inline-link"
              to={`/verify/${audit.blob_id ?? audit.walrus_blob_id}`}
              onClick={(event) => event.stopPropagation()}
            >
              verify
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
