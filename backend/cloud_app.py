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
