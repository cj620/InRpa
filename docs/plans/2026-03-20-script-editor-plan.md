# Script Editor Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a script editor module with Monaco Editor, AI-assisted editing, draft/publish workflow, and draft hot-testing.

**Architecture:** New Sidebar page ("editor") hosts a three-zone layout: toolbar + Monaco Editor + collapsible right panel (AI chat / test logs). Backend adds draft CRUD endpoints, AI chat SSE proxy, settings persistence, and draft test runner. Drafts stored in `scripts/.drafts/`.

**Tech Stack:** Monaco Editor (`@monaco-editor/react`), FastAPI SSE (`sse-starlette`), `httpx` (AI API proxy), existing React + Vite + WebSocket stack.

---

### Task 1: Backend — Settings Persistence

**Files:**
- Create: `backend/settings.py`
- Create: `settings.json` (default config, gitignored)
- Modify: `backend/app.py:1-10` (add settings routes)
- Modify: `.gitignore` (add settings.json)
- Test: `tests/test_settings.py`

**Step 1: Write the failing tests**

Create `tests/test_settings.py`:

```python
# tests/test_settings.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app


@pytest.mark.asyncio
async def test_get_settings():
    """GET /api/settings should return settings dict."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "ai" in data
    assert "editor" in data


@pytest.mark.asyncio
async def test_update_settings():
    """PUT /api/settings should update and persist settings."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/settings", json={
            "ai": {
                "provider": "anthropic",
                "api_url": "https://api.anthropic.com/v1",
                "api_key": "sk-test",
                "model": "claude-sonnet-4-20250514"
            }
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ai"]["provider"] == "anthropic"
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_settings.py -v`
Expected: FAIL — no `/api/settings` route exists

**Step 3: Implement settings module**

Create `backend/settings.py`:

```python
"""Settings persistence — read/write settings.json."""

import json
import os

SETTINGS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "settings.json")

DEFAULT_SETTINGS = {
    "ai": {
        "provider": "openai",
        "api_url": "https://api.openai.com/v1",
        "api_key": "",
        "model": "gpt-4o"
    },
    "editor": {
        "font_size": 14,
        "tab_size": 4,
        "word_wrap": True
    },
    "scripts_dir": "./scripts"
}


def load_settings() -> dict:
    """Load settings from file, creating default if not exists."""
    if not os.path.exists(SETTINGS_PATH):
        save_settings(DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS.copy()
    with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_settings(settings: dict) -> dict:
    """Merge partial settings update and save to file."""
    current = DEFAULT_SETTINGS.copy()
    if os.path.exists(SETTINGS_PATH):
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            current = json.load(f)
    # Deep merge top-level keys
    for key, value in settings.items():
        if isinstance(value, dict) and isinstance(current.get(key), dict):
            current[key].update(value)
        else:
            current[key] = value
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2, ensure_ascii=False)
    return current
```

Add routes to `backend/app.py` — add these imports and endpoints:

```python
# Add import at top
from backend.settings import load_settings, save_settings

# Add these routes after existing ones
@app.get("/api/settings")
async def get_settings():
    """Return current settings."""
    return load_settings()


@app.put("/api/settings")
async def update_settings(body: dict):
    """Update settings (partial merge)."""
    return save_settings(body)
```

Add `settings.json` to `.gitignore`.

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_settings.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/settings.py tests/test_settings.py backend/app.py .gitignore
git commit -m "feat: add settings persistence with GET/PUT API"
```

---

### Task 2: Backend — Draft CRUD Endpoints

**Files:**
- Create: `backend/drafts.py`
- Modify: `backend/app.py` (add draft routes)
- Modify: `backend/scanner.py` (add `has_draft` field)
- Test: `tests/test_drafts.py`

**Step 1: Write the failing tests**

Create `tests/test_drafts.py`:

```python
# tests/test_drafts.py
import os
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app, SCRIPTS_DIR


@pytest.fixture(autouse=True)
def setup_test_script(tmp_path, monkeypatch):
    """Create a temp scripts dir with a test script."""
    scripts_dir = str(tmp_path / "scripts")
    os.makedirs(scripts_dir)
    with open(os.path.join(scripts_dir, "example.py"), "w") as f:
        f.write("print('hello')\n")
    monkeypatch.setattr("backend.app.SCRIPTS_DIR", scripts_dir)
    yield scripts_dir


@pytest.mark.asyncio
async def test_get_script_content(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts/example/content")
    assert resp.status_code == 200
    assert resp.json()["content"] == "print('hello')\n"


@pytest.mark.asyncio
async def test_save_and_get_draft(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/scripts/example/draft", json={"content": "print('draft')\n"})
        assert resp.status_code == 200

        resp = await client.get("/api/scripts/example/draft")
        assert resp.status_code == 200
        assert resp.json()["content"] == "print('draft')\n"


@pytest.mark.asyncio
async def test_get_draft_not_found(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts/example/draft")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_draft(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.put("/api/scripts/example/draft", json={"content": "x"})
        resp = await client.delete("/api/scripts/example/draft")
        assert resp.status_code == 200

        resp = await client.get("/api/scripts/example/draft")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_publish_draft(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.put("/api/scripts/example/draft", json={"content": "print('published')\n"})
        resp = await client.post("/api/scripts/example/draft/publish")
        assert resp.status_code == 200

        resp = await client.get("/api/scripts/example/content")
        assert resp.json()["content"] == "print('published')\n"

        resp = await client.get("/api/scripts/example/draft")
        assert resp.status_code == 404
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_drafts.py -v`
Expected: FAIL

**Step 3: Implement drafts module**

Create `backend/drafts.py`:

```python
"""Draft management — CRUD for script drafts in .drafts/ directory."""

import os
import shutil


def get_drafts_dir(scripts_dir: str) -> str:
    """Return path to .drafts/ directory, creating if needed."""
    drafts_dir = os.path.join(scripts_dir, ".drafts")
    os.makedirs(drafts_dir, exist_ok=True)
    return drafts_dir


def read_script_content(scripts_dir: str, name: str) -> str | None:
    """Read production script content. Returns None if not found."""
    path = os.path.join(scripts_dir, f"{name}.py")
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def read_draft(scripts_dir: str, name: str) -> str | None:
    """Read draft content. Returns None if no draft exists."""
    path = os.path.join(get_drafts_dir(scripts_dir), f"{name}.py")
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def save_draft(scripts_dir: str, name: str, content: str) -> None:
    """Save draft content."""
    path = os.path.join(get_drafts_dir(scripts_dir), f"{name}.py")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def delete_draft(scripts_dir: str, name: str) -> bool:
    """Delete draft. Returns True if existed and was deleted."""
    path = os.path.join(get_drafts_dir(scripts_dir), f"{name}.py")
    if os.path.isfile(path):
        os.remove(path)
        return True
    return False


def publish_draft(scripts_dir: str, name: str) -> bool:
    """Replace production script with draft, then delete draft. Returns True on success."""
    draft_path = os.path.join(get_drafts_dir(scripts_dir), f"{name}.py")
    prod_path = os.path.join(scripts_dir, f"{name}.py")
    if not os.path.isfile(draft_path):
        return False
    shutil.copy2(draft_path, prod_path)
    os.remove(draft_path)
    return True


def has_draft(scripts_dir: str, name: str) -> bool:
    """Check if a draft exists for the given script."""
    path = os.path.join(get_drafts_dir(scripts_dir), f"{name}.py")
    return os.path.isfile(path)
```

Add routes to `backend/app.py`:

```python
# Add import at top
from backend.drafts import (
    read_script_content, read_draft, save_draft,
    delete_draft, publish_draft,
)

# Add routes
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
```

Modify `backend/scanner.py` — add `has_draft` field to each script's metadata:

```python
# Add to scan_scripts function, after building the script dict:
from backend.drafts import has_draft as check_has_draft

# In the loop, add to the dict:
"has_draft": check_has_draft(directory, filename[:-3]),
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_drafts.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/drafts.py tests/test_drafts.py backend/app.py backend/scanner.py
git commit -m "feat: add draft CRUD endpoints and script content API"
```

---

### Task 3: Backend — Draft Test Runner

**Files:**
- Modify: `backend/app.py` (add draft run/stop routes)
- Test: `tests/test_drafts.py` (add run test)

**Step 1: Write the failing test**

Add to `tests/test_drafts.py`:

```python
@pytest.mark.asyncio
async def test_run_draft(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.put("/api/scripts/example/draft", json={"content": "print('testing draft')\n"})
        resp = await client.post("/api/scripts/example/draft/run")
        assert resp.status_code == 200
        assert "started" in resp.json()["message"]
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_drafts.py::test_run_draft -v`
Expected: FAIL

**Step 3: Implement draft run/stop routes**

Add to `backend/app.py`:

```python
@app.post("/api/scripts/{name}/draft/run")
async def run_draft(name: str):
    """Run the draft version of a script."""
    draft_content = read_draft(SCRIPTS_DIR, name)
    if draft_content is None:
        return JSONResponse(status_code=404, content={"error": "No draft found"})

    drafts_dir = os.path.join(SCRIPTS_DIR, ".drafts")
    draft_path = os.path.join(drafts_dir, f"{name}.py")

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
    """Stop a running draft test."""
    draft_path = os.path.join(SCRIPTS_DIR, ".drafts", f"{name}.py")
    if runner.stop(draft_path):
        return {"message": f"Draft '{name}' stopped"}
    return JSONResponse(status_code=400, content={"error": "Draft is not running"})
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_drafts.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app.py tests/test_drafts.py
git commit -m "feat: add draft test run/stop endpoints"
```

---

### Task 4: Backend — AI Chat SSE Endpoint

**Files:**
- Create: `backend/ai_chat.py`
- Modify: `backend/app.py` (add AI chat route)
- Modify: `requirements.txt` (add httpx, sse-starlette)
- Test: `tests/test_ai_chat.py`

**Step 1: Write the failing test**

Create `tests/test_ai_chat.py`:

```python
# tests/test_ai_chat.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app


@pytest.mark.asyncio
async def test_ai_chat_no_config():
    """POST /api/ai/chat should return 400 if AI not configured."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/ai/chat", json={
            "script_name": "test",
            "code": "print('hello')",
            "message": "add logging",
            "history": []
        })
    # Should return 400 when API key is empty
    assert resp.status_code == 400
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_ai_chat.py -v`
Expected: FAIL

**Step 3: Implement AI chat module**

Add `httpx` and `sse-starlette` to `requirements.txt`:

```
httpx==0.28.1
sse-starlette==2.2.1
```

Create `backend/ai_chat.py`:

```python
"""AI chat — proxy requests to configured LLM provider via SSE."""

import json
import httpx
from backend.settings import load_settings

SYSTEM_PROMPT = """你是一个 Python 脚本助手。用户会给你一段 Python 脚本代码和修改需求。

规则：
1. 仔细理解用户的修改需求
2. 返回修改后的完整代码（不是片段）
3. 用中文解释你做了什么修改
4. 代码放在 ```python ``` 代码块中

格式示例：
我已经做了以下修改：
- 修改点1
- 修改点2

```python
# 完整的修改后代码
```"""


def build_messages(code: str, message: str, history: list) -> list:
    """Build message list for LLM API."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add conversation history
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Add current message with code context
    user_content = f"当前脚本代码：\n```python\n{code}\n```\n\n用户需求：{message}"
    messages.append({"role": "user", "content": user_content})

    return messages


async def stream_chat(code: str, message: str, history: list):
    """Stream chat completion from configured AI provider. Yields SSE data strings."""
    settings = load_settings()
    ai_config = settings.get("ai", {})

    api_key = ai_config.get("api_key", "")
    if not api_key:
        raise ValueError("AI API key not configured")

    api_url = ai_config.get("api_url", "https://api.openai.com/v1")
    model = ai_config.get("model", "gpt-4o")
    provider = ai_config.get("provider", "openai")

    messages = build_messages(code, message, history)

    # Build request based on provider
    if provider == "anthropic":
        url = f"{api_url}/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": model,
            "max_tokens": 4096,
            "stream": True,
            "system": SYSTEM_PROMPT,
            "messages": [m for m in messages if m["role"] != "system"],
        }
    else:
        # OpenAI-compatible (including custom endpoints)
        url = f"{api_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "stream": True,
            "messages": messages,
        }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, json=body, headers=headers) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break

                try:
                    chunk = json.loads(data)
                    if provider == "anthropic":
                        if chunk.get("type") == "content_block_delta":
                            text = chunk.get("delta", {}).get("text", "")
                            if text:
                                yield json.dumps({"type": "text", "content": text}, ensure_ascii=False)
                    else:
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        text = delta.get("content", "")
                        if text:
                            yield json.dumps({"type": "text", "content": text}, ensure_ascii=False)
                except json.JSONDecodeError:
                    continue

    yield json.dumps({"type": "done"})
```

Add SSE route to `backend/app.py`:

```python
# Add imports
from sse_starlette.sse import EventSourceResponse
from backend.ai_chat import stream_chat

# Add route
@app.post("/api/ai/chat")
async def ai_chat(body: dict):
    """AI chat endpoint — streams response via SSE."""
    code = body.get("code", "")
    message = body.get("message", "")
    history = body.get("history", [])

    try:
        return EventSourceResponse(stream_chat(code, message, history))
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_ai_chat.py -v`
Expected: PASS (the no-config test should return 400)

**Step 5: Commit**

```bash
pip install httpx sse-starlette
git add backend/ai_chat.py tests/test_ai_chat.py backend/app.py requirements.txt
git commit -m "feat: add AI chat SSE endpoint with multi-provider support"
```

---

### Task 5: Backend — Open in External Editor

**Files:**
- Modify: `backend/app.py` (add open-external route)

**Step 1: Implement the endpoint**

Add to `backend/app.py`:

```python
import subprocess as sp

@app.post("/api/scripts/{name}/open-external")
async def open_external(name: str):
    """Open script in system default editor."""
    script_path = os.path.join(SCRIPTS_DIR, f"{name}.py")
    if not os.path.isfile(script_path):
        return JSONResponse(status_code=404, content={"error": f"Script '{name}' not found"})
    try:
        os.startfile(script_path)  # Windows
    except AttributeError:
        sp.Popen(["xdg-open", script_path])  # Linux
    return {"message": f"Opened '{name}' in external editor"}
```

**Step 2: Commit**

```bash
git add backend/app.py
git commit -m "feat: add open-in-external-editor endpoint"
```

---

### Task 6: Frontend — Install Monaco Editor & Add Vite Proxy

**Files:**
- Modify: `frontend/package.json` (add @monaco-editor/react)
- Modify: `frontend/vite.config.js` (add SSE proxy)

**Step 1: Install Monaco Editor**

Run: `cd frontend && npm install @monaco-editor/react`

**Step 2: Update Vite proxy config**

Add to `frontend/vite.config.js` proxy section:

```javascript
"/api/ai": {
    target: "http://localhost:8000",
    // SSE needs no buffering
    configure: (proxy) => {
        proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['cache-control'] = 'no-cache';
            proxyRes.headers['content-type'] = 'text/event-stream';
        });
    },
},
```

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js
git commit -m "chore: install Monaco Editor and configure SSE proxy"
```

