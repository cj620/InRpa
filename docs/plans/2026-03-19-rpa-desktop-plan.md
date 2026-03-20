# InRpa Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a desktop RPA manager that scans a `scripts/` directory for Python scripts, runs them via subprocess, and streams logs in real-time through a polished Electron + React + FastAPI application.

**Architecture:** Electron shell spawns a FastAPI backend as a child process. React frontend communicates with backend via HTTP REST API for commands and WebSocket for real-time log/status streaming. Scripts are executed as subprocesses managed by the backend.

**Tech Stack:** Electron, React + Vite, FastAPI, WebSocket, asyncio, Python subprocess

---

### Task 1: Project Scaffolding & Dependencies

**Files:**
- Create: `backend/__init__.py`
- Create: `backend/scanner.py` (empty placeholder)
- Create: `backend/runner.py` (empty placeholder)
- Create: `backend/app.py` (empty placeholder)
- Create: `scripts/` directory
- Create: `electron/main.js` (empty placeholder)
- Create: `electron/preload.js` (empty placeholder)
- Create: `package.json` (root)
- Modify: `requirements.txt`
- Modify: `.gitignore`

**Step 1: Create directory structure**

```bash
mkdir -p backend scripts electron
touch backend/__init__.py backend/scanner.py backend/runner.py backend/app.py
touch electron/main.js electron/preload.js
```

**Step 2: Update requirements.txt**

```
playwright==1.52.0
playwright-stealth==1.0.6
fastapi==0.115.0
uvicorn[standard]==0.34.0
websockets==14.2
```

**Step 3: Create root package.json**

```json
{
  "name": "rpa-mpv",
  "version": "1.0.0",
  "private": true,
  "main": "electron/main.js",
  "scripts": {
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "python -m uvicorn backend.app:app --reload --port 8000",
    "dev:electron": "electron .",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\" \"npm run dev:electron\""
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "concurrently": "^9.0.0"
  }
}
```

**Step 4: Update .gitignore**

```
__pycache__/
output/
*.png
*.pyc
node_modules/
dist/
frontend/dist/
.vite/
```

**Step 5: Install Python dependencies**

Run: `pip install fastapi==0.115.0 "uvicorn[standard]==0.34.0" websockets==14.2`
Expected: Successfully installed packages

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold project structure for RPA desktop manager"
```

---

### Task 2: Backend — Script Scanner

**Files:**
- Create: `backend/scanner.py`
- Create: `tests/test_scanner.py`

**Step 1: Write the failing test**

```python
# tests/test_scanner.py
import os
import tempfile
import pytest
from backend.scanner import scan_scripts


def test_scan_finds_py_files(tmp_path):
    """Scanner should find .py files in directory."""
    (tmp_path / "script_a.py").write_text("print('a')")
    (tmp_path / "script_b.py").write_text("print('b')")
    (tmp_path / "readme.txt").write_text("not a script")

    result = scan_scripts(str(tmp_path))

    assert len(result) == 2
    names = [s["name"] for s in result]
    assert "script_a" in names
    assert "script_b" in names


def test_scan_returns_metadata(tmp_path):
    """Each script entry should have name, path, size, modified_at."""
    (tmp_path / "demo.py").write_text("print('hello')")

    result = scan_scripts(str(tmp_path))

    assert len(result) == 1
    script = result[0]
    assert script["name"] == "demo"
    assert script["path"].endswith("demo.py")
    assert isinstance(script["size"], int)
    assert isinstance(script["modified_at"], str)


def test_scan_empty_dir(tmp_path):
    """Scanner should return empty list for empty directory."""
    result = scan_scripts(str(tmp_path))
    assert result == []


def test_scan_ignores_dunder_files(tmp_path):
    """Scanner should ignore __init__.py and similar."""
    (tmp_path / "__init__.py").write_text("")
    (tmp_path / "__pycache__").mkdir()
    (tmp_path / "real_script.py").write_text("print('hi')")

    result = scan_scripts(str(tmp_path))

    assert len(result) == 1
    assert result[0]["name"] == "real_script"
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_scanner.py -v`
Expected: FAIL with ImportError

**Step 3: Write minimal implementation**

```python
# backend/scanner.py
"""Scan scripts directory for available Python scripts."""

