# Cloud Backend Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the current monolithic FastAPI backend into a cloud management service (`cloud_app.py`) and a local execution engine (`local_app.py`), add startup script sync, and wire up the frontend to use each service for its respective domain.

**Architecture:** Cloud service stores scripts and metadata; local service runs scripts via Playwright and streams logs via WebSocket. Frontend reads `cloud_url` from settings then uses `cloudApi.js` for management and `localApi.js` (fixed `localhost:8001`) for execution. Sync happens on demand via `POST /api/sync` on the local service.

**Tech Stack:** Python FastAPI, uvicorn, React 19, Vite 6, Electron 33

---

## Task 1: Add `cloud_url` to settings

**Files:**
- Modify: `backend/settings.py`

**Step 1: Add `cloud_url` to DEFAULT_SETTINGS**

In `backend/settings.py`, add `"cloud_url": "http://localhost:8000"` at the top level of `DEFAULT_SETTINGS`:

```python
DEFAULT_SETTINGS = {
    "ai": { ... },          # unchanged
    "editor": { ... },      # unchanged
    "scripts_dir": "./scripts",
    "theme": "dark",
    "cloud_url": "http://localhost:8000",   # ← add this line
}
```

**Step 2: Run existing settings tests**

```bash
pytest tests/test_settings.py -v
```
Expected: all PASS (no behavior change, just a new default key)

**Step 3: Commit**

```bash
git add backend/settings.py
git commit -m "feat(settings): add cloud_url default"
```

---

## Task 2: Create `backend/cloud_app.py`

**Files:**
- Create: `backend/cloud_app.py`
- Create: `tests/test_cloud_app.py`

**Step 1: Write the failing tests first**

Create `tests/test_cloud_app.py`:

```python
# tests/test_cloud_app.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.cloud_app import app


@pytest.mark.asyncio
async def test_list_scripts_has_hash():
    """GET /api/scripts must return hash field on each script."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # hash field present on non-draft scripts
    for s in data:
        if not s.get("is_draft"):
            assert "hash" in s, f"Missing hash on script {s.get('name')}"


@pytest.mark.asyncio
async def test_script_content_returns_content():
    """GET /api/scripts/{name}/content on missing script returns 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts/nonexistent_xyz/content")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_no_run_endpoint():
    """cloud_app must NOT expose /api/scripts/{name}/run."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/anything/run")
    assert resp.status_code == 404
```

**Step 2: Run to confirm failure**

```bash
pytest tests/test_cloud_app.py -v
```
Expected: ImportError — `backend.cloud_app` does not exist yet.

**Step 3: Create `backend/cloud_app.py`**