---

### Task 7: Frontend — API Layer Extensions

**Files:**
- Modify: `frontend/src/api.js` (add new API functions)

**Step 1: Add all new API functions**

Append to `frontend/src/api.js`:

```javascript
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
```

**Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat: add editor, draft, AI, and settings API functions"
```

---

### Task 8: Frontend — Editor Hooks

**Files:**
- Create: `frontend/src/hooks/useEditor.js`
- Create: `frontend/src/hooks/useAIChat.js`
- Create: `frontend/src/hooks/useDraftRunner.js`

**Step 1: Create useEditor hook**

```javascript
// frontend/src/hooks/useEditor.js
import { useState, useCallback } from "react";
import { fetchScriptContent, fetchDraft, saveDraft as apiSaveDraft, deleteDraft, publishDraft as apiPublishDraft } from "../api";

export function useEditor() {
    const [selectedScript, setSelectedScript] = useState(null);
    const [originalCode, setOriginalCode] = useState("");
    const [draftCode, setDraftCode] = useState("");
    const [isDirty, setIsDirty] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);
    const [viewMode, setViewMode] = useState("edit"); // "edit" | "diff"
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [loading, setLoading] = useState(false);

    const loadScript = useCallback(async (name) => {
        setLoading(true);
        try {
            const { content: original } = await fetchScriptContent(name);
            setOriginalCode(original);

            const draft = await fetchDraft(name);
            if (draft) {
                setDraftCode(draft.content);
                setHasDraft(true);
            } else {
                setDraftCode(original);
                setHasDraft(false);
            }
            setSelectedScript(name);
            setIsDirty(false);
            setViewMode("edit");
        } catch (err) {
            console.error("Failed to load script:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateCode = useCallback((code) => {
        setDraftCode(code);
        setIsDirty(true);
    }, []);

    const saveDraftAction = useCallback(async () => {
        if (!selectedScript) return;
        setSaving(true);
        try {
            await apiSaveDraft(selectedScript, draftCode);
            setHasDraft(true);
            setIsDirty(false);
        } catch (err) {
            console.error("Failed to save draft:", err);
            throw err;
        } finally {
            setSaving(false);
        }
    }, [selectedScript, draftCode]);

    const publishAction = useCallback(async () => {
        if (!selectedScript) return;
        setPublishing(true);
        try {
            await apiPublishDraft(selectedScript);
            setOriginalCode(draftCode);
            setHasDraft(false);
            setIsDirty(false);
        } catch (err) {
            console.error("Failed to publish:", err);
            throw err;
        } finally {
            setPublishing(false);
        }
    }, [selectedScript, draftCode]);

    const discardDraft = useCallback(async () => {
        if (!selectedScript) return;
        try {
            await deleteDraft(selectedScript);
            setDraftCode(originalCode);
            setHasDraft(false);
            setIsDirty(false);
        } catch (err) {
            console.error("Failed to discard draft:", err);
        }
    }, [selectedScript, originalCode]);

    const toggleDiff = useCallback(() => {
        setViewMode((prev) => (prev === "edit" ? "diff" : "edit"));
    }, []);

    return {
        selectedScript, originalCode, draftCode, isDirty, hasDraft,
        viewMode, saving, publishing, loading,
        loadScript, updateCode, saveDraftAction, publishAction, discardDraft, toggleDiff,
    };
}
```

**Step 2: Create useAIChat hook**

```javascript
// frontend/src/hooks/useAIChat.js
import { useState, useCallback, useRef } from "react";
import { streamAIChat } from "../api";

export function useAIChat() {
    const [messages, setMessages] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState(null);
    const abortRef = useRef(null);

    const sendMessage = useCallback((code, userMessage) => {
        setError(null);
        const userMsg = { role: "user", content: userMessage };
        setMessages((prev) => [...prev, userMsg]);

        const assistantMsg = { role: "assistant", content: "" };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsStreaming(true);

        const history = [];
        // Build history from existing messages (excluding the latest assistant placeholder)
        setMessages((prev) => {
            const msgs = prev.slice(0, -1); // exclude placeholder
            for (const m of msgs) {
                if (m.role === "user" || m.role === "assistant") {
                    history.push({ role: m.role, content: m.content });
                }
            }
            return prev;
        });

        const abort = streamAIChat(
            { code, message: userMessage, history },
            (chunk) => {
                if (chunk.type === "text") {
                    setMessages((prev) => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        updated[updated.length - 1] = { ...last, content: last.content + chunk.content };
                        return updated;
                    });
                }
            },
            () => setIsStreaming(false),
            (err) => {
                setError(err.message);
                setIsStreaming(false);
            }
        );

        abortRef.current = abort;
    }, []);

    const clearChat = useCallback(() => {
        if (abortRef.current) abortRef.current();
        setMessages([]);
        setError(null);
        setIsStreaming(false);
    }, []);

    return { messages, isStreaming, error, sendMessage, clearChat };
}
```

**Step 3: Create useDraftRunner hook**

```javascript
// frontend/src/hooks/useDraftRunner.js
import { useState, useCallback, useEffect, useRef } from "react";
import { runDraft as apiRunDraft, stopDraft as apiStopDraft } from "../api";

