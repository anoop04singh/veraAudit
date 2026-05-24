export async function apiJson(url, init) {
  const response = await fetch(url, init);
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? "Request failed");
  }
  return json;
}

export async function streamAudit(contractId, onEvent) {
  const response = await fetch("/api/audit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ contractId }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Unable to start audit stream.");
  }

  const reader = response.body.getReader();
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
