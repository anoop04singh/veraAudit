const DEFAULT_WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

export function shortenHash(value, head = 8, tail = 6) {
  if (!value || value.length <= head + tail + 3) return value ?? "";
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function toWalrusBlobUrl(blobId) {
  if (!blobId) return "#";
  return `${DEFAULT_WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}

export function toSuiVisionTxUrl(digest) {
  if (!digest) return "#";
  return `https://suivision.xyz/txblock/${digest}?network=testnet`;
}

export function toSuiVisionObjectUrl(objectId) {
  if (!objectId) return "#";
  return `https://suivision.xyz/object/${objectId}?network=testnet`;
}

export function toSuiScanTxUrl(digest) {
  if (!digest) return "#";
  return `https://suiscan.xyz/testnet/tx/${digest}`;
}

export function toSuiScanObjectUrl(objectId) {
  if (!objectId) return "#";
  return `https://suiscan.xyz/testnet/object/${objectId}`;
}