export function useDraftRunner(scriptName, wsLogs, wsStatuses) {
    const [status, setStatus] = useState("idle");
    const [logs, setLogs] = useState([]);
    const prevScriptRef = useRef(scriptName);

    // Reset when script changes
    useEffect(() => {
        if (scriptName !== prevScriptRef.current) {
            setStatus("idle");
            setLogs([]);
            prevScriptRef.current = scriptName;
        }
    }, [scriptName]);

    // Listen for draft-specific WebSocket messages
    useEffect(() => {
        if (!scriptName) return;
        // wsLogs and wsStatuses are filtered by source=draft in useWebSocket
        const draftLogs = wsLogs[`draft:${scriptName}`];
        if (draftLogs) setLogs(draftLogs);
        const draftStatus = wsStatuses[`draft:${scriptName}`];
        if (draftStatus) setStatus(draftStatus);
    }, [scriptName, wsLogs, wsStatuses]);

    const runTest = useCallback(async () => {
        if (!scriptName) return;
        setLogs([]);
        setStatus("running");
        try {
            await apiRunDraft(scriptName);
        } catch (err) {
            console.error("Failed to run draft:", err);
            setStatus("failed");
        }
    }, [scriptName]);

    const stopTest = useCallback(async () => {
        if (!scriptName) return;
        try {
            await apiStopDraft(scriptName);
        } catch (err) {
            console.error("Failed to stop draft:", err);
        }
    }, [scriptName]);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    return { status, logs, runTest, stopTest, clearLogs };
}
```

**Step 4: Commit**

```bash
git add frontend/src/hooks/useEditor.js frontend/src/hooks/useAIChat.js frontend/src/hooks/useDraftRunner.js
git commit -m "feat: add useEditor, useAIChat, useDraftRunner hooks"
```

---

### Task 9: Frontend — WebSocket Draft Message Routing

**Files:**
- Modify: `frontend/src/hooks/useWebSocket.js` (handle `source: "draft"`)

**Step 1: Update useWebSocket to route draft messages**

Modify the `onmessage` handler in `frontend/src/hooks/useWebSocket.js` to key draft messages separately:

```javascript
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const key = msg.source === "draft" ? `draft:${msg.script}` : msg.script;

    if (msg.type === "log") {
        setLogs((prev) => ({
            ...prev,
            [key]: [...(prev[key] || []), msg.data],
        }));
    } else if (msg.type === "status") {
        setStatuses((prev) => ({
            ...prev,
            [key]: msg.data,
        }));
    }
};
```

This is backward-compatible — production messages have no `source` field so they key by `msg.script` as before. Draft messages key by `draft:{scriptName}`.

**Step 2: Commit**

```bash
git add frontend/src/hooks/useWebSocket.js
git commit -m "feat: route draft WebSocket messages with draft: prefix"
```

---

### Task 10: Frontend — Sidebar Editor Icon

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx` (add editor icon)

