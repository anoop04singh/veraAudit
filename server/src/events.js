export function normalizeAuditEvent(event) {
  const parsed = event?.parsedJson ?? {};
  return {
    contract_id: (parsed.contract_id ?? "").toLowerCase(),
    quilt_id: parsed.walrus_blob_id ?? "",
    walrus_blob_id: parsed.walrus_blob_id ?? "",
    audit_hash: parsed.audit_hash ?? "",
    severity: Number(parsed.severity ?? 0),
    auditor: parsed.auditor ?? "",
    epoch: Number(parsed.epoch ?? 0),
    tx_digest: event?.id?.txDigest ?? "",
    timestamp_ms: Number(event?.timestampMs ?? Date.now()),
    audited_at: new Date(Number(event?.timestampMs ?? Date.now())).toISOString(),
  };
}

export function severityLabel(level) {
  if (level === 4) return "critical";
  if (level === 3) return "high";
  if (level === 2) return "medium";
  if (level === 1) return "low";
  return "clean";
}
