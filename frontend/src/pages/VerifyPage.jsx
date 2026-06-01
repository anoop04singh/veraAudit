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
    <section className="section">
      <div className="s-inner">
        <h1 className="s-h2">Blob Verification</h1>
        <p className="mono">
          <a className="smart-link" href={toWalrusBlobUrl(blobId)} target="_blank" rel="noreferrer">
            {blobId}
          </a>
        </p>
        {error && <p className="error-text">{error}</p>}

        {data && (
          <div className="panel">
            <p className={data.verified ? "ok-text" : "error-text"}>
              {data.verified ? "Verified: Walrus content matches on-chain hash." : "Verification failed."}
            </p>
            <p className="mono">
              Contract:{" "}
              {data.contract_id ? (
                <a className="smart-link" href={toSuiScanObjectUrl(data.contract_id)} target="_blank" rel="noreferrer">
                  {shortenHash(data.contract_id)}
                </a>
              ) : (
                "-"
              )}
            </p>
            <p className="mono">
              On-chain tx:{" "}
              {data.tx_digest ? (
                <a className="smart-link" href={toSuiScanTxUrl(data.tx_digest)} target="_blank" rel="noreferrer">
                  {shortenHash(data.tx_digest)}
                </a>
              ) : (
                "-"
              )}
            </p>
            <p className="mono">Blob hash: {data.blob_hash ? shortenHash(data.blob_hash, 14, 10) : "-"}</p>
            <p className="mono">On-chain hash: {data.onchain_hash ? shortenHash(data.onchain_hash, 14, 10) : "-"}</p>
          </div>
        )}
      </div>
    </section>
  );
}