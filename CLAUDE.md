# CLAUDE.md

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

**Data flow:** User (Electron UI) → HTTP/WebSocket → FastAPI backend (localhost:8000) → subprocess.Popen → Python scripts in `/scripts`

### Backend (`backend/`)
- `app.py` — FastAPI routes: `GET /api/scripts`, `POST /api/scripts/{name}/run`, `POST /api/scripts/{name}/stop`, `WS /ws`
- `runner.py` — `ScriptRunner` class manages subprocesses via `subprocess.Popen` with threading for non-blocking stdout/stderr reading. Statuses: idle → running → completed/failed
- `scanner.py` — Scans `scripts/` for `.py` files, excludes `__*.py` and `config.py`

### Frontend (`frontend/src/`)
- `App.jsx` — Main component with page routing via React state (not a router)
- `api.js` — HTTP client for backend REST endpoints
- `hooks/useWebSocket.js` — WebSocket connection manager; frontend filters messages by script name
- Components: TitleBar (custom frameless), Sidebar (icon nav), ScriptList, ScriptCard, LogPanel (terminal-style), FilesPanel, SettingsPanel, StatusBar

### Electron (`electron/`)
- `main.js` — Creates frameless window; in production spawns/kills uvicorn backend subprocess; in dev connects to existing services
- `preload.js` — Exposes `window.electronAPI` (minimize, maximize, close) via IPC

## Key Design Decisions

- **subprocess.Popen over asyncio subprocess** — Windows SelectorEventLoop doesn't support async subprocesses
- **Threading for log streaming** — Keeps main event loop responsive; logs pushed via queue to async context
- **WebSocket broadcast model** — All clients receive all logs/status; frontend filters by script name
- **Frameless Electron window** — `frame: false` with custom React TitleBar component for drag area

## Frontend Dev Notes

- Vite proxies `/api` → `http://localhost:8000` and `/ws` → `ws://localhost:8000` (see `frontend/vite.config.js`)
- Design system colors defined in `frontend/src/index.css` (dark theme: bg `#0F1117`, accent `#6C5CE7`)
- Fonts: Inter (UI), JetBrains Mono (terminal/logs)
- Window: 1280×800 default, 960×600 minimum