```python
"""Cloud management service — script storage, metadata, folders.

Exposes: script CRUD, folder management, script file download.
Does NOT expose: run/stop, WebSocket, drafts, AI.
"""

import hashlib
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.scanner import scan_scripts
from backend.settings import load_settings, save_settings
from backend.scripts_data import (
    build_folder_groups,
    create_folder as _create_folder,
    rename_folder as _rename_folder,
    delete_folder as _delete_folder,
    move_script as _move_script,
    update_script_meta as _update_script_meta,
    get_script_meta,
)
from backend.drafts import read_script_content

SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _file_hash(path: str) -> str:
    """Return MD5 hex digest of file contents, or empty string if unreadable."""
    try:
        with open(path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
    except OSError:
        return ""


@app.get("/api/scripts")
async def list_scripts():
    scripts = scan_scripts(SCRIPTS_DIR)
    result = []
    for s in scripts:
        if not s.get("is_draft"):
            meta = get_script_meta(s["name"])
            result.append({
                **s,
                "tags": meta.get("tags", []),
                "description": meta.get("description", ""),
                "folder": meta.get("folder"),
                "hash": _file_hash(s["path"]),
            })
    return result


@app.get("/api/folders")
async def list_folders():
    scripts = scan_scripts(SCRIPTS_DIR)
    return build_folder_groups(scripts)


@app.post("/api/folders")
async def create_folder(body: dict):
    name = body.get("name", "").strip()
    if not name:
        return JSONResponse(status_code=400, content={"error": "Folder name required"})
    folder = _create_folder(name, body.get("icon", "📁"))
    if folder is None:
        return JSONResponse(status_code=409, content={"error": f"Folder '{name}' already exists"})
    return folder


@app.put("/api/folders/{name}")
async def rename_folder(name: str, body: dict):
    new_name = body.get("name", "").strip()
    if not new_name:
        return JSONResponse(status_code=400, content={"error": "New name required"})
    if _rename_folder(name, new_name):
        return {"message": "renamed"}
    return JSONResponse(status_code=404, content={"error": "Folder not found"})


@app.delete("/api/folders/{name}")
async def delete_folder(name: str):
    if _delete_folder(name):
        return {"message": "deleted"}
    return JSONResponse(status_code=404, content={"error": "Folder not found"})


@app.put("/api/scripts/{name}/folder")
async def move_script(name: str, body: dict):
    _move_script(name, body.get("folder"))
    return {"message": "moved"}


@app.put("/api/scripts/{name}/meta")
async def update_script_meta(name: str, body: dict):
    _update_script_meta(name, tags=body.get("tags"), description=body.get("description"))
    return {"message": "updated"}


@app.get("/api/scripts/{name}/content")
async def get_script_content(name: str):
    content = read_script_content(SCRIPTS_DIR, name)
    if content is None:
        return JSONResponse(status_code=404, content={"error": f"Script '{name}' not found"})
    return {"content": content}


@app.get("/api/settings")
async def get_settings():
    return load_settings()


@app.put("/api/settings")
async def update_settings(body: dict):
    return save_settings(body)
```

**Step 4: Run tests**

```bash
pytest tests/test_cloud_app.py -v
```
Expected: all 3 PASS

**Step 5: Commit**

```bash
git add backend/cloud_app.py tests/test_cloud_app.py
git commit -m "feat(backend): add cloud_app.py - script management service with hash"
```

---

## Task 3: Create `backend/local_app.py`

**Files:**
- Create: `backend/local_app.py`
- Create: `tests/test_local_app.py`

**Step 1: Write the failing tests**

Create `tests/test_local_app.py`:

```python
# tests/test_local_app.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.local_app import app


@pytest.mark.asyncio
async def test_run_nonexistent_script():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/nonexistent_xyz/run")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_stop_idle_script():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/somescript/stop")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_sync_offline_returns_cache():
    """POST /api/sync with unreachable cloud_url should return using_cache=true."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/sync", json={"cloud_url": "http://127.0.0.1:19999"})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("using_cache") is True


@pytest.mark.asyncio
async def test_no_folder_management():
    """local_app must NOT expose folder management endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/folders", json={"name": "test"})
    assert resp.status_code == 404
```

**Step 2: Run to confirm failure**

```bash
pytest tests/test_local_app.py -v
```
Expected: ImportError — `backend.local_app` does not exist yet.

**Step 3: Create `backend/local_app.py`**

