"""Script metadata and folder management persistence."""

import copy
import json
import os
import tempfile

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts_data.json")
UNSORTED_KEY = "_unsorted"

DEFAULT_DATA: dict = {
    "folders": [],
    "scripts": {},  # { script_name: { folder?, tags, description } }
}


def _load() -> dict:
    if not os.path.exists(DATA_PATH):
        return copy.deepcopy(DEFAULT_DATA)
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, ValueError):
        return copy.deepcopy(DEFAULT_DATA)


def _save(data: dict) -> None:
    dir_name = os.path.dirname(DATA_PATH)
    fd, tmp = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp, DATA_PATH)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def get_folders() -> list:
    return _load()["folders"]


def create_folder(name: str, icon: str = "📁"):
    data = _load()
    if any(f["name"] == name for f in data["folders"]):
        return None  # already exists
    folder = {"name": name, "icon": icon}
    data["folders"].append(folder)
    _save(data)
    return folder


def rename_folder(old_name: str, new_name: str) -> bool:
    data = _load()
    folder = next((f for f in data["folders"] if f["name"] == old_name), None)
    if not folder:
        return False
    folder["name"] = new_name
    for meta in data["scripts"].values():
        if meta.get("folder") == old_name:
            meta["folder"] = new_name
    _save(data)
    return True


def delete_folder(name: str) -> bool:
    data = _load()
    new_folders = [f for f in data["folders"] if f["name"] != name]
    if len(new_folders) == len(data["folders"]):
        return False
    data["folders"] = new_folders
    for meta in data["scripts"].values():
        if meta.get("folder") == name:
            meta.pop("folder", None)
    _save(data)
    return True


def move_script(script_name: str, folder_name) -> None:
    data = _load()
    if script_name not in data["scripts"]:
        data["scripts"][script_name] = {}
    if folder_name:
        data["scripts"][script_name]["folder"] = folder_name
    else:
        data["scripts"][script_name].pop("folder", None)
    _save(data)


def update_script_meta(
    script_name: str,
    tags=None,
    description=None,
) -> None:
    data = _load()
    if script_name not in data["scripts"]:
        data["scripts"][script_name] = {}
    if tags is not None:
        data["scripts"][script_name]["tags"] = tags
    if description is not None:
        data["scripts"][script_name]["description"] = description
    _save(data)


def get_script_meta(script_name: str) -> dict:
    return _load()["scripts"].get(script_name, {})


def build_folder_groups(scripts: list) -> list:
    """Return scripts grouped into folder objects (enriched with metadata)."""
    data = _load()
    folders = data["folders"]
    script_data = data["scripts"]

    folder_map = {
        f["name"]: {"name": f["name"], "icon": f.get("icon", "📁"), "scripts": []}
        for f in folders
    }
    unsorted = []

    for s in scripts:
        meta = script_data.get(s["name"] if not s.get("is_draft") else s.get("parent_name", ""), {})

        if s.get("is_draft"):
            parent_folder = script_data.get(s.get("parent_name", ""), {}).get("folder")
            enriched = {**s}
            if parent_folder and parent_folder in folder_map:
                folder_map[parent_folder]["scripts"].append(enriched)
            else:
                unsorted.append(enriched)
            continue

        enriched = {
            **s,
            "tags": meta.get("tags", []),
            "description": meta.get("description", ""),
            "folder": meta.get("folder"),
        }
        folder_name = meta.get("folder")
        if folder_name and folder_name in folder_map:
            folder_map[folder_name]["scripts"].append(enriched)
        else:
            unsorted.append(enriched)

    result = list(folder_map.values())
    result.append({"name": UNSORTED_KEY, "icon": "📁", "scripts": unsorted})
    return result
