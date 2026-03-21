// frontend/src/cloudApi.js
// Manages scripts, folders and metadata on the cloud backend.
// Call setCloudUrl(url) once after loading settings before using other exports.

let _baseUrl = "http://localhost:8000";

export function setCloudUrl(url) {
  _baseUrl = url.replace(/\/$/, "");
}

export function getCloudUrl() {
  return _baseUrl;
}

async function req(path, options = {}) {
  const res = await fetch(`${_baseUrl}${path}`, options);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchScripts() {
  return req("/api/scripts");
}

export async function fetchFolders() {
  return req("/api/folders");
}

export async function createFolder(name, icon = "📁") {
  return req("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, icon }),
  });
}

export async function renameFolder(name, newName) {
  return req(`/api/folders/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });
}

export async function deleteFolder(name) {
  return req(`/api/folders/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export async function moveScriptToFolder(scriptName, folderName) {
  return req(`/api/scripts/${encodeURIComponent(scriptName)}/folder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: folderName }),
  });
}

export async function updateScriptMeta(name, { tags, description } = {}) {
  const body = {};
  if (tags !== undefined) body.tags = tags;
  if (description !== undefined) body.description = description;
  return req(`/api/scripts/${encodeURIComponent(name)}/meta`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
