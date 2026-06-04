function normalizeApiBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const CLIENT_AUTH_HEADER = "x-veraaudit-client-key";
const clientKey = import.meta.env.VITE_API_CLIENT_KEY ?? "";

function toApiUrl(url) {
  return `${API_BASE_URL}${url}`;
}

function withApiHeaders(init = {}, extraHeaders = {}) {
  const headers = new Headers(init.headers ?? {});
  Object.entries(extraHeaders).forEach(([key, value]) => headers.set(key, value));
  if (clientKey) headers.set(CLIENT_AUTH_HEADER, clientKey);
  return {
    ...init,
    headers,
  };
}

export async function apiJson(url, init) {
  const response = await fetch(toApiUrl(url), withApiHeaders(init));
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? "Request failed");
  }
  return json;
}

export async function streamAudit(contractId, onEvent) {
  const request = withApiHeaders(
    {
      method: "POST",
      body: JSON.stringify({ contractId }),
    },
    {
      "content-type": "application/json",
    },
  );
  const streamResponse = await fetch(toApiUrl("/api/audit"), request);

  if (!streamResponse.ok || !streamResponse.body) {
    let message = "Unable to start audit stream.";
    try {
      const json = await streamResponse.json();
      message = json.error ?? message;
    } catch {}
    throw new Error(message);
  }

  const reader = streamResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";

    for (const message of messages) {
      const lines = message.split("\n");
      let event = "message";
      let data = "{}";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        }
        if (line.startsWith("data:")) {
          data = line.slice(5).trim();
        }
      }

      try {
        onEvent(event, JSON.parse(data));
      } catch {
        onEvent(event, { raw: data });
      }
    }
  }
}
