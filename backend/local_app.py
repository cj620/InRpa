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
