# CLAUDE.md

<!--
  This file is Claude Code-specific (claude.ai/code).
  For other AI agents, please refer to README.md for project documentation.
-->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InRpa — an Electron + React + FastAPI desktop app for managing and running Python automation scripts with real-time log streaming.

**Stack:** Electron 33 (frameless window) → React 19 + Vite 6 (frontend) → FastAPI + uvicorn (backend on :8000) → Python subprocesses (scripts)

## Commands

### Development (starts all 3 services concurrently)
```bash
npm run dev
```
Individual services:
- `npm run dev:frontend` — Vite dev server on :5173
- `npm run dev:backend` — uvicorn with --reload on :8000
- `npm run dev:electron` — Electron window (connects to running services)

### Install dependencies
```bash
pip install -r requirements.txt
npm install
cd frontend && npm install
```

### Build frontend for production
```bash
cd frontend && npm run build
```

### Tests
```bash
pytest                        # all tests
pytest tests/test_runner.py   # single file
pytest tests/test_app.py -k "test_list_scripts"  # single test
```
Test framework: pytest + pytest-asyncio + httpx. Tests live in `tests/` with fixtures in `tests/fixtures/`.

## Architecture

**Data flow:** User (Electron UI) → HTTP/WebSocket → FastAPI backend (localhost:8001 in production, localhost:8000 in dev) → subprocess.Popen → Python scripts in `/scripts`

### Dual Backend Ports

| Port | Purpose | Started by |
|------|---------|------------|
| `:8000` | Cloud/backend (dev only in this repo) | Manual (`npm run dev:backend`) |
| `:8001` | Local backend (production) | Electron (`electron/main.js`) |

- Frontend (`localApi.js`) talks to `:8001` for all local operations (scripts, drafts, settings)
- `cloud_url` in settings points to the remote cloud backend (`:8000` or a real server URL)

### Backend (`backend/`)
- `local_app.py` — FastAPI app spawned by Electron (port 8001). All local script execution runs here.
- `cloud_app.py` — FastAPI app for remote deployment (port 8000).
- `runner.py` — `ScriptRunner` class manages subprocesses via `subprocess.Popen` with threading for non-blocking stdout/stderr reading. Statuses: idle → running → completed/failed
- `scanner.py` — Scans `scripts/` for `.py` files, excludes `__*.py` and `config.py`

### Frontend (`frontend/src/`)
- `App.jsx` — Main component with page routing via React state (not a router)
- `api.js` — HTTP client for backend REST endpoints
- `hooks/useWebSocket.js` — WebSocket connection manager; frontend filters messages by script name
- Components: TitleBar (custom frameless), Sidebar (icon nav), ScriptList, ScriptCard, LogPanel (terminal-style), FilesPanel, SettingsPanel, StatusBar

### Electron (`electron/`)
- `main.js` — Creates frameless window; in production spawns/kills uvicorn backend subprocess; in dev connects to existing services. All local-only operations (shell commands, package installation) live here via `ipcMain.handle`.
- `preload.js` — Exposes `window.electronAPI` (minimize, maximize, close, installPlaywright, etc.) via IPC. Always use `ipcRenderer.invoke` for request/response, `ipcRenderer.on` for server-sent events.

## Frontend/Backend Responsibility Boundaries

**CRITICAL — Read before adding features**

### Core Principle: Strict Separation

The backend (`FastAPI`) is designed to run on a **remote server** (see `cloud_url` config). This means:

- **Anything that must run on the user's LOCAL machine belongs in Electron (main.js), NOT in the backend.**
- **The backend is dumb — it just serves API requests, whether local or remote.**

### What Runs Where

| Operation | Where to implement | Reason |
|-----------|-------------------|--------|
| pip install / package installation | **Electron main.js** | Runs locally, not on remote server |
| Running Python scripts (`scraper.py`) | **FastAPI backend** (subprocess.Popen) | Backend IS the script runner |
| Opening URLs / shell commands | **Electron main.js** | OS-level, local only |
| AI model API calls | **FastAPI backend** | Proxied through cloud_url |
| Settings storage | **FastAPI backend** (settings JSON) | Shared state across devices |
| Window controls (min/max/close) | **Electron preload.js** | OS-level only |

### Python Environment: `.venv`

- All Python execution (backend, scripts) goes through `.venv/bin/python3`
- **Never use bare `python3` or `pip`** — always `.venv/bin/python3 -m pip` or `.venv/bin/python3 -m uvicorn`
- When spawning subprocesses in Electron IPC handlers, use the venv Python path explicitly
- The venv is shared: backend + all scripts + playwright all live in the same `.venv`

### IPC Communication Pattern

Electron ↔ Renderer communication via `contextBridge` + `ipcMain`/`ipcRenderer`:

```js
// preload.js — exposes to renderer
contextBridge.exposeInMainWorld("electronAPI", {
  someAction: () => ipcRenderer.invoke("some-action"),
  onProgress: (callback) => {
    ipcRenderer.on("progress-event", (_e, data) => callback(data));
    return () => ipcRenderer.removeListener("progress-event", handler);
  },
});

// main.js — handles in main process
ipcMain.handle("some-action", async () => {
  // use spawn() for long-running commands, not exec()
  // send progress via mainWindow.webContents.send()
  return { success: true };
});
```

## Key Design Decisions

- **subprocess.Popen over asyncio subprocess** — Windows SelectorEventLoop doesn't support async subprocesses
- **Threading for log streaming** — Keeps main event loop responsive; logs pushed via queue to async context
- **WebSocket broadcast model** — All clients receive all logs/status; frontend filters by script name
- **Frameless Electron window** — `frame: false` with custom React TitleBar component for drag area
- **Electron handles local-only operations** — Any OS-level or local-only task MUST be in Electron, not FastAPI

## Frontend Dev Notes

- Vite proxies `/api` → `http://localhost:8000` and `/ws` → `ws://localhost:8000` (see `frontend/vite.config.js`)
- Design system colors defined in `frontend/src/index.css` (dark theme: bg `#0F1117`, accent `#6C5CE7`)
- Fonts: Inter (UI), JetBrains Mono (terminal/logs)
- Window: 1280×800 default, 960×600 minimum