**Step 1: Add editor icon to Sidebar**

Add an "editor" icon (pencil/edit icon) to the `icons` object and a new button in `sidebar-top`, after the "files" button:

```javascript
// Add to icons object:
editor: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
),

// Add button in sidebar-top, after the files button:
<button
    className={`sidebar-btn ${activePage === "editor" ? "active" : ""}`}
    onClick={() => onPageChange("editor")}
    title="Editor"
>
    {icons.editor}
</button>
```

**Step 2: Commit**

```bash
git add frontend/src/components/Sidebar.jsx
git commit -m "feat: add Editor icon to Sidebar navigation"
```

---

### Task 11: Frontend — EditorPage Component (Shell)

**Files:**
- Create: `frontend/src/components/editor/EditorPage.jsx`
- Create: `frontend/src/components/editor/EditorPage.css`
- Create: `frontend/src/components/editor/EditorToolbar.jsx`
- Create: `frontend/src/components/editor/EditorActionBar.jsx`
- Create: `frontend/src/components/editor/EmptyState.jsx`
- Modify: `frontend/src/App.jsx` (add editor page route)

**Note:** This task creates the page shell with toolbar, action bar, and empty state. The Monaco Editor and side panel are added in subsequent tasks.

**Step 1: Create EditorPage shell**

