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