```python
"""Local execution engine — runs scripts, streams logs, manages drafts and AI.

Exposes: run/stop, WebSocket, drafts, AI, sync, settings.
Does NOT expose: folder management, script CRUD, script metadata.
Port: 8001 (configured in electron/main.js and dev startup).
"""

import asyncio
import json
import os
import subprocess as sp

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from backend.scanner import scan_scripts
from backend.runner import ScriptRunner
from backend.settings import load_settings, save_settings
from backend.ai_chat import stream_chat
from backend.drafts import (
    read_script_content, read_draft, save_draft,
    delete_draft, publish_draft, get_draft_path,
)

SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")

runner = ScriptRunner()
connected_clients: list[WebSocket] = []

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def broadcast(message: dict):
    text = json.dumps(message, ensure_ascii=False)
    for ws in connected_clients[:]:
        try:
            await ws.send_text(text)
        except Exception:
            connected_clients.remove(ws)


# ── Sync ────────────────────────────────────────────────────────────────────

@app.post("/api/sync")
async def sync_scripts(body: dict = {}):
    """Download/update scripts from cloud backend into local scripts/ directory."""
    settings = load_settings()
    cloud_url = body.get("cloud_url") or settings.get("cloud_url", "http://localhost:8000")
    cloud_url = cloud_url.rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{cloud_url}/api/scripts")
            if resp.status_code != 200:
                return {"using_cache": True, "error": f"Cloud returned {resp.status_code}"}
            cloud_scripts = resp.json()
    except Exception as e:
        return {"using_cache": True, "error": str(e)}

    import hashlib

    def file_hash(path: str) -> str:
        try:
            with open(path, "rb") as f:
                return hashlib.md5(f.read()).hexdigest()
        except OSError:
            return ""

    synced = 0
    for s in cloud_scripts:
        if s.get("is_draft"):
            continue
        name = s["name"]
        cloud_hash = s.get("hash", "")
        local_path = os.path.join(SCRIPTS_DIR, f"{name}.py")
        local_hash = file_hash(local_path)

        if cloud_hash and cloud_hash == local_hash:
            continue  # up to date

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                cr = await client.get(f"{cloud_url}/api/scripts/{name}/content")
                if cr.status_code == 200:
                    content = cr.json().get("content", "")
                    os.makedirs(SCRIPTS_DIR, exist_ok=True)
                    with open(local_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    synced += 1
        except Exception:
            pass

    return {"using_cache": False, "synced": synced, "total": len(cloud_scripts)}


# ── Execution ────────────────────────────────────────────────────────────────

@app.get("/api/scripts")
async def list_scripts():
    """List locally available scripts (post-sync)."""
    return scan_scripts(SCRIPTS_DIR)


@app.post("/api/scripts/{name}/run")
async def run_script(name: str):
    scripts = scan_scripts(SCRIPTS_DIR)
    script = next((s for s in scripts if s["name"] == name), None)
    if not script:
        return JSONResponse(status_code=404, content={"error": f"Script '{name}' not found"})
    if runner.get_status(script["path"]) == "running":
        return JSONResponse(status_code=409, content={"error": f"Script '{name}' is already running"})

    async def on_log(line: str):
        await broadcast({"type": "log", "script": name, "data": line})

    async def run_and_notify():
        await broadcast({"type": "status", "script": name, "data": "running"})
        await runner.run(script["path"], on_log=on_log)
        status = runner.get_status(script["path"])
        await broadcast({"type": "status", "script": name, "data": status})

    asyncio.create_task(run_and_notify())
    return {"message": f"Script '{name}' started"}


@app.post("/api/scripts/{name}/stop")
async def stop_script(name: str):
    scripts = scan_scripts(SCRIPTS_DIR)
    script = next((s for s in scripts if s["name"] == name), None)
    if script and runner.stop(script["path"]):
        return {"message": f"Script '{name}' stopped"}
    return JSONResponse(status_code=400, content={"error": f"Script '{name}' is not running"})


# ── Settings ─────────────────────────────────────────────────────────────────

@app.get("/api/settings")
async def get_settings():
    return load_settings()


@app.put("/api/settings")
async def update_settings(body: dict):
    return save_settings(body)


# ── Drafts ───────────────────────────────────────────────────────────────────

@app.get("/api/scripts/{name}/content")
async def get_script_content(name: str):
    content = read_script_content(SCRIPTS_DIR, name)
    if content is None:
        return JSONResponse(status_code=404, content={"error": f"Script '{name}' not found"})
    return {"content": content}


@app.get("/api/scripts/{name}/draft")
async def get_draft(name: str):
    content = read_draft(SCRIPTS_DIR, name)
    if content is None:
        return JSONResponse(status_code=404, content={"error": "No draft found"})
    return {"content": content}


@app.put("/api/scripts/{name}/draft")
async def save_draft_endpoint(name: str, body: dict):
    save_draft(SCRIPTS_DIR, name, body["content"])
    return {"message": "Draft saved"}


@app.delete("/api/scripts/{name}/draft")
async def delete_draft_endpoint(name: str):
    if delete_draft(SCRIPTS_DIR, name):
        return {"message": "Draft deleted"}
    return JSONResponse(status_code=404, content={"error": "No draft found"})


@app.post("/api/scripts/{name}/draft/publish")
async def publish_draft_endpoint(name: str):
    if publish_draft(SCRIPTS_DIR, name):
        return {"message": f"Draft published for '{name}'"}
    return JSONResponse(status_code=404, content={"error": "No draft to publish"})


@app.post("/api/scripts/{name}/draft/run")
async def run_draft(name: str):
    draft_content = read_draft(SCRIPTS_DIR, name)
    if draft_content is None:
        return JSONResponse(status_code=404, content={"error": "No draft found"})
    draft_path = get_draft_path(SCRIPTS_DIR, name)
    if runner.get_status(draft_path) == "running":
        return JSONResponse(status_code=409, content={"error": "Draft is already running"})

    async def on_log(line: str):
        await broadcast({"type": "log", "script": name, "source": "draft", "data": line})

    async def run_and_notify():
        await broadcast({"type": "status", "script": name, "source": "draft", "data": "running"})
        await runner.run(draft_path, on_log=on_log)
        status = runner.get_status(draft_path)
        await broadcast({"type": "status", "script": name, "source": "draft", "data": status})

    asyncio.create_task(run_and_notify())
    return {"message": f"Draft '{name}' started"}


@app.post("/api/scripts/{name}/draft/stop")
async def stop_draft(name: str):
    draft_path = get_draft_path(SCRIPTS_DIR, name)
    if runner.stop(draft_path):
        return {"message": f"Draft '{name}' stopped"}
    return JSONResponse(status_code=400, content={"error": "Draft is not running"})


@app.post("/api/scripts/{name}/open-external")
async def open_external(name: str):
    script_path = os.path.join(SCRIPTS_DIR, f"{name}.py")
    if not os.path.isfile(script_path):
        return JSONResponse(status_code=404, content={"error": f"Script '{name}' not found"})
    try:
        os.startfile(script_path)
    except AttributeError:
        sp.Popen(["xdg-open", script_path])
    return {"message": f"Opened '{name}' in external editor"}


# ── AI ───────────────────────────────────────────────────────────────────────

@app.post("/api/ai/test")
async def ai_test(body: dict):
    import httpx as _httpx
    provider = body.get("provider", "openai")
    api_url = body.get("api_url", "")
    api_key = body.get("api_key", "")
    model = body.get("model", "")
    if not api_key:
        return JSONResponse(status_code=400, content={"error": "API Key 未填写"})
    if not api_url:
        return JSONResponse(status_code=400, content={"error": "API 地址未填写"})
    try:
        async with _httpx.AsyncClient(timeout=15.0) as client:
            if provider == "anthropic":
                res = await client.post(
                    f"{api_url}/messages",
                    headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                    json={"model": model or "claude-sonnet-4-20250514", "max_tokens": 10, "messages": [{"role": "user", "content": "Hi"}]},
                )
            else:
                res = await client.post(
                    f"{api_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model or "gpt-4o", "max_tokens": 10, "messages": [{"role": "user", "content": "Hi"}]},
                )
            if res.status_code == 401:
                return JSONResponse(status_code=400, content={"error": "API Key 无效 (401)"})
            if res.status_code >= 400:
                return JSONResponse(status_code=400, content={"error": f"请求失败 ({res.status_code})"})
            return {"message": "连接成功"}
    except _httpx.ConnectError:
        return JSONResponse(status_code=400, content={"error": "无法连接到 API 服务器"})
    except _httpx.TimeoutException:
        return JSONResponse(status_code=400, content={"error": "连接超时"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": f"连接失败: {str(e)}"})


@app.post("/api/ai/chat")
async def ai_chat(body: dict):
    settings = load_settings()
    api_key = settings.get("ai", {}).get("api_key", "")
    if not api_key:
        return JSONResponse(status_code=400, content={"error": "AI API key not configured"})
    code = body.get("code", "")
    message = body.get("message", "")
    history = body.get("history", [])
    return EventSourceResponse(stream_chat(code, message, history))


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(ws)
```

