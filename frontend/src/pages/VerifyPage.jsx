import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiJson } from "../utils/api.js";
import { shortenHash, toSuiScanObjectUrl, toSuiScanTxUrl, toWalrusBlobUrl } from "../utils/links.js";

export function VerifyPage() {
  const { blobId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const response = await apiJson(`/api/verify/${blobId}`);
        setData(response);
      } catch (err) {
        setError(err.message);
      }
    }

    load();
  }, [blobId]);

  return (
    <section className="section verify-shell">
      <div className="s-inner">
        <div className="panel panel--statement">
          <p className="eyebrow">PROOF VERIFICATION</p>
          <h1 className="s-h2">VERIFY EVIDENCE ANCHOR</h1>
          <p className="hero-lead">
            Inspect the Walrus payload against the on-chain hash to confirm that the stored audit evidence matches the Tatum-submitted Sui anchor exactly.
          </p>
          <p className="mono verify-blob-link">
            blob:{" "}
            <a className="smart-link" href={toWalrusBlobUrl(blobId)} target="_blank" rel="noreferrer">
              {blobId}
            </a>
          </p>
        </div>

        {error && (
          <div className="status-banner status-banner-error">
            <span className="status-chip status-chip-error">ERROR</span>
            <span className="error-text">{error}</span>
          </div>
        )}

        {data && (
          <>
            <div className="verify-summary-grid">
              <article className="verify-summary-card">
                <p className="eyebrow">STATUS</p>
                <p className={`verify-status ${data.verified ? "verify-status-ok" : "verify-status-error"}`}>
                  {data.verified ? "VERIFIED" : "MISMATCH"}
                </p>
                <p className="muted">
                  {data.verified
                    ? "Walrus content matches the on-chain hash."
                    : "Verification failed. The payload does not match the anchored proof."}
                </p>
              </article>

              <article className="verify-summary-card">
                <p className="eyebrow">CONTRACT</p>
                <p className="mono">
                  {data.contract_id ? (
                    <a className="smart-link" href={toSuiScanObjectUrl(data.contract_id)} target="_blank" rel="noreferrer">
                      {shortenHash(data.contract_id)}
                    </a>
                  ) : (
                    "-"
                  )}
                </p>
                <p className="muted">Sui package under audit.</p>
              </article>

              <article className="verify-summary-card">
                <p className="eyebrow">ANCHOR TX</p>
                <p className="mono">
                  {data.tx_digest ? (
                    <a className="smart-link" href={toSuiScanTxUrl(data.tx_digest)} target="_blank" rel="noreferrer">
                      {shortenHash(data.tx_digest)}
                    </a>
                  ) : (
                    "-"
                  )}
                </p>
                <p className="muted">On-chain attestation record.</p>
              </article>
            </div>

            <div className="panel">
              <p className="eyebrow">PROOF PAYLOAD</p>
              <div className="verify-detail-grid">
                <div className="verify-detail-row">
                  <span className="field-label">Blob ID</span>
                  <p className="mono field-value">{data.quilt_id ? shortenHash(data.quilt_id, 14, 10) : "-"}</p>
                </div>
                <div className="verify-detail-row">
                  <span className="field-label">Payload Hash</span>
                  <p className="mono field-value">{data.blob_hash ? shortenHash(data.blob_hash, 14, 10) : "-"}</p>
                </div>
                <div className="verify-detail-row">
                  <span className="field-label">On-chain Hash</span>
                  <p className="mono field-value">{data.onchain_hash ? shortenHash(data.onchain_hash, 14, 10) : "-"}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
