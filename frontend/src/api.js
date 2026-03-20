const API_BASE = "http://localhost:8000";

export async function fetchScripts() {
  const res = await fetch(`${API_BASE}/api/scripts`);
  if (!res.ok) throw new Error(`Failed to fetch scripts: ${res.status}`);
  return res.json();
}

export async function runScript(name) {
  const res = await fetch(`${API_BASE}/api/scripts/${name}/run`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `Failed to run script: ${res.status}`);
  }
  return res.json();
}

export async function stopScript(name) {
  const res = await fetch(`${API_BASE}/api/scripts/${name}/stop`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `Failed to stop script: ${res.status}`);
  }
  return res.json();
}

export async function fetchScriptContent(name) {
    const res = await fetch(`${API_BASE}/api/scripts/${name}/content`);
    if (!res.ok) throw new Error(`Failed to fetch content: ${res.status}`);
    return res.json();
}

export async function fetchDraft(name) {
    const res = await fetch(`${API_BASE}/api/scripts/${name}/draft`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch draft: ${res.status}`);
    return res.json();
}

export async function saveDraft(name, content) {
    const res = await fetch(`${API_BASE}/api/scripts/${name}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(`Failed to save draft: ${res.status}`);
    return res.json();
}

export async function deleteDraft(name) {
    const res = await fetch(`${API_BASE}/api/scripts/${name}/draft`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete draft: ${res.status}`);
    return res.json();
}

export async function publishDraft(name) {
    const res = await fetch(`${API_BASE}/api/scripts/${name}/draft/publish`, { method: "POST" });
    if (!res.ok) throw new Error(`Failed to publish draft: ${res.status}`);
    return res.json();
}

export async function runDraft(name) {
    const res = await fetch(`${API_BASE}/api/scripts/${name}/draft/run`, { method: "POST" });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to run draft: ${res.status}`);
    }
    return res.json();
}

export async function stopDraft(name) {
    const res = await fetch(`${API_BASE}/api/scripts/${name}/draft/stop`, { method: "POST" });
    if (!res.ok) throw new Error(`Failed to stop draft: ${res.status}`);
    return res.json();
}

export async function openExternal(name) {
    const res = await fetch(`${API_BASE}/api/scripts/${name}/open-external`, { method: "POST" });
    if (!res.ok) throw new Error(`Failed to open external: ${res.status}`);
    return res.json();
}

export async function fetchSettings() {
    const res = await fetch(`${API_BASE}/api/settings`);
    if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
    return res.json();
}

export async function updateSettings(settings) {
    const res = await fetch(`${API_BASE}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`Failed to update settings: ${res.status}`);
    return res.json();
}

export function streamAIChat({ code, message, history }, onChunk, onDone, onError) {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, message, history }),
        signal: controller.signal,
    })
        .then(async (res) => {
            if (!res.ok) {
                const data = await res.json();
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
                            if (data.type === "done") {
                                onDone();
                            } else {
                                onChunk(data);
                            }
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