import os
from datetime import datetime


def scan_scripts(directory: str) -> list[dict]:
    """Scan directory for .py files and return metadata list."""
    scripts = []

    if not os.path.isdir(directory):
        return scripts

    for filename in sorted(os.listdir(directory)):
        if not filename.endswith(".py"):
            continue
        if filename.startswith("__"):
            continue

        filepath = os.path.join(directory, filename)
        if not os.path.isfile(filepath):
            continue

        stat = os.stat(filepath)
        scripts.append({
            "name": filename[:-3],  # remove .py
            "path": filepath,
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        })

    return scripts
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_scanner.py -v`
Expected: 4 passed

**Step 5: Commit**

```bash
git add backend/scanner.py tests/test_scanner.py
git commit -m "feat: add script directory scanner"
```

---

### Task 3: Backend — Script Runner

**Files:**
- Create: `backend/runner.py`
- Create: `tests/test_runner.py`
- Create: `tests/fixtures/mock_script_ok.py` (test helper)
- Create: `tests/fixtures/mock_script_fail.py` (test helper)

**Step 1: Create test fixture scripts**

```python
# tests/fixtures/mock_script_ok.py
import time
print("Starting task...")
time.sleep(0.5)
print("Task completed successfully.")
```

```python
# tests/fixtures/mock_script_fail.py
print("Starting...")
raise ValueError("Something went wrong")
```

**Step 2: Write the failing tests**

```python
# tests/test_runner.py
import asyncio
import os
import pytest
from backend.runner import ScriptRunner


@pytest.fixture
def runner():
    return ScriptRunner()


@pytest.fixture
def ok_script():
    return os.path.join(os.path.dirname(__file__), "fixtures", "mock_script_ok.py")


@pytest.fixture
def fail_script():
    return os.path.join(os.path.dirname(__file__), "fixtures", "mock_script_fail.py")


@pytest.mark.asyncio
async def test_run_script_success(runner, ok_script):
    """Runner should execute script and collect output."""
    logs = []
    await runner.run(ok_script, on_log=lambda line: logs.append(line))

    assert runner.get_status(ok_script) == "completed"
    log_text = "\n".join(logs)
    assert "Starting task..." in log_text
    assert "Task completed successfully." in log_text


@pytest.mark.asyncio
async def test_run_script_failure(runner, fail_script):
    """Runner should detect script failure."""
    logs = []
    await runner.run(fail_script, on_log=lambda line: logs.append(line))

    assert runner.get_status(fail_script) == "failed"


@pytest.mark.asyncio
async def test_get_status_idle(runner, ok_script):
    """Unrun script should have idle status."""
    assert runner.get_status(ok_script) == "idle"


@pytest.mark.asyncio
async def test_stop_running_script(runner, ok_script):
    """Runner should be able to stop a running script."""
    # Use a script that runs long enough to stop
    long_script = os.path.join(os.path.dirname(__file__), "fixtures", "mock_script_ok.py")

    task = asyncio.create_task(runner.run(long_script, on_log=lambda _: None))
    await asyncio.sleep(0.1)  # let it start

    stopped = runner.stop(long_script)
    assert stopped is True
    await task


@pytest.mark.asyncio
async def test_prevent_duplicate_run(runner, ok_script):
    """Should not allow running same script twice simultaneously."""
    task = asyncio.create_task(runner.run(ok_script, on_log=lambda _: None))
    await asyncio.sleep(0.05)

    with pytest.raises(RuntimeError, match="already running"):
        await runner.run(ok_script, on_log=lambda _: None)

    await task
```

**Step 3: Run test to verify it fails**

Run: `pip install pytest-asyncio && python -m pytest tests/test_runner.py -v`
Expected: FAIL with ImportError

**Step 4: Write minimal implementation**

```python
# backend/runner.py
"""Script runner — manages subprocess execution of Python scripts."""

import asyncio
import sys
from typing import Callable, Optional


