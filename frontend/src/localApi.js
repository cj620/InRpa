// frontend/src/localApi.js
// Communicates with the local execution engine on localhost:8001.

const LOCAL_BASE = "http://localhost:8001";

async function req(path, options = {}) {
  const res = await fetch(`${LOCAL_BASE}${path}`, options);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function syncScripts(cloudUrl) {
  return req("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cloud_url: cloudUrl }),
  });
}

export async function runScript(name) {
  return req(`/api/scripts/${name}/run`, { method: "POST" });
}

export async function stopScript(name) {
  return req(`/api/scripts/${name}/stop`, { method: "POST" });
}

export async function fetchScriptContent(name) {
  return req(`/api/scripts/${name}/content`);
}

export async function fetchDraft(name) {
  const res = await fetch(`${LOCAL_BASE}/api/scripts/${name}/draft`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch draft: ${res.status}`);
  return res.json();
}

export async function saveDraft(name, content) {
  return req(`/api/scripts/${name}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function deleteDraft(name) {
  return req(`/api/scripts/${name}/draft`, { method: "DELETE" });
}

export async function publishDraft(name) {
  return req(`/api/scripts/${name}/draft/publish`, { method: "POST" });
}

export async function runDraft(name) {
  return req(`/api/scripts/${name}/draft/run`, { method: "POST" });
}

export async function stopDraft(name) {
  return req(`/api/scripts/${name}/draft/stop`, { method: "POST" });
}

export async function openExternal(name) {
  return req(`/api/scripts/${name}/open-external`, { method: "POST" });
}

export async function fetchSettings() {
  return req("/api/settings");
}

export async function updateSettings(settings) {
  return req("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

export async function testAIConnection(aiConfig) {
  const res = await fetch(`${LOCAL_BASE}/api/ai/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(aiConfig),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "连接失败");
  return data;
}

export function streamAIChat({ code, message, history }, onChunk, onDone, onError) {
  const controller = new AbortController();
  fetch(`${LOCAL_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, message, history }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(new Error(data.error || `AI chat failed: ${res.status}`));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "done") onDone();
              else onChunk(data);
            } catch {}
          }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err);
    });
  return () => controller.abort();
}

export async function createScript(name, folder) {
  return req("/api/scripts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder }),
  });
}