Create `frontend/src/components/editor/EditorPage.jsx` — the main container that orchestrates all editor sub-components. It uses the `useEditor` hook for state, renders EditorToolbar at top, the editor area in the middle (EmptyState when no script selected, Monaco when selected — Monaco added in Task 12), and EditorActionBar at bottom.

Create `frontend/src/components/editor/EditorPage.css` — layout styles matching the design:
- `.editor-page` — full height flex column
- `.editor-content` — flex row for editor + side panel, `flex: 1`
- `.editor-main` — flex: 1, holds Monaco or EmptyState

Create `frontend/src/components/editor/EditorToolbar.jsx` — toolbar with ScriptSelector dropdown (searchable, shows scripts with draft indicators), StatusBadge (draft/modified/published), and action buttons (Diff toggle, Test Run, Panel toggle).

Create `frontend/src/components/editor/EditorActionBar.jsx` — bottom bar with Save Draft, Publish, Discard Draft, Open External buttons. Publish and Discard show confirmation dialogs.

Create `frontend/src/components/editor/EmptyState.jsx` — centered placeholder with edit icon and "Select a script to start editing" text.

Wire into `frontend/src/App.jsx`:
```javascript
import EditorPage from "./components/editor/EditorPage";
// In the JSX, add after the settings conditional:
{activePage === "editor" && (
    <EditorPage scripts={scripts} logs={logs} statuses={statuses} />
)}
```

**Step 2: Commit**

```bash
git add frontend/src/components/editor/ frontend/src/App.jsx
git commit -m "feat: add EditorPage shell with toolbar, action bar, empty state"
```

---

### Task 12: Frontend — Monaco Editor Integration

