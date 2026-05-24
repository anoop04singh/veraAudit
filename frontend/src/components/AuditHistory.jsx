import { Link } from "react-router-dom";

export function AuditHistory({ audits }) {
  if (!audits?.length) {
    return <p className="muted">No audits found yet.</p>;
  }

  return (
    <div className="list">
      {audits.map((audit) => (
        <article className="list-item" key={`${audit.blob_id ?? audit.walrus_blob_id}-${audit.tx_digest}`}>
          <div className="list-head">
            <p className="mono">{audit.audited_at}</p>
            <span className={`sev sev-${audit.severity}`}>{audit.severity}</span>
          </div>

          <p className="mono">Blob: {audit.blob_id ?? audit.walrus_blob_id}</p>
          <p className="mono">Tx: {audit.tx_digest}</p>
          <div className="actions-row">
            <Link className="inline-link" to={`/verify/${audit.blob_id ?? audit.walrus_blob_id}`}>
              verify
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