**Step 4: Run tests**

```bash
pytest tests/test_local_app.py -v
```
Expected: all 4 PASS

**Step 5: Commit**

```bash
git add backend/local_app.py tests/test_local_app.py
git commit -m "feat(backend): add local_app.py - execution engine with sync endpoint"
```

---

## Task 4: Create `frontend/src/cloudApi.js`

**Files:**
- Create: `frontend/src/cloudApi.js`

The `cloud_url` is read from settings (served by local service). We expose `setCloudUrl()` so `App.jsx` can configure it after fetching settings.

**Step 1: Create `frontend/src/cloudApi.js`**

```javascript
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
```

**Step 2: Commit**

```bash
git add frontend/src/cloudApi.js
git commit -m "feat(frontend): add cloudApi.js for cloud backend communication"
```

---

## Task 5: Create `frontend/src/localApi.js`

**Files:**
- Create: `frontend/src/localApi.js`

**Step 1: Create `frontend/src/localApi.js`**

```javascript
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
```

**Step 2: Commit**

```bash
git add frontend/src/localApi.js
git commit -m "feat(frontend): add localApi.js for local execution engine"
```

---

## Task 6: Update `frontend/src/api.js` to re-export from split modules

**Files:**
- Modify: `frontend/src/api.js`

Replace the entire contents with re-exports so existing imports in `App.jsx` and other components continue working without changes during the transition:

