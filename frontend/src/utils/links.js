const DEFAULT_WALRUS_AGGREGATOR = "https://aggregator.walrus-mainnet.walrus.space";

export function shortenHash(value, head = 8, tail = 6) {
  if (!value || value.length <= head + tail + 3) return value ?? "";
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function toWalrusBlobUrl(blobId) {
  if (!blobId) return "#";
  return `${DEFAULT_WALRUS_AGGREGATOR}/v1/blobs/by-quilt-patch-id/${blobId}`;
}

export function toSuiVisionTxUrl(digest) {
  if (!digest) return "#";
  return `https://suivision.xyz/txblock/${digest}`;
}

export function toSuiVisionObjectUrl(objectId) {
  if (!objectId) return "#";
  return `https://suivision.xyz/object/${objectId}`;
}

export function toSuiScanTxUrl(digest) {
  if (!digest) return "#";
  return `https://suiscan.xyz/mainnet/tx/${digest}`;
}

export function toSuiScanObjectUrl(objectId) {
  if (!objectId) return "#";
  return `https://suiscan.xyz/mainnet/object/${objectId}`;
}
