"""FastAPI application — REST API + WebSocket for RPA manager."""

import asyncio
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.scanner import scan_scripts
from backend.runner import ScriptRunner
from backend.settings import load_settings, save_settings

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
    """Stop a running script by name."""
    scripts = scan_scripts(SCRIPTS_DIR)
    script = next((s for s in scripts if s["name"] == name), None)

    if script and runner.stop(script["path"]):
        return {"message": f"Script '{name}' stopped"}

    return JSONResponse(status_code=400, content={"error": f"Script '{name}' is not running"})


@app.get("/api/settings")
async def get_settings():
    """Return current settings."""
    return load_settings()


@app.put("/api/settings")
async def update_settings(body: dict):
    """Update settings (partial merge)."""
    return save_settings(body)


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
