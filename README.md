# InRpa

Desktop RPA application for managing and running Python automation scripts with real-time log streaming.

**Stack:** Electron 33 (frameless window) + React 19 + Vite 6 (frontend) + FastAPI + uvicorn (backend) + subprocess.Popen (script execution)

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt
npm install
cd frontend && npm install

# Development (starts all services concurrently)
npm run dev

# Production build
cd frontend && npm run build
```

## Project Structure

```
InRpa/
├── backend/              # FastAPI backend
│   ├── local_app.py      # Local backend (port 8001, spawned by Electron)
│   ├── cloud_app.py      # Remote backend (port 8000)
│   ├── runner.py         # ScriptRunner: subprocess.Popen + threading
│   └── scanner.py        # Scans scripts/ for .py files
├── frontend/src/         # React frontend
│   ├── App.jsx           # Main component with page routing
│   ├── api.js            # HTTP client for backend REST endpoints
│   ├── hooks/
│   │   └── useWebSocket.js  # WebSocket connection manager
│   └── components/       # UI components
├── electron/             # Electron main process
│   ├── main.js           # Window management, backend lifecycle
│   └── preload.js        # IPC bridge (window.electronAPI)
├── scripts/               # User scripts directory
├── tests/                 # pytest + pytest-asyncio tests
└── docs/                  # PRD and design documents
```

## Architecture

### Dual Backend Ports

| Port | Purpose | Started by |
|------|---------|-------------|
| 8000 | Dev backend | Manual (`npm run dev:backend`) |
| 8001 | Production backend | Electron (`electron/main.js`) |

### Frontend ↔ Backend ↔ Scripts Data Flow

```
Electron UI (React)
    ├── HTTP/WebSocket → FastAPI backend (localhost:8001 prod / 8000 dev)
    │                       └── subprocess.Popen → Python scripts in /scripts
    └── IPC (window.electronAPI) → Electron main process (local-only ops)
```

### Frontend/Backend/Electron Responsibility Boundaries

**Core Principle:** Strict separation between local and remote operations.

| Operation | Where | Reason |
|-----------|-------|--------|
| pip install / package installation | **Electron main.js** | Runs locally, not on remote server |
| Running Python scripts | **FastAPI backend** | Backend IS the script runner |
| Opening URLs / shell commands | **Electron main.js** | OS-level, local only |
| AI model API calls | **FastAPI backend** | Proxied through cloud_url |
| Settings storage | **FastAPI backend** | Shared state across devices |
| Window controls (min/max/close) | **Electron preload.js** | OS-level only |

### Python Environment: `.venv`

- All Python execution (backend, scripts) uses `.venv/bin/python3`
- Never use bare `python3` or `pip` — always `.venv/bin/python3 -m pip`
- The venv is shared: backend + all scripts + playwright

## Commands

### Development
```bash
npm run dev          # All 3 services concurrently
npm run dev:frontend # Vite dev server on :5173
npm run dev:backend  # uvicorn with --reload on :8000
npm run dev:electron # Electron window (connects to existing services)
```

### Testing
```bash
pytest                        # All tests
pytest tests/test_runner.py   # Single file
pytest tests/test_app.py -k "test_list_scripts"  # Single test
```

## Key Design Decisions

1. **subprocess.Popen over asyncio subprocess** — Windows SelectorEventLoop compatibility
2. **Threading for log streaming** — Non-blocking stdout/stderr reading via threading + queue
3. **WebSocket broadcast model** — All clients receive all logs; frontend filters by script name
4. **Frameless Electron window** — `frame: false` with custom React TitleBar component
5. **IPC Communication** — Electron ↔ Renderer via `contextBridge` + `ipcMain.handle`/`ipcRenderer.invoke`

## API Endpoints

| Endpoint | Method | Function |
|----------|--------|----------|
| `/api/scripts` | GET | List all scripts |
| `/api/scripts/{name}/run` | POST | Run a script |
| `/api/scripts/{name}/stop` | POST | Stop a running script |

## WebSocket

- **Endpoint:** `ws://localhost:8000/ws`
- **Direction:** Server → Client (broadcast)
- **Message format:**

```json
{"type": "log", "script": "scraper", "data": "Found 10 products."}
{"type": "status", "script": "scraper", "data": "completed"}
```

## Scripts Directory

- Place `.py` scripts in the `scripts/` directory
- Scripts are auto-discovered on startup
- `__*.py` and `config.py` files are excluded
- Scripts run with their directory in `sys.path` for relative imports

## Tech Stack

- **Desktop Shell:** Electron 33 (frameless)
- **Frontend:** React 19 + Vite 6
- **Backend:** FastAPI + uvicorn
- **Script Execution:** subprocess.Popen + threading
- **Real-time:** WebSocket
- **Testing:** pytest + pytest-asyncio + httpx

## Ports

- **5173:** Vite dev server (frontend)
- **8000:** Dev backend (uvicorn)
- **8001:** Production backend (spawned by Electron)
- Frontend proxies `/api` and `/ws` to backend in dev mode