```javascript
// frontend/src/api.js
// Shim: re-exports from cloudApi and localApi.
// Management functions → cloudApi, execution/drafts/AI/settings → localApi.

export {
  fetchScripts,
  fetchFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveScriptToFolder,
  updateScriptMeta,
  setCloudUrl,
  getCloudUrl,
} from "./cloudApi";

export {
  syncScripts,
  runScript,
  stopScript,
  fetchScriptContent,
  fetchDraft,
  saveDraft,
  deleteDraft,
  publishDraft,
  runDraft,
  stopDraft,
  openExternal,
  fetchSettings,
  updateSettings,
  testAIConnection,
  streamAIChat,
} from "./localApi";
```

**Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "refactor(frontend): api.js re-exports from cloudApi and localApi"
```

---

## Task 7: Update `frontend/src/hooks/useWebSocket.js`

**Files:**
- Modify: `frontend/src/hooks/useWebSocket.js`

**Step 1: Change the WS URL**

Find line 3:
```javascript
const WS_URL = "ws://localhost:8000/ws";
```
Change to:
```javascript
const WS_URL = "ws://localhost:8001/ws";
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/useWebSocket.js
git commit -m "fix(frontend): point WebSocket to local execution engine port 8001"
```

---

## Task 8: Add cloud URL init + startup sync to `App.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add sync state and startup logic**

In `App.jsx`, after the existing imports, add `syncScripts` and `setCloudUrl` to the import from `./api`:

```javascript
// Change existing import from:
import {
  fetchFolders,
  fetchScripts,
  runScript, stopScript,
  fetchSettings, updateSettings,
  createFolder, renameFolder, deleteFolder,
  moveScriptToFolder, updateScriptMeta,
} from "./api";

// To:
import {
  fetchFolders,
  fetchScripts,
  runScript, stopScript,
  fetchSettings, updateSettings,
  createFolder, renameFolder, deleteFolder,
  moveScriptToFolder, updateScriptMeta,
  syncScripts,
  setCloudUrl,
} from "./api";
```

**Step 2: Add syncStatus state** (add with other state declarations near the top of the `App` component):

