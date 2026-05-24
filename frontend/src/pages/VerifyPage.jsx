import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiJson } from "../utils/api.js";

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
        <p className="mono">{blobId}</p>
        {error && <p className="error-text">{error}</p>}

        {data && (
          <div className="panel">
            <p className={data.verified ? "ok-text" : "error-text"}>
              {data.verified ? "Verified: Walrus content matches on-chain hash." : "Verification failed."}
            </p>
            <p className="mono">Contract: {data.contract_id ?? "-"}</p>
            <p className="mono">On-chain tx: {data.tx_digest ?? "-"}</p>
            <p className="mono">Blob hash: {data.blob_hash ?? "-"}</p>
            <p className="mono">On-chain hash: {data.onchain_hash ?? "-"}</p>
          </div>
        )}
      </div>
    </section>
  );
}