**Files:**
- Create: `frontend/src/components/editor/EditorMain.jsx`
- Create: `frontend/src/components/editor/EditorMain.css`
- Modify: `frontend/src/components/editor/EditorPage.jsx` (integrate EditorMain)

**Step 1: Create EditorMain component**

Create `frontend/src/components/editor/EditorMain.jsx`:
- Uses `@monaco-editor/react` — `Editor` for edit mode, `DiffEditor` for diff mode
- Monaco theme: define custom dark theme matching the app's color scheme (`#0A0C10` background, `#E4E6EF` foreground)
- Language: `python`
- Options: `fontSize` from settings, `minimap: { enabled: false }`, `scrollBeyondLastLine: false`, `fontFamily: "JetBrains Mono"`, `wordWrap` from settings
- `onChange` callback → calls `updateCode` from useEditor
- In diff mode: `original` = originalCode, `modified` = draftCode, read-only
- `Ctrl+S` keybinding via `editor.addCommand` → calls saveDraft

**Step 2: Commit**

```bash
git add frontend/src/components/editor/EditorMain.jsx frontend/src/components/editor/EditorMain.css frontend/src/components/editor/EditorPage.jsx
git commit -m "feat: integrate Monaco Editor with custom theme and diff view"
```

---

### Task 13: Frontend — AI Chat Side Panel

**Files:**
- Create: `frontend/src/components/editor/SidePanel.jsx`
- Create: `frontend/src/components/editor/SidePanel.css`
- Create: `frontend/src/components/editor/AIChatPanel.jsx`
- Create: `frontend/src/components/editor/AIChatPanel.css`
- Create: `frontend/src/components/editor/ChatMessage.jsx`
- Create: `frontend/src/components/editor/CodeDiffBlock.jsx`
- Create: `frontend/src/components/editor/ChatInput.jsx`
- Create: `frontend/src/components/editor/TestLogPanel.jsx`

**Step 1: Create SidePanel**

`SidePanel.jsx` — Collapsible right panel container:
- Props: `isOpen`, `onToggle`, `activeTab`, `onTabChange`
- Two tabs: "AI 助手" and "测试日志" with underline indicator animation
- Width transition: 300ms ease-out
- Resizable via drag handle (min 280px, max 50%)
- Renders `AIChatPanel` or `TestLogPanel` based on active tab

**Step 2: Create AIChatPanel**

`AIChatPanel.jsx` — AI chat interface:
- Scrollable message list using `ChatMessage` components
- User messages: right-aligned, dark background
- AI messages: left-aligned, lighter background
- Auto-scroll to bottom on new messages
- Shows error banner when AI not configured (links to settings)
- Loading state: three-dot bounce animation during streaming

`ChatMessage.jsx` — Individual message bubble:
- Parses AI message content for code blocks (```python...```)
- Renders code blocks as `CodeDiffBlock` components
- Regular text rendered with line breaks preserved

`CodeDiffBlock.jsx` — AI-suggested code changes:
- Syntax-highlighted code block
- Two buttons at bottom: "✓ 应用修改" (apply) and "✗ 忽略" (dismiss)
- On apply: calls `updateCode` with the new code content
- Applied state: shows "已应用" badge, buttons disabled

`ChatInput.jsx` — Message input:
- Textarea with auto-resize (max 120px height)
- Send button (accent color)
- `Enter` to send, `Shift+Enter` for newline
- Disabled during streaming
- Placeholder: "描述你的修改需求..."

**Step 3: Create TestLogPanel**

`TestLogPanel.jsx` — Draft test log viewer:
- Reuses LogPanel styling (terminal background, colored log levels)
- Shows draft runner status and logs
- Auto-scroll behavior

**Step 4: Commit**

```bash
git add frontend/src/components/editor/SidePanel.jsx frontend/src/components/editor/SidePanel.css frontend/src/components/editor/AIChatPanel.jsx frontend/src/components/editor/AIChatPanel.css frontend/src/components/editor/ChatMessage.jsx frontend/src/components/editor/CodeDiffBlock.jsx frontend/src/components/editor/ChatInput.jsx frontend/src/components/editor/TestLogPanel.jsx
git commit -m "feat: add AI chat panel and test log panel in side panel"
```

---

### Task 14: Frontend — Settings Panel Redesign

**Files:**
- Rewrite: `frontend/src/components/SettingsPanel.jsx`
- Rewrite: `frontend/src/components/SettingsPanel.css`