```javascript
// ── Sync ────────────────────────────────────────────────────────────────────
const [syncStatus, setSyncStatus] = useState("idle"); // "idle"|"syncing"|"ok"|"offline"
const [syncMessage, setSyncMessage] = useState("");
```

**Step 3: Update the settings useEffect** to init cloud URL and trigger sync.

Find the existing settings `useEffect` (around line 76-80):
```javascript
useEffect(() => {
  fetchSettings().then((data) => {
    if (data?.theme) setTheme(data.theme);
  }).catch(() => {});
}, []);
```

Replace it with:
```javascript
useEffect(() => {
  fetchSettings().then(async (data) => {
    if (data?.theme) setTheme(data.theme);

    const cloudUrl = data?.cloud_url || "http://localhost:8000";
    setCloudUrl(cloudUrl);

    // Sync scripts from cloud at startup
    setSyncStatus("syncing");
    try {
      const result = await syncScripts(cloudUrl);
      if (result.using_cache) {
        setSyncStatus("offline");
        setSyncMessage("云端不可达，使用本地缓存");
      } else {
        setSyncStatus("ok");
        setSyncMessage(`已同步 ${result.synced}/${result.total} 个脚本`);
      }
    } catch {
      setSyncStatus("offline");
      setSyncMessage("同步失败，使用本地缓存");
    }

    // Reload script list after sync
    loadFolders();
  }).catch(() => {
    setSyncStatus("offline");
    setSyncMessage("本地服务不可达");
  });
}, []);
```

Note: `loadFolders` is the existing function in App.jsx that calls `fetchFolders()`. Check its name in `App.jsx` and use the correct name.

**Step 4: Pass syncStatus to StatusBar**

Find where `<StatusBar>` is rendered and add the two props:
```jsx
<StatusBar
  connected={connected}
  scripts={allScripts}
  statuses={statuses}
  onNavigate={setActivePage}
  syncStatus={syncStatus}
  syncMessage={syncMessage}
/>
```

**Step 5: Check that the app still loads (dev mode)**

```bash
npm run dev
```
Open browser, confirm no console errors on startup.

**Step 6: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): init cloud URL and sync scripts at startup"
```

---

## Task 9: Update `SettingsPanel.jsx` — add Cloud URL field

**Files:**
- Modify: `frontend/src/components/SettingsPanel.jsx`

**Step 1: Add cloud URL field**

Find the section in `SettingsPanel.jsx` where the settings form is rendered (look for the AI settings section or a wrapping form). Add a new "连接" or "云端" section with a cloud URL text input.

Locate the existing save/form state. The component uses `useSettings` context. Add local state for `cloudUrl`:

```javascript
const [cloudUrl, setCloudUrl] = useState(settings?.cloud_url || "http://localhost:8000");
```

Add to the JSX (before or after the AI section, in a new fieldset/section):

```jsx
<div className="sp-section">
  <h3 className="sp-section-title">云端服务</h3>
  <div className="sp-field">
    <label className="sp-label">云端后端地址</label>
    <input
      className="sp-input"
      type="text"
      value={cloudUrl}
      onChange={(e) => setCloudUrl(e.target.value)}
      placeholder="http://localhost:8000"
      spellCheck={false}
    />
    <p className="sp-hint">开发环境填 http://localhost:8000，生产填云服务器地址</p>
  </div>