class ScriptRunner:
    """Manages running Python scripts as subprocesses."""

    def __init__(self):
        self._statuses: dict[str, str] = {}
        self._processes: dict[str, asyncio.subprocess.Process] = {}

    def get_status(self, script_path: str) -> str:
        """Get current status of a script: idle, running, completed, failed."""
        return self._statuses.get(script_path, "idle")

    async def run(self, script_path: str, on_log: Callable[[str], None] = None):
        """Run a Python script as subprocess, streaming output via on_log callback."""
        if self._statuses.get(script_path) == "running":
            raise RuntimeError(f"Script is already running: {script_path}")

        self._statuses[script_path] = "running"

        try:
            process = await asyncio.create_subprocess_exec(
                sys.executable, script_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            self._processes[script_path] = process

            async for line in process.stdout:
                text = line.decode("utf-8", errors="replace").rstrip()
                if on_log:
                    on_log(text)

            await process.wait()

            if process.returncode == 0:
                self._statuses[script_path] = "completed"
            else:
                self._statuses[script_path] = "failed"

        except asyncio.CancelledError:
            self._statuses[script_path] = "failed"
        finally:
            self._processes.pop(script_path, None)

    def stop(self, script_path: str) -> bool:
        """Stop a running script. Returns True if stopped, False if not running."""
        process = self._processes.get(script_path)
        if process and process.returncode is None:
            process.terminate()
            return True
        return False
```

**Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_runner.py -v`
Expected: 5 passed

**Step 6: Commit**

```bash
git add backend/runner.py tests/test_runner.py tests/fixtures/
git commit -m "feat: add script runner with subprocess management"
```

---

### Task 4: Backend — FastAPI Application + WebSocket

**Files:**
- Create: `backend/app.py`
- Create: `tests/test_app.py`

**Step 1: Write the failing tests**

```python
# tests/test_app.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app


@pytest.mark.asyncio
async def test_list_scripts():
    """GET /api/scripts should return a list."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_run_nonexistent_script():
    """POST /api/scripts/nonexistent/run should return 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/nonexistent/run")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_stop_idle_script():
    """POST /api/scripts/somescript/stop should return 400 if not running."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/somescript/stop")

    assert resp.status_code == 400
```

**Step 2: Run test to verify it fails**

Run: `pip install httpx pytest-asyncio && python -m pytest tests/test_app.py -v`
Expected: FAIL with ImportError

**Step 3: Write minimal implementation**

```python
# backend/app.py
"""FastAPI application — REST API + WebSocket for RPA manager."""

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.scanner import scan_scripts
from backend.runner import ScriptRunner

SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")

runner = ScriptRunner()
connected_clients: list[WebSocket] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def broadcast(message: dict):
    """Send message to all connected WebSocket clients."""
    import json
    text = json.dumps(message, ensure_ascii=False)
    for ws in connected_clients[:]:
        try:
            await ws.send_text(text)
        except Exception:
            connected_clients.remove(ws)


@app.get("/api/scripts")
async def list_scripts():
    """Return list of available scripts."""
    return scan_scripts(SCRIPTS_DIR)


@app.post("/api/scripts/{name}/run")
async def run_script(name: str):
    """Start running a script by name."""
    scripts = scan_scripts(SCRIPTS_DIR)
    script = next((s for s in scripts if s["name"] == name), None)

    if not script:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"error": f"Script '{name}' not found"})

    if runner.get_status(script["path"]) == "running":
        from fastapi.responses import JSONResponse
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
    """Stop a running script by name."""
    scripts = scan_scripts(SCRIPTS_DIR)
    script = next((s for s in scripts if s["name"] == name), None)

    if script and runner.stop(script["path"]):
        return {"message": f"Script '{name}' stopped"}

    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=400, content={"error": f"Script '{name}' is not running"})


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket endpoint for real-time log and status streaming."""
    await ws.accept()
    connected_clients.append(ws)
    try:
        while True:
            await ws.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        connected_clients.remove(ws)
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_app.py -v`
Expected: 3 passed

**Step 5: Commit**

```bash
git add backend/app.py tests/test_app.py
git commit -m "feat: add FastAPI app with REST API and WebSocket"
```

---

### Task 5: Migrate Existing Scraper to Scripts Directory

**Files:**
- Move: `scraper.py` → `scripts/scraper.py`
- Move: `config.py` → `scripts/config.py`
- Modify: `scripts/scraper.py` (update import path)
- Delete: `main.py` (CLI entry point replaced by desktop app)

**Step 1: Move files**

```bash
mv scraper.py scripts/scraper.py
mv config.py scripts/config.py
```

**Step 2: Update import in scraper.py**

In `scripts/scraper.py`, the `import config` line should still work since Python resolves imports relative to the script's directory when run directly. No change needed.

**Step 3: Verify the scraper still runs standalone**

Run: `python scripts/scraper.py --help` (should fail since it has no argparse, but should import without error)
Run: `python -c "import sys; sys.path.insert(0, 'scripts'); import config; print(config.DEFAULT_KEYWORD)"`
Expected: `belt`

**Step 4: Remove main.py**

```bash
rm main.py
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate scraper and config to scripts directory"
```

---

### Task 6: Frontend — React + Vite Project Setup & Core Layers

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/api.js`
- Create: `frontend/src/hooks/useWebSocket.js`
- Create: `frontend/src/index.css`

**Step 1: Initialize frontend project**

```bash
cd frontend
npm init -y
npm install react react-dom
npm install -D vite @vitejs/plugin-react
```

**Step 2: Create vite.config.js**

```javascript
// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
```

**Step 3: Create index.html**

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RPA Manager</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Step 4: Create main.jsx entry point**

```jsx
// frontend/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 5: Create api.js**

```javascript
// frontend/src/api.js
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
```

**Step 6: Create useWebSocket hook**

```javascript
// frontend/src/hooks/useWebSocket.js
import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = "ws://localhost:8000/ws";

export function useWebSocket() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState({});       // { scriptName: [lines] }
  const [statuses, setStatuses] = useState({}); // { scriptName: status }

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000); // auto reconnect
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "log") {
        setLogs((prev) => ({
          ...prev,
          [msg.script]: [...(prev[msg.script] || []), msg.data],
        }));
      } else if (msg.type === "status") {
        setStatuses((prev) => ({
          ...prev,
          [msg.script]: msg.data,
        }));
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const clearLogs = useCallback((scriptName) => {
    setLogs((prev) => ({ ...prev, [scriptName]: [] }));
  }, []);

  return { connected, logs, statuses, clearLogs };
}
```

**Step 7: Create placeholder App.jsx**

```jsx
// frontend/src/App.jsx
import React from "react";

export default function App() {
  return <div className="app">RPA Manager — Loading...</div>;
}
```

**Step 8: Create index.css with base styles and design tokens**

```css
/* frontend/src/index.css */
:root {
  --bg-primary: #0F1117;
  --bg-card: #161822;
  --bg-hover: #1C1F2E;
  --bg-terminal: #0A0C10;

  --accent: #6C5CE7;
  --accent-light: #A29BFE;

  --status-success: #00D68F;
  --status-fail: #FF6B6B;
  --status-running: #FFC048;

  --text-primary: #E4E6EF;
  --text-secondary: #8F93A2;

  --border: rgba(255, 255, 255, 0.06);

  --font-ui: "Inter", -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "Consolas", monospace;

  --radius: 8px;
  --nav-width: 48px;
  --list-width: 260px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-ui);
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  -webkit-app-region: no-drag;
  user-select: none;
}

#root {
  width: 100vw;
  height: 100vh;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

**Step 9: Verify frontend starts**

Run: `cd frontend && npm run dev`
Expected: Vite dev server starts on http://localhost:5173

**Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: set up React frontend with Vite, API layer, and WebSocket hook"
```

---

### Task 7: Frontend — UI Components & Styling

**Files:**
- Create: `frontend/src/components/Sidebar.jsx`
- Create: `frontend/src/components/ScriptList.jsx`
- Create: `frontend/src/components/ScriptCard.jsx`
- Create: `frontend/src/components/LogPanel.jsx`
- Create: `frontend/src/components/TitleBar.jsx`
- Create: `frontend/src/components/StatusBar.jsx`
- Modify: `frontend/src/App.jsx`
- Create: `frontend/src/App.css`

**Step 1: Create TitleBar component**

Custom frameless window title bar:

```jsx
// frontend/src/components/TitleBar.jsx
import React from "react";
import "./TitleBar.css";

export default function TitleBar() {
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  return (
    <div className="titlebar">
      <div className="titlebar-title">RPA Manager</div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize}>
          <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="2" fill="currentColor"/></svg>
        </button>
        <button className="titlebar-btn" onClick={handleMaximize}>
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </button>
        <button className="titlebar-btn titlebar-btn-close" onClick={handleClose}>
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
      </div>
    </div>
  );
}
```

```css
/* frontend/src/components/TitleBar.css */
.titlebar {
  height: 36px;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  -webkit-app-region: drag;
  border-bottom: 1px solid var(--border);
}

.titlebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

.titlebar-controls {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.titlebar-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.titlebar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.titlebar-btn-close:hover {
  background: var(--status-fail);
  color: white;
}
```

**Step 2: Create Sidebar component**

```jsx
// frontend/src/components/Sidebar.jsx
import React from "react";
import "./Sidebar.css";

const icons = {
  scripts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  folder: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

export default function Sidebar({ activePage, onPageChange }) {
  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <button
          className={`sidebar-btn ${activePage === "scripts" ? "active" : ""}`}
          onClick={() => onPageChange("scripts")}
          title="Scripts"
        >
          {icons.scripts}
        </button>
        <button
          className={`sidebar-btn ${activePage === "files" ? "active" : ""}`}
          onClick={() => onPageChange("files")}
          title="Files"
        >
          {icons.folder}
        </button>
      </div>
      <div className="sidebar-bottom">
        <button
          className={`sidebar-btn ${activePage === "settings" ? "active" : ""}`}
          onClick={() => onPageChange("settings")}
          title="Settings"
        >
          {icons.settings}
        </button>
      </div>
    </div>
  );
}
```

```css
/* frontend/src/components/Sidebar.css */
.sidebar {
  width: var(--nav-width);
  background: var(--bg-primary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px 0;
}

.sidebar-top,
.sidebar-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.sidebar-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.sidebar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-btn.active {
  color: var(--accent-light);
}

.sidebar-btn.active::before {
  content: "";
  position: absolute;
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 20px;
  background: var(--accent);
  border-radius: 1px;
}
```

**Step 3: Create ScriptCard component**

```jsx
// frontend/src/components/ScriptCard.jsx
import React from "react";
import "./ScriptCard.css";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function ScriptCard({ script, status, selected, onClick }) {
  const statusClass = status || "idle";

  return (
    <div
      className={`script-card ${selected ? "selected" : ""} status-${statusClass}`}
      onClick={onClick}
    >
      <div className="script-card-indicator" />
      <div className="script-card-content">
        <div className="script-card-name">{script.name}</div>
        <div className="script-card-meta">
          <span className={`script-card-status status-${statusClass}`}>
            {statusClass}
          </span>
          <span className="script-card-size">{formatSize(script.size)}</span>
        </div>
      </div>
    </div>
  );
}
```

```css
/* frontend/src/components/ScriptCard.css */
.script-card {
  display: flex;
  align-items: stretch;
  background: var(--bg-card);
  border-radius: var(--radius);
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  overflow: hidden;
}

.script-card:hover {
  background: var(--bg-hover);
  transform: translateX(2px);
}

.script-card.selected {
  background: var(--bg-hover);
}

.script-card-indicator {
  width: 3px;
  flex-shrink: 0;
  background: var(--text-secondary);
  opacity: 0.3;
  transition: background 0.3s ease, opacity 0.3s ease;
}

.script-card.selected .script-card-indicator {
  background: var(--accent);
  opacity: 1;
}

.script-card.status-running .script-card-indicator {
  background: var(--status-running);
  opacity: 1;
  animation: breathe 1.5s ease-in-out infinite;
}

.script-card.status-completed .script-card-indicator {
  background: var(--status-success);
  opacity: 1;
}

.script-card.status-failed .script-card-indicator {
  background: var(--status-fail);
  opacity: 1;
}

@keyframes breathe {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.script-card-content {
  padding: 10px 12px;
  flex: 1;
  min-width: 0;
}

.script-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.script-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.script-card-status {
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.script-card-status.status-idle { color: var(--text-secondary); }
.script-card-status.status-running { color: var(--status-running); }
.script-card-status.status-completed { color: var(--status-success); }
.script-card-status.status-failed { color: var(--status-fail); }

.script-card-size {
  color: var(--text-secondary);
}
```

**Step 4: Create ScriptList component**

```jsx
// frontend/src/components/ScriptList.jsx
import React from "react";
import ScriptCard from "./ScriptCard";
import "./ScriptList.css";

export default function ScriptList({
  scripts,
  statuses,
  selectedScript,
  onSelect,
  onRefresh,
}) {
  const [search, setSearch] = React.useState("");

  const filtered = scripts.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="script-list">
      <div className="script-list-header">
        <input
          className="script-list-search"
          type="text"
          placeholder="Search scripts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="script-list-refresh" onClick={onRefresh} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
      <div className="script-list-items">
        {filtered.length === 0 ? (
          <div className="script-list-empty">No scripts found</div>
        ) : (
          filtered.map((script) => (
            <ScriptCard
              key={script.name}
              script={script}
              status={statuses[script.name]}
              selected={selectedScript === script.name}
              onClick={() => onSelect(script.name)}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

```css
/* frontend/src/components/ScriptList.css */
.script-list {
  width: var(--list-width);
  background: var(--bg-primary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.script-list-header {
  padding: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.script-list-search {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}

.script-list-search::placeholder {
  color: var(--text-secondary);
}

.script-list-search:focus {
  border-color: var(--accent);
}

.script-list-refresh {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.script-list-refresh:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.script-list-items {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}

.script-list-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}
```

**Step 5: Create LogPanel component**

```jsx
// frontend/src/components/LogPanel.jsx
import React, { useRef, useEffect, useState } from "react";
import "./LogPanel.css";

export default function LogPanel({ scriptName, logs, status, onRun, onStop, onClearLogs }) {
  const logEndRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const lines = logs || [];

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines.length, autoScroll]);

  if (!scriptName) {
    return (
      <div className="log-panel empty">
        <div className="log-panel-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
          </svg>
          <p>Select a script to view details</p>
        </div>
      </div>
    );
  }

  const isRunning = status === "running";

  return (
    <div className="log-panel">
      <div className="log-panel-header">
        <div className="log-panel-title">
          <span className="log-panel-filename">{scriptName}.py</span>
          {status && (
            <span className={`log-panel-status status-${status}`}>
              {status}
            </span>
          )}
        </div>
        <div className="log-panel-header-actions">
          <button
            className={`log-panel-scroll-btn ${autoScroll ? "active" : ""}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      <div className="log-panel-terminal">
        {lines.length === 0 ? (
          <div className="log-panel-no-logs">No output yet. Click Run to start.</div>
        ) : (
          lines.map((line, i) => {
            let level = "info";
            if (/warning|warn/i.test(line)) level = "warn";
            if (/error|fail|exception|traceback/i.test(line)) level = "error";

            return (
              <div key={i} className={`log-line log-${level}`}>
                <span className="log-line-text">{line}</span>
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>

      <div className="log-panel-actions">
        {isRunning ? (
          <button className="action-btn action-stop" onClick={onStop}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop
          </button>
        ) : (
          <button className="action-btn action-run" onClick={onRun}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run
          </button>
        )}
        <button className="action-btn action-clear" onClick={onClearLogs}>
          Clear
        </button>
      </div>
    </div>
  );
}
```

```css
/* frontend/src/components/LogPanel.css */
.log-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.log-panel.empty {
  align-items: center;
  justify-content: center;
}

.log-panel-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 13px;
}

.log-panel-header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.log-panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.log-panel-filename {
  font-size: 14px;
  font-weight: 600;
}

.log-panel-status {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 4px;
}

.log-panel-status.status-idle { color: var(--text-secondary); background: rgba(143,147,162,0.1); }
.log-panel-status.status-running { color: var(--status-running); background: rgba(255,192,72,0.1); }
.log-panel-status.status-completed { color: var(--status-success); background: rgba(0,214,143,0.1); }
.log-panel-status.status-failed { color: var(--status-fail); background: rgba(255,107,107,0.1); }

.log-panel-header-actions {
  display: flex;
  gap: 4px;
}

.log-panel-scroll-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.log-panel-scroll-btn:hover { background: var(--bg-hover); }
.log-panel-scroll-btn.active { color: var(--accent-light); }

.log-panel-terminal {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  background: var(--bg-terminal);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
}

.log-panel-no-logs {
  color: var(--text-secondary);
  font-style: italic;
}

.log-line {
  animation: fadeInUp 0.15s ease;
}

.log-line-text { white-space: pre-wrap; word-break: break-all; }

.log-info .log-line-text { color: var(--text-primary); }
.log-warn .log-line-text { color: var(--status-running); }
.log-error .log-line-text { color: var(--status-fail); }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.log-panel-actions {
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--border);
}

.action-btn {
  height: 34px;
  padding: 0 20px;
  border: none;
  border-radius: 6px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: transform 0.1s, box-shadow 0.15s;
}

.action-btn:active {
  transform: scale(0.97);
}

.action-run {
  background: linear-gradient(135deg, var(--accent), var(--accent-light));
  color: white;
}

.action-run:hover {
  box-shadow: 0 0 20px rgba(108, 92, 231, 0.4);
}

.action-stop {
  background: var(--status-fail);
  color: white;
}

.action-stop:hover {
  box-shadow: 0 0 20px rgba(255, 107, 107, 0.3);
}

.action-clear {
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.action-clear:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

**Step 6: Create StatusBar component**

```jsx
// frontend/src/components/StatusBar.jsx
import React from "react";
import "./StatusBar.css";

export default function StatusBar({ connected, scripts, statuses }) {
  const runningCount = Object.values(statuses).filter((s) => s === "running").length;

  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span className={`statusbar-dot ${connected ? "connected" : ""}`} />
        <span className="statusbar-text">
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
      <div className="statusbar-right">
        <span className="statusbar-text">
          {runningCount > 0 ? `${runningCount} running / ` : ""}
          {scripts.length} scripts
        </span>
      </div>
    </div>
  );
}
```

```css
/* frontend/src/components/StatusBar.css */
.statusbar {
  height: 28px;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 11px;
  color: var(--text-secondary);
}

.statusbar-left,
.statusbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.statusbar-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--status-fail);
  transition: background 0.3s;
}

.statusbar-dot.connected {
  background: var(--status-success);
}

.statusbar-text {
  color: var(--text-secondary);
}
```

**Step 7: Assemble App.jsx**

```jsx
// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from "react";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import ScriptList from "./components/ScriptList";
import LogPanel from "./components/LogPanel";
import StatusBar from "./components/StatusBar";
import { fetchScripts, runScript, stopScript } from "./api";
import { useWebSocket } from "./hooks/useWebSocket";
import "./App.css";

export default function App() {
  const [scripts, setScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [activePage, setActivePage] = useState("scripts");
  const { connected, logs, statuses, clearLogs } = useWebSocket();

  const loadScripts = useCallback(async () => {
    try {
      const data = await fetchScripts();
      setScripts(data);
    } catch (err) {
      console.error("Failed to fetch scripts:", err);
    }
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const handleRun = async () => {
    if (!selectedScript) return;
    try {
      clearLogs(selectedScript);
      await runScript(selectedScript);
    } catch (err) {
      console.error("Failed to run script:", err);
    }
  };

  const handleStop = async () => {
    if (!selectedScript) return;
    try {
      await stopScript(selectedScript);
    } catch (err) {
      console.error("Failed to stop script:", err);
    }
  };

  const handleClearLogs = () => {
    if (selectedScript) clearLogs(selectedScript);
  };

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar activePage={activePage} onPageChange={setActivePage} />
        <ScriptList
          scripts={scripts}
          statuses={statuses}
          selectedScript={selectedScript}
          onSelect={setSelectedScript}
          onRefresh={loadScripts}
        />
        <LogPanel
          scriptName={selectedScript}
          logs={selectedScript ? logs[selectedScript] : []}
          status={selectedScript ? statuses[selectedScript] : null}
          onRun={handleRun}
          onStop={handleStop}
          onClearLogs={handleClearLogs}
        />
      </div>
      <StatusBar
        connected={connected}
        scripts={scripts}
        statuses={statuses}
      />
    </div>
  );
}
```

```css
/* frontend/src/App.css */
.app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
```

**Step 8: Verify frontend builds**

Run: `cd frontend && npm run dev`
Expected: Vite compiles without errors, page renders at localhost:5173

**Step 9: Commit**

```bash
git add frontend/src/
git commit -m "feat: add all frontend UI components with dark theme styling"
```

---

### Task 8: Electron — Main Process & Preload

**Files:**
- Create: `electron/main.js`
- Create: `electron/preload.js`
- Modify: `package.json` (root — add electron dependency)

**Step 1: Create preload.js**

```javascript
// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
});
```

**Step 2: Create main.js**

```javascript
// electron/main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");

let mainWindow;
let backendProcess;

const BACKEND_PORT = 8000;
const isDev = !app.isPackaged;

function startBackend() {
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  backendProcess = spawn(pythonCmd, [
    "-m", "uvicorn", "backend.app:app",
    "--host", "127.0.0.1",
    "--port", String(BACKEND_PORT),
  ], {
    cwd: path.join(__dirname, ".."),
    stdio: ["pipe", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.on("error", (err) => {
    console.error("Failed to start backend:", err);
  });
}

function waitForPort(port, retries = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function tryConnect() {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.on("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.on("timeout", () => {
        socket.destroy();
        retry();
      });
      socket.on("error", () => {
        retry();
      });
      socket.connect(port, "127.0.0.1");
    }
    function retry() {
      attempts++;
      if (attempts >= retries) {
        reject(new Error(`Port ${port} not ready after ${retries} attempts`));
      } else {
        setTimeout(tryConnect, 500);
      }
    }
    tryConnect();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: "#0F1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
  }

  // Window control IPC handlers
  ipcMain.on("window-minimize", () => mainWindow.minimize());
  ipcMain.on("window-maximize", () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on("window-close", () => mainWindow.close());
}

app.whenReady().then(async () => {
  startBackend();
  try {
    await waitForPort(BACKEND_PORT);
    console.log("Backend is ready.");
  } catch (err) {
    console.error("Backend failed to start:", err);
  }
  await createWindow();
});

app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  app.quit();
});
```

**Step 3: Install root npm dependencies**

Run: `npm install` (installs electron + concurrently from root package.json)

**Step 4: Verify Electron starts**

First start backend and frontend separately:

Terminal 1: `python -m uvicorn backend.app:app --reload --port 8000`
Terminal 2: `cd frontend && npm run dev`
Terminal 3: `npx electron .`

Expected: Electron window opens showing the React UI with frameless window

**Step 5: Commit**

```bash
git add electron/ package.json
git commit -m "feat: add Electron shell with backend lifecycle management"
```

---

### Task 9: Integration — End-to-End Wiring & Smoke Test

**Files:**
- Modify: `backend/runner.py` (fix async callback for WebSocket)
- Possibly adjust `backend/app.py`

**Step 1: Fix runner.py on_log to support async callbacks**

The `runner.py` `on_log` callback is called synchronously but `app.py` needs to `await broadcast()`. Update runner to support async callbacks:

In `backend/runner.py`, change the log callback invocation:

```python
# In the run method, change:
#   if on_log:
#       on_log(text)
# To:
import inspect

if on_log:
    if inspect.iscoroutinefunction(on_log):
        await on_log(text)
    else:
        on_log(text)
```

**Step 2: Move scraper.py to scripts/**

```bash
cp scraper.py scripts/scraper.py
cp config.py scripts/config.py
```

Keep original files for backward compatibility until fully migrated.

**Step 3: Smoke test the full stack**

Terminal 1: `python -m uvicorn backend.app:app --reload --port 8000`
Terminal 2: `cd frontend && npm run dev`

Then open http://localhost:5173 in browser:
1. Script list should show `scraper` (and `config` — may want to add filtering later)
2. Click `scraper` card — right panel should show details
3. Click Run — logs should stream in real-time
4. Script completes — status should change to `completed`

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: integrate full stack — backend, frontend, and scripts"
```

---

### Task 10: Polish & Final Cleanup

**Files:**
- Possibly adjust various files for edge cases

**Step 1: Filter out config.py from scripts listing**

In `backend/scanner.py`, optionally ignore `config.py` or any non-runnable scripts. One approach: only list scripts that have a `if __name__` block or are explicitly marked.

Simple approach: ignore files named `config.py`:

```python
# In scanner.py, add after the __dunder__ check:
if filename == "config.py":
    continue
```

**Step 2: Test stop functionality**

Run a long-running script, click Stop, verify it terminates.

**Step 3: Verify WebSocket reconnection**

Stop and restart the backend, verify frontend reconnects automatically.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: polish integration and handle edge cases"
```
