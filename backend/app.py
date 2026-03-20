"""FastAPI application — REST API + WebSocket for RPA manager."""

import asyncio
import json
import os
from contextlib import asynccontextmanager

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
    delete_draft, publish_draft,
)

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


@app.post("/api/scripts/{name}/draft/publish")
async def publish_draft_endpoint(name: str):
    if publish_draft(SCRIPTS_DIR, name):
        return {"message": f"Draft published for '{name}'"}
    return JSONResponse(status_code=404, content={"error": "No draft to publish"})


@app.post("/api/ai/chat")
async def ai_chat(body: dict):
    """AI chat endpoint — streams response via SSE."""
    settings = load_settings()
    api_key = settings.get("ai", {}).get("api_key", "")
    if not api_key:
        return JSONResponse(status_code=400, content={"error": "AI API key not configured"})

    code = body.get("code", "")
    message = body.get("message", "")
    history = body.get("history", [])
    return EventSourceResponse(stream_chat(code, message, history))


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