</div>
```

Include `cloudUrl` in the save payload when the user clicks save. Find the existing `handleSave` function and add:
```javascript
cloud_url: cloudUrl,
```
to the settings object being saved.

Also sync local state when `settings` prop changes (add to existing `useEffect` that syncs form state from settings):
```javascript
setCloudUrl(settings?.cloud_url || "http://localhost:8000");
```

**Step 2: Commit**

```bash
git add frontend/src/components/SettingsPanel.jsx
git commit -m "feat(settings): add cloud URL configuration field"
```

---

## Task 10: Update `StatusBar.jsx` — show sync status

**Files:**
- Modify: `frontend/src/components/StatusBar.jsx`

**Step 1: Accept and display syncStatus**

Update the component signature to accept the new props:
```javascript
export default function StatusBar({ connected, scripts, statuses, onNavigate, syncStatus, syncMessage }) {
```

Add sync indicator in `statusbar-left` (after the existing connection dot):

```jsx
{syncStatus === "syncing" && (
  <>
    <span className="statusbar-separator" />
    <span className="statusbar-text statusbar-syncing">⟳ 同步中...</span>
  </>
)}
{syncStatus === "offline" && (
  <>
    <span className="statusbar-separator" />
    <span className="statusbar-text statusbar-offline" title={syncMessage}>本地缓存</span>
  </>
)}
{syncStatus === "ok" && syncMessage && (
  <>
    <span className="statusbar-separator" />
    <span className="statusbar-text statusbar-synced" title={syncMessage}>✓ 已同步</span>
  </>
)}
```

**Step 2: Add minimal CSS** to `frontend/src/components/StatusBar.css`:

```css
.statusbar-syncing { color: var(--accent, #6C5CE7); }
.statusbar-offline { color: #e17055; }
.statusbar-synced  { color: #00b894; }
```

**Step 3: Commit**

```bash
git add frontend/src/components/StatusBar.jsx frontend/src/components/StatusBar.css
git commit -m "feat(statusbar): show script sync status"
```

---

## Task 11: Update `electron/main.js` — spawn `local_app.py` on port 8001

**Files:**
- Modify: `electron/main.js`

**Step 1: Change the backend module and port**

In `electron/main.js`, find:
```javascript
const BACKEND_PORT = 8000;
```
Change to:
```javascript
const BACKEND_PORT = 8001;
```

Find in `startBackend()`:
```javascript
"-m", "uvicorn", "backend.app:app",
```
Change to:
```javascript
"-m", "uvicorn", "backend.local_app:app",
```

**Step 2: Commit**

```bash
git add electron/main.js
git commit -m "fix(electron): spawn local_app.py on port 8001 in production"
```

---

## Task 12: Update dev startup scripts

**Files:**
- Modify: `package.json` (or wherever `dev:backend` is defined)

**Step 1: Check current dev commands**

```bash
cat package.json | grep -A5 '"dev"'
```

The `dev:backend` command currently runs `backend.app:app`. Update it to show how to start **both** services in dev mode. Since in dev the cloud service runs on 8000 and local execution on 8001, update accordingly.

Look for the `dev:backend` script. Split it or add a new script:

```json
"dev:backend:cloud": "uvicorn backend.cloud_app:app --reload --port 8000",
"dev:backend:local": "uvicorn backend.local_app:app --reload --port 8001",
```

Update `dev` (concurrently) to start both backend services + frontend + electron:
```json
"dev": "concurrently \"npm run dev:backend:cloud\" \"npm run dev:backend:local\" \"npm run dev:frontend\" \"npm run dev:electron\""
```

**Step 2: Test dev startup**

```bash
npm run dev
```
Verify: both backends start, frontend loads, sync runs, scripts execute.

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore(dev): split backend into cloud (8000) and local (8001) dev scripts"
```

---

## Task 13: Run full test suite

```bash
pytest -v
```

Expected: all existing tests pass. If `tests/test_app.py` imports `backend.app` and `backend.app` still exists, that's fine — `app.py` remains untouched as reference. The new tests for `cloud_app` and `local_app` all pass.

---

## Verification Checklist

- [ ] `npm run dev` starts 4 processes: cloud backend (8000), local backend (8001), vite (5173), electron
- [ ] StatusBar shows "⟳ 同步中..." briefly then "✓ 已同步"
- [ ] Stopping cloud backend → StatusBar shows "本地缓存", scripts still runnable
- [ ] Settings panel has "云端后端地址" field, saving it persists to `settings.json`
- [ ] Running a script streams logs in LogPanel as before
- [ ] Playwright scripts work (browser opens locally)
- [ ] `pytest -v` all green