**Step 1: Redesign SettingsPanel**

Replace the hardcoded SettingsPanel with an interactive form:

Three card sections:
1. **AI 模型配置** — provider dropdown (OpenAI/Anthropic/Custom), API URL input, API Key input (masked + eye toggle), model input, "测试连接" button with status indicator
2. **编辑器设置** — font size number input, tab size number input, word wrap toggle switch
3. **通用设置** — scripts directory input (read-only display), backend port (read-only), version display

Behavior:
- Load settings from `GET /api/settings` on mount
- Provider dropdown change auto-fills default API URL
- Form changes show floating "保存" + "重置" buttons at bottom (slide-up animation)
- Save calls `PUT /api/settings` with changed fields only
- "测试连接" sends a lightweight request to validate API key
- Success/failure toast notification

**Step 2: Commit**

```bash
git add frontend/src/components/SettingsPanel.jsx frontend/src/components/SettingsPanel.css
git commit -m "feat: redesign SettingsPanel with interactive AI config form"
```

---

### Task 15: Frontend — Keyboard Shortcuts & Polish

**Files:**
- Modify: `frontend/src/components/editor/EditorPage.jsx` (add keyboard shortcuts)
- Create: `frontend/src/components/Toast.jsx` (toast notification)
- Create: `frontend/src/components/Toast.css`
- Create: `frontend/src/components/ConfirmDialog.jsx` (confirmation dialog)
- Create: `frontend/src/components/ConfirmDialog.css`

**Step 1: Add global keyboard shortcuts**

In `EditorPage.jsx`, add `useEffect` with `keydown` listener:
- `Ctrl+S` → save draft (prevent default)
- `Ctrl+Shift+A` → toggle AI panel
- `Ctrl+Shift+L` → toggle test log panel
- `Ctrl+D` → toggle diff view (prevent default)
- `Ctrl+Enter` → run draft test

**Step 2: Create Toast component**

Simple toast notification:
- Slides in from top, auto-dismisses after 3s
- Variants: success (green), error (red), info (blue)
- Usage: `showToast("Draft saved", "success")`

**Step 3: Create ConfirmDialog component**

Modal confirmation dialog:
- Semi-transparent backdrop
- Scale + opacity entrance animation
- Title, message body, and action buttons
- Used by: Publish (shows diff summary), Discard Draft
- Supports custom button labels and colors

**Step 4: Wire unsaved changes guard**

In EditorPage, when user selects a different script while `isDirty`:
- Show ConfirmDialog: "当前修改未保存" with three options
- "保存并切换" / "不保存切换" / "取消"

**Step 5: Commit**

```bash
git add frontend/src/components/editor/EditorPage.jsx frontend/src/components/Toast.jsx frontend/src/components/Toast.css frontend/src/components/ConfirmDialog.jsx frontend/src/components/ConfirmDialog.css
git commit -m "feat: add keyboard shortcuts, toast notifications, confirmation dialogs"
```

---

### Task 16: Integration Testing & Final Polish

**Files:**
- All editor components (CSS fine-tuning)
- Modify: `frontend/src/index.css` (add any new CSS variables needed)

**Step 1: Run all backend tests**

Run: `pytest -v`
Expected: All tests pass

**Step 2: Manual integration test checklist**

Run: `npm run dev`

Verify:
- [ ] Sidebar shows Editor icon, clicking it shows the editor page
- [ ] Empty state displays when no script selected
- [ ] Script selector dropdown shows all scripts with draft indicators
- [ ] Selecting a script loads code into Monaco Editor
- [ ] Editing code marks status as "已修改"
- [ ] Ctrl+S saves draft, status updates
- [ ] Diff view toggles correctly (original vs draft)
- [ ] AI chat sends messages and streams responses (requires AI config)
- [ ] "应用修改" in AI chat updates editor content
- [ ] Test run executes draft and shows logs in test panel
- [ ] Publish replaces production script, draft removed
- [ ] Discard draft reverts to production code
- [ ] Open External launches system editor
- [ ] Settings panel loads/saves AI configuration
- [ ] Keyboard shortcuts all work
- [ ] Unsaved changes guard works on script switch
- [ ] Panel resize drag works
- [ ] All animations smooth (panel open/close, toast, dialog)

**Step 3: Fix any visual issues found**

Adjust CSS for spacing, colors, transitions as needed.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete script editor module with AI chat, drafts, and hot testing"
```
