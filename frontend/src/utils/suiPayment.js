import { Transaction } from "@mysten/sui/transactions";

export const AUDIT_PRICE_USD = 50;

const MIST_PER_SUI = 1_000_000_000;
const PAYMENT_RECIPIENT = import.meta.env.VITE_AUDIT_PAYMENT_RECIPIENT ?? "";
const PAYMENT_NETWORK = import.meta.env.VITE_AUDIT_PAYMENT_NETWORK ?? "mainnet";
const FALLBACK_SUI_USD = Number(import.meta.env.VITE_SUI_USD_FALLBACK ?? 3.5);
const FULLNODE_URLS = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
};

function normalizeSuiAddress(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

function getWallets() {
  const standardWallets = window.navigator?.wallets?.get?.() ?? [];
  const legacyWallet = window.suiWallet ? [{ name: "Sui Wallet", legacy: window.suiWallet }] : [];
  return [...standardWallets, ...legacyWallet].filter((wallet) => {
    if (wallet.legacy) return true;
    return Object.keys(wallet.features ?? {}).some((feature) => feature.startsWith("sui:"));
  });
}

function getConnectFeature(wallet) {
  return wallet.features?.["standard:connect"];
}

function getSignFeature(wallet) {
  return wallet.features?.["sui:signAndExecuteTransaction"] ?? wallet.features?.["sui:signAndExecuteTransactionBlock"];
}

export function findSuiWallets() {
  return getWallets().map((wallet) => ({
    name: wallet.name ?? "Sui Wallet",
    icon: wallet.icon,
    wallet,
  }));
}

export async function connectSuiWallet(wallet) {
  if (wallet.legacy) {
    const accounts = await wallet.legacy.requestPermissions?.();
    const address = wallet.legacy.getAccounts ? (await wallet.legacy.getAccounts())?.[0] : accounts?.[0];
    return { wallet, account: { address }, address };
  }

  const connect = getConnectFeature(wallet);
  if (!connect) throw new Error("Selected wallet does not expose a connect feature.");

  const result = await connect.connect({ silent: false });
  const account = result.accounts?.[0] ?? wallet.accounts?.[0];
  if (!account?.address) throw new Error("No Sui account was returned by the wallet.");
  return { wallet, account, address: account.address };
}

export async function fetchSuiUsdPrice() {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd");
    const json = await response.json();
    const price = Number(json?.sui?.usd);
    return Number.isFinite(price) && price > 0 ? price : FALLBACK_SUI_USD;
  } catch {
    return FALLBACK_SUI_USD;
  }
}

export function calculateSuiAmount(usdPrice) {
  const sui = AUDIT_PRICE_USD / usdPrice;
  const mist = Math.ceil(sui * MIST_PER_SUI);
  return { sui, mist };
}

export function getPaymentRecipient() {
  return normalizeSuiAddress(PAYMENT_RECIPIENT);
}

async function waitForTransactionDigest(digest) {
  const url = FULLNODE_URLS[PAYMENT_NETWORK] ?? FULLNODE_URLS.mainnet;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `vera-payment-${attempt}`,
        method: "sui_getTransactionBlock",
        params: [digest, { showEffects: true }],
      }),
    });
    const json = await response.json();
    if (json?.result?.digest) {
      const status = json.result.effects?.status?.status;
      if (status && status !== "success") throw new Error("Payment transaction did not execute successfully.");
      return json.result;
    }
    await new Promise((resolve) => setTimeout(resolve, 1250));
  }

  throw new Error("Payment transaction was submitted, but confirmation timed out.");
}

export async function payForAudit({ wallet, account, amountMist }) {
  const recipient = getPaymentRecipient();
  if (!recipient) {
    throw new Error("Payment recipient is not configured. Set VITE_AUDIT_PAYMENT_RECIPIENT.");
  }

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
  tx.transferObjects([coin], tx.pure.address(recipient));

  let result;
  if (wallet.legacy?.signAndExecuteTransactionBlock) {
    result = await wallet.legacy.signAndExecuteTransactionBlock({ transactionBlock: tx });
  } else {
    const sign = getSignFeature(wallet);
    if (!sign) throw new Error("Selected wallet cannot sign Sui transactions.");

    if (sign.signAndExecuteTransaction) {
      result = await sign.signAndExecuteTransaction({
        transaction: tx,
        account,
        chain: `sui:${PAYMENT_NETWORK}`,
        options: { showEffects: true },
      });
    } else {
      result = await sign.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        account,
        chain: `sui:${PAYMENT_NETWORK}`,
        options: { showEffects: true },
      });
    }
  }

  const digest = result?.digest;
  if (!digest) throw new Error("Wallet did not return a transaction digest.");

  await waitForTransactionDigest(digest);
  return { digest, recipient };
}
