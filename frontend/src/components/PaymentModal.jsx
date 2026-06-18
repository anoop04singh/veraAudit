import { useEffect, useMemo, useState } from "react";
import {
  AUDIT_PRICE_USD,
  calculateSuiAmount,
  connectSuiWallet,
  fetchSuiUsdPrice,
  findSuiWallets,
  getPaymentRecipient,
  payForAudit,
} from "../utils/suiPayment.js";
import { shortenHash, toSuiScanTxUrl } from "../utils/links.js";

function formatSui(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

export function PaymentModal({ open, contractId, onClose, onConfirmed }) {
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [account, setAccount] = useState(null);
  const [suiUsd, setSuiUsd] = useState(null);
  const [coupon, setCoupon] = useState("");
  const [digest, setDigest] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const payment = useMemo(() => {
    if (!suiUsd) return null;
    return calculateSuiAmount(suiUsd);
  }, [suiUsd]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setDigest("");
    setStatus("idle");
    setWallets(findSuiWallets());
    fetchSuiUsdPrice().then(setSuiUsd);
  }, [open]);

  if (!open) return null;

  async function handleConnect(wallet) {
    setError("");
    setStatus("connecting");
    try {
      const connection = await connectSuiWallet(wallet);
      setSelectedWallet(connection.wallet);
      setAccount(connection.account);
      setStatus("idle");
    } catch (err) {
      setStatus("idle");
      setError(err.message);
    }
  }

  async function handleCouponApply() {
    setError("");
    const trimmedCoupon = coupon.trim();
    if (!trimmedCoupon) {
      setError("Enter a coupon code.");
      return;
    }

    setStatus("confirmed");
    onConfirmed({ coupon: trimmedCoupon, bypassed: true });
  }

  async function handlePay() {
    if (!selectedWallet || !account || !payment) return;

    setError("");
    setStatus("paying");
    try {
      const result = await payForAudit({
        wallet: selectedWallet,
        account,
        amountMist: payment.mist,
      });
      setDigest(result.digest);
      setStatus("confirmed");
      onConfirmed({ ...result, payer: account.address, amountMist: payment.mist });
    } catch (err) {
      setStatus("idle");
      setError(err.message);
    }
  }

  const recipient = getPaymentRecipient();
  const canPay = Boolean(selectedWallet && account && payment && status !== "paying" && status !== "confirmed");

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <div className="payment-modal-head">
          <div>
            <p className="eyebrow">AUDIT PAYMENT</p>
            <h2 id="payment-title">Confirm audit request</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close payment dialog">
            x
          </button>
        </div>

        <div className="payment-price-panel">
          <div>
            <span className="payment-label mono">Audit price</span>
            <strong>${AUDIT_PRICE_USD} USD</strong>
          </div>
          <div>
            <span className="payment-label mono">SUI due</span>
            <strong>{payment ? `${formatSui(payment.sui)} SUI` : "..."}</strong>
          </div>
          <div>
            <span className="payment-label mono">Contract</span>
            <strong className="mono payment-address">{shortenHash(contractId, 8, 6)}</strong>
          </div>
        </div>

        <div className="payment-grid">
          <section className="payment-section">
            <p className="payment-section-title">Wallet</p>
            {wallets.length === 0 && (
              <p className="muted">No Sui wallet was detected. Install a Sui-compatible wallet and refresh this page.</p>
            )}
            <div className="wallet-list">
              {wallets.map(({ name, icon, wallet }) => (
                <button
                  className={`wallet-option ${selectedWallet === wallet ? "wallet-option--active" : ""}`}
                  type="button"
                  key={name}
                  onClick={() => handleConnect(wallet)}
                  disabled={status === "connecting" || status === "paying"}
                >
                  {icon && <img src={icon} alt="" />}
                  <span>{status === "connecting" ? "Connecting..." : name}</span>
                </button>
              ))}
            </div>
            {account?.address && <p className="mono subtle-text">Connected: {shortenHash(account.address, 10, 8)}</p>}
          </section>

          <section className="payment-section">
            <p className="payment-section-title">Coupon</p>
            <div className="coupon-row">
              <input
                value={coupon}
                onChange={(event) => setCoupon(event.target.value)}
                placeholder="Coupon code"
                aria-label="Coupon code"
                disabled={status === "paying"}
              />
              <button className="btn btn--ghost-technical" type="button" onClick={handleCouponApply} disabled={status === "paying"}>
                Apply
              </button>
            </div>
            <p className="subtle-text">Enter a test coupon to bypass payment in non-production checks.</p>
          </section>
        </div>

        {!recipient && (
          <div className="status-banner status-banner-error">
            <span className="status-chip status-chip-error">CONFIG</span>
            <span className="error-text">Set VITE_AUDIT_PAYMENT_RECIPIENT before accepting real SUI payments.</span>
          </div>
        )}

        {error && (
          <div className="status-banner status-banner-error">
            <span className="status-chip status-chip-error">ERROR</span>
            <span className="error-text">{error}</span>
          </div>
        )}

        {digest && (
          <div className="status-banner payment-confirmed">
            <span className="status-chip">PAID</span>
            <a className="smart-link mono" href={toSuiScanTxUrl(digest)} target="_blank" rel="noreferrer">
              {shortenHash(digest, 10, 8)}
            </a>
          </div>
        )}

        <div className="payment-actions">
          <button className="btn" type="button" onClick={onClose} disabled={status === "paying"}>
            Cancel
          </button>
          <button className="btn btn--primary" type="button" onClick={handlePay} disabled={!canPay || !recipient}>
            {status === "paying" ? "Confirming Payment..." : "Pay SUI & Run Audit"}
          </button>
        </div>
      </div>
    </div>
  );
}
