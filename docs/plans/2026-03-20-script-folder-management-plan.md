# Script Folder Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add one-level folder organization with tags to the script management system, refactoring both backend and frontend to support tree-structured script browsing, folder CRUD, drag-and-drop movement, batch operations, and market placeholder.

**Architecture:** File-system-driven approach — physical directories represent folders, `.scripts-meta.json` stores tags/descriptions/market metadata. Backend scanner recursively scans one-level subdirectories and merges metadata. Frontend adds a collapsible folder tree panel between sidebar and content area.

**Tech Stack:** Python/FastAPI (backend), React 19 (frontend), existing WebSocket broadcast system for real-time sync.

---

### Task 1: Backend — Metadata Manager Module

**Files:**
- Create: `backend/metadata.py`
- Test: `tests/test_metadata.py`

This module handles reading/writing `.scripts-meta.json` — the single source of truth for tags, descriptions, folder icons/order, and market source info.

**Step 1: Write the failing tests**

```python
# tests/test_metadata.py
import json
import pytest
from backend.metadata import ScriptsMetadata

EMPTY_META = {"version": 1, "scripts": {}, "folders": {}, "tags": []}


def test_load_creates_default_if_missing(tmp_path):
    """Should create default .scripts-meta.json if none exists."""
    meta = ScriptsMetadata(tmp_path)
    assert meta.data == EMPTY_META
    assert (tmp_path / ".scripts-meta.json").exists()


def test_load_reads_existing(tmp_path):
    """Should read existing .scripts-meta.json."""
    data = {
        "version": 1,
        "scripts": {"爬虫/scraper": {"tags": ["电商"], "description": "test", "source": None}},
        "folders": {"爬虫": {"icon": "spider", "order": 0}},
        "tags": ["电商"],
    }
    (tmp_path / ".scripts-meta.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    meta = ScriptsMetadata(tmp_path)
    assert meta.data["scripts"]["爬虫/scraper"]["tags"] == ["电商"]


def test_load_recovers_from_corrupt_json(tmp_path):
    """Should reset to default if JSON is corrupt."""
    (tmp_path / ".scripts-meta.json").write_text("{broken json", encoding="utf-8")
    meta = ScriptsMetadata(tmp_path)
    assert meta.data == EMPTY_META


def test_get_script_meta(tmp_path):
    """Should return script metadata by folder/name key."""
    data = {
        "version": 1,
        "scripts": {"爬虫/scraper": {"tags": ["电商"], "description": "desc", "source": None}},
        "folders": {},
        "tags": ["电商"],
    }
    (tmp_path / ".scripts-meta.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    meta = ScriptsMetadata(tmp_path)
    assert meta.get_script("爬虫/scraper")["tags"] == ["电商"]
    assert meta.get_script("nonexistent") == {"tags": [], "description": "", "source": None}


def test_set_script_tags(tmp_path):
    """Should update tags for a script and persist."""
    meta = ScriptsMetadata(tmp_path)
    meta.set_tags("爬虫/scraper", ["电商", "淘宝"])
    meta.save()
    # Reload and verify
    meta2 = ScriptsMetadata(tmp_path)
    assert meta2.get_script("爬虫/scraper")["tags"] == ["电商", "淘宝"]
    assert "电商" in meta2.data["tags"]
    assert "淘宝" in meta2.data["tags"]


def test_set_script_description(tmp_path):
    """Should update description for a script and persist."""
    meta = ScriptsMetadata(tmp_path)
    meta.set_description("爬虫/scraper", "淘宝商品数据采集")
    meta.save()
    meta2 = ScriptsMetadata(tmp_path)
    assert meta2.get_script("爬虫/scraper")["description"] == "淘宝商品数据采集"


def test_add_folder(tmp_path):
    """Should add folder metadata."""
    meta = ScriptsMetadata(tmp_path)
    meta.add_folder("爬虫", icon="spider")
    meta.save()
    meta2 = ScriptsMetadata(tmp_path)
    assert "爬虫" in meta2.data["folders"]
    assert meta2.data["folders"]["爬虫"]["icon"] == "spider"


def test_remove_folder(tmp_path):
    """Should remove folder metadata."""
    meta = ScriptsMetadata(tmp_path)
    meta.add_folder("爬虫")
    meta.save()
    meta.remove_folder("爬虫")
    meta.save()
    meta2 = ScriptsMetadata(tmp_path)
    assert "爬虫" not in meta2.data["folders"]


def test_rename_script_key(tmp_path):
    """Should rename script key when moving between folders."""
    meta = ScriptsMetadata(tmp_path)
    meta.set_tags("_unsorted/scraper", ["电商"])
    meta.set_description("_unsorted/scraper", "desc")
    meta.save()
    meta.rename_script("_unsorted/scraper", "爬虫/scraper")
    meta.save()
    meta2 = ScriptsMetadata(tmp_path)
    assert meta2.get_script("爬虫/scraper")["tags"] == ["电商"]
    assert meta2.get_script("_unsorted/scraper") == {"tags": [], "description": "", "source": None}


def test_cleanup_orphans(tmp_path):
    """Should remove metadata for scripts that no longer exist on disk."""
    meta = ScriptsMetadata(tmp_path)
    meta.set_tags("爬虫/deleted_script", ["old"])
    meta.save()
    # No actual file exists, cleanup should remove it
    existing_keys = set()
    meta.cleanup_orphans(existing_keys)
    meta.save()
    meta2 = ScriptsMetadata(tmp_path)
    assert "爬虫/deleted_script" not in meta2.data["scripts"]
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_metadata.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.metadata'`

**Step 3: Write implementation**

```python
# backend/metadata.py
"""Manage .scripts-meta.json — tags, descriptions, folder icons, market source info."""

import json
import os
from typing import Any


DEFAULT_META = {"version": 1, "scripts": {}, "folders": {}, "tags": []}
DEFAULT_SCRIPT = {"tags": [], "description": "", "source": None}
META_FILENAME = ".scripts-meta.json"


class ScriptsMetadata:
    """Read/write .scripts-meta.json in a scripts directory."""

    def __init__(self, scripts_dir: str):
        self._path = os.path.join(scripts_dir, META_FILENAME)
        self.data = self._load()

    def _load(self) -> dict:
        if os.path.isfile(self._path):
            try:
                with open(self._path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict) and data.get("version") == 1:
                    return data
            except (json.JSONDecodeError, KeyError):
                pass
        # Create default
        data = {**DEFAULT_META}
        self._write(data)
        return data

    def _write(self, data: dict) -> None:
        with open(self._path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save(self) -> None:
        self._write(self.data)

    def get_script(self, key: str) -> dict:
        return self.data["scripts"].get(key, {**DEFAULT_SCRIPT})

    def _ensure_script(self, key: str) -> dict:
        if key not in self.data["scripts"]:
            self.data["scripts"][key] = {**DEFAULT_SCRIPT}
        return self.data["scripts"][key]

    def set_tags(self, key: str, tags: list[str]) -> None:
        self._ensure_script(key)["tags"] = tags
        # Update global tag pool
        all_tags = set(self.data["tags"])
        all_tags.update(tags)
        self.data["tags"] = sorted(all_tags)

    def set_description(self, key: str, description: str) -> None:
        self._ensure_script(key)["description"] = description

    def add_folder(self, name: str, icon: str = "folder", order: int | None = None) -> None:
        if order is None:
            order = len(self.data["folders"])
        self.data["folders"][name] = {"icon": icon, "order": order}

    def remove_folder(self, name: str) -> None:
        self.data["folders"].pop(name, None)

    def rename_folder(self, old_name: str, new_name: str) -> None:
        if old_name in self.data["folders"]:
            self.data["folders"][new_name] = self.data["folders"].pop(old_name)
        # Rename all script keys under this folder
        updates = {}
        for key in list(self.data["scripts"]):
            if key.startswith(f"{old_name}/"):
                new_key = f"{new_name}/{key[len(old_name)+1:]}"
                updates[new_key] = self.data["scripts"].pop(key)
        self.data["scripts"].update(updates)

    def rename_script(self, old_key: str, new_key: str) -> None:
        if old_key in self.data["scripts"]:
            self.data["scripts"][new_key] = self.data["scripts"].pop(old_key)

    def cleanup_orphans(self, existing_keys: set[str]) -> None:
        for key in list(self.data["scripts"]):
            if key not in existing_keys:
                del self.data["scripts"][key]
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_metadata.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add backend/metadata.py tests/test_metadata.py
git commit -m "feat: add ScriptsMetadata manager for .scripts-meta.json"
```

---

### Task 2: Backend — Refactor scanner.py for Folder-Aware Scanning

**Files:**
- Modify: `backend/scanner.py`
- Modify: `tests/test_scanner.py`

Refactor `scan_scripts()` to recursively scan one-level subdirectories and return a tree structure with metadata merged from `.scripts-meta.json`.

**Step 1: Write the failing tests**

Add to `tests/test_scanner.py`:

```python
# Add these new tests to existing file

def test_scan_finds_scripts_in_subfolders(tmp_path):
    """Scanner should find scripts in one-level subdirectories."""
    folder = tmp_path / "爬虫"
    folder.mkdir()
    (folder / "scraper.py").write_text("print('scrape')")
    (tmp_path / "_unsorted").mkdir()
    (tmp_path / "_unsorted" / "hello.py").write_text("print('hi')")

    result = scan_scripts(str(tmp_path))

    assert "folders" in result
    folder_names = [f["name"] for f in result["folders"]]
    assert "爬虫" in folder_names
    assert "_unsorted" in folder_names


def test_scan_returns_tree_structure(tmp_path):
    """Scanner should return tree with folders containing scripts."""
    folder = tmp_path / "数据处理"
    folder.mkdir()
    (folder / "cleaner.py").write_text("print('clean')")

    result = scan_scripts(str(tmp_path))

    data_folder = next(f for f in result["folders"] if f["name"] == "数据处理")
    assert len(data_folder["scripts"]) == 1
    script = data_folder["scripts"][0]
    assert script["name"] == "cleaner"
    assert script["folder"] == "数据处理"
    assert script["path"] == "数据处理/cleaner"


def test_scan_merges_metadata(tmp_path):
    """Scanner should merge tags/description from .scripts-meta.json."""
    import json
    folder = tmp_path / "爬虫"
    folder.mkdir()
    (folder / "scraper.py").write_text("print('scrape')")
    meta = {
        "version": 1,
        "scripts": {"爬虫/scraper": {"tags": ["电商"], "description": "商品采集", "source": None}},
        "folders": {"爬虫": {"icon": "spider", "order": 0}},
        "tags": ["电商"],
    }
    (tmp_path / ".scripts-meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    result = scan_scripts(str(tmp_path))

    crawl_folder = next(f for f in result["folders"] if f["name"] == "爬虫")
    assert crawl_folder["icon"] == "spider"
    script = crawl_folder["scripts"][0]
    assert script["tags"] == ["电商"]
    assert script["description"] == "商品采集"


def test_scan_ignores_dotfiles_and_nested_folders(tmp_path):
    """Scanner should ignore hidden dirs and nested subdirectories."""
    (tmp_path / ".hidden").mkdir()
    (tmp_path / ".hidden" / "secret.py").write_text("bad")
    folder = tmp_path / "valid"
    folder.mkdir()
    nested = folder / "nested"
    nested.mkdir()
    (nested / "deep.py").write_text("too deep")
    (folder / "script.py").write_text("ok")

    result = scan_scripts(str(tmp_path))

    folder_names = [f["name"] for f in result["folders"]]
    assert ".hidden" not in folder_names
    valid_folder = next(f for f in result["folders"] if f["name"] == "valid")
    script_names = [s["name"] for s in valid_folder["scripts"]]
    assert "deep" not in script_names
    assert "script" in script_names


def test_scan_returns_global_tags(tmp_path):
    """Scanner should return global tag list from metadata."""
    import json
    meta = {"version": 1, "scripts": {}, "folders": {}, "tags": ["电商", "社交"]}
    (tmp_path / ".scripts-meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    result = scan_scripts(str(tmp_path))
    assert result["tags"] == ["电商", "社交"]


def test_scan_draft_support_in_folders(tmp_path):
    """Drafts in folders should have is_draft=True and parent_name."""
    folder = tmp_path / "爬虫"
    folder.mkdir()
    (folder / "scraper.py").write_text("prod")
    (folder / "scraper_draft.py").write_text("draft")

    result = scan_scripts(str(tmp_path))

    crawl_folder = next(f for f in result["folders"] if f["name"] == "爬虫")
    names = {s["name"]: s for s in crawl_folder["scripts"]}
    assert not names["scraper"]["is_draft"]
    assert names["scraper"]["has_draft"] is True
    assert names["scraper_draft"]["is_draft"] is True
    assert names["scraper_draft"]["parent_name"] == "scraper"
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_scanner.py -v`
Expected: FAIL — new tests fail because `scan_scripts` returns a list, not a dict with "folders"

**Step 3: Rewrite scanner.py**

```python
# backend/scanner.py
"""Scan scripts directory for available Python scripts organized in folders."""

import os
from datetime import datetime

from backend.drafts import has_draft as check_has_draft
from backend.metadata import ScriptsMetadata


def _scan_folder(folder_path: str, folder_name: str) -> list[dict]:
    """Scan a single folder for .py scripts. Returns list of script entries."""
    scripts = []
    if not os.path.isdir(folder_path):
        return scripts

    for filename in sorted(os.listdir(folder_path)):
        if not filename.endswith(".py"):
            continue
        if filename.startswith("__"):
            continue
        if filename == "config.py":
            continue

        filepath = os.path.join(folder_path, filename)
        if not os.path.isfile(filepath):
            continue

        stat = os.stat(filepath)
        name = filename[:-3]
        is_draft = name.endswith("_draft")

        entry = {
            "name": name,
            "folder": folder_name,
            "path": f"{folder_name}/{name}",
            "full_path": filepath,
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
            "is_draft": is_draft,
        }

        if is_draft:
            entry["parent_name"] = name[:-6]
        else:
            entry["has_draft"] = check_has_draft(folder_path, name)

        scripts.append(entry)

    return scripts


def scan_scripts(directory: str) -> dict:
    """Scan directory for folders containing .py scripts.

    Returns tree structure:
    {
        "folders": [{"name": "...", "icon": "...", "scripts": [...]}],
        "tags": [...]
    }
    """
    if not os.path.isdir(directory):
        return {"folders": [], "tags": []}

    metadata = ScriptsMetadata(directory)
    folders = []
    existing_keys = set()

    for entry_name in sorted(os.listdir(directory)):
        entry_path = os.path.join(directory, entry_name)
        # Only one-level directories, skip hidden/dot dirs
        if not os.path.isdir(entry_path):
            continue
        if entry_name.startswith("."):
            continue

        scripts = _scan_folder(entry_path, entry_name)

        # Merge metadata into each script
        for script in scripts:
            key = script["path"]
            existing_keys.add(key)
            meta = metadata.get_script(key)
            script["tags"] = meta["tags"]
            script["description"] = meta["description"]
            script["source"] = meta["source"]

        folder_meta = metadata.data["folders"].get(entry_name, {})
        folders.append({
            "name": entry_name,
            "icon": folder_meta.get("icon", "folder"),
            "order": folder_meta.get("order", 999),
            "scripts": scripts,
        })

    # Sort folders by order then name
    folders.sort(key=lambda f: (f["order"], f["name"]))

    # Cleanup orphan metadata
    metadata.cleanup_orphans(existing_keys)
    metadata.save()

    return {"folders": folders, "tags": metadata.data["tags"]}
```

**Step 4: Update old scanner tests**

The existing tests call `scan_scripts()` expecting a list. Update them to work with the new tree structure. Since the old tests create scripts in tmp_path root (no subfolder), they will get an empty result. We need to update them to use subfolders:

```python
# Update existing tests in test_scanner.py to use subfolder structure

def test_scan_finds_py_files(tmp_path):
    """Scanner should find .py files in subdirectory."""
    folder = tmp_path / "test_folder"
    folder.mkdir()
    (folder / "script_a.py").write_text("print('a')")
    (folder / "script_b.py").write_text("print('b')")
    (folder / "readme.txt").write_text("not a script")

    result = scan_scripts(str(tmp_path))
    test_folder = next(f for f in result["folders"] if f["name"] == "test_folder")
    names = [s["name"] for s in test_folder["scripts"]]
    assert len(test_folder["scripts"]) == 2
    assert "script_a" in names
    assert "script_b" in names


def test_scan_returns_metadata(tmp_path):
    """Each script entry should have name, folder, path, size, modified_at."""
    folder = tmp_path / "demo_folder"
    folder.mkdir()
    (folder / "demo.py").write_text("print('hello')")

    result = scan_scripts(str(tmp_path))
    demo_folder = next(f for f in result["folders"] if f["name"] == "demo_folder")
    script = demo_folder["scripts"][0]
    assert script["name"] == "demo"
    assert script["folder"] == "demo_folder"
    assert script["path"] == "demo_folder/demo"
    assert isinstance(script["size"], int)
    assert isinstance(script["modified_at"], str)


def test_scan_empty_dir(tmp_path):
    """Scanner should return empty folders list for empty directory."""
    result = scan_scripts(str(tmp_path))
    assert result == {"folders": [], "tags": []}


def test_scan_ignores_dunder_files(tmp_path):
    """Scanner should ignore __init__.py and similar within folders."""
    folder = tmp_path / "scripts"
    folder.mkdir()
    (folder / "__init__.py").write_text("")
    (folder / "real_script.py").write_text("print('hi')")

    result = scan_scripts(str(tmp_path))
    scripts_folder = next(f for f in result["folders"] if f["name"] == "scripts")
    assert len(scripts_folder["scripts"]) == 1
    assert scripts_folder["scripts"][0]["name"] == "real_script"
```

**Step 5: Run all scanner tests**

Run: `pytest tests/test_scanner.py -v`
Expected: All PASS

**Step 6: Commit**

```bash
git add backend/scanner.py tests/test_scanner.py
git commit -m "refactor: scanner returns tree structure with folder-aware scanning"
```

---

### Task 3: Backend — Migration Script (Root Scripts → _unsorted/)

**Files:**
- Create: `backend/migration.py`
- Test: `tests/test_migration.py`

On first startup, move any `.py` files in root `scripts/` directory into `_unsorted/` subfolder.

**Step 1: Write the failing tests**

```python
# tests/test_migration.py
import pytest
from backend.migration import migrate_flat_to_folders


def test_migrate_moves_root_scripts(tmp_path):
    """Should move root .py files to _unsorted/ subfolder."""
    (tmp_path / "scraper.py").write_text("print('scrape')")
    (tmp_path / "cleaner.py").write_text("print('clean')")

    migrate_flat_to_folders(str(tmp_path))

    assert not (tmp_path / "scraper.py").exists()
    assert (tmp_path / "_unsorted" / "scraper.py").exists()
    assert (tmp_path / "_unsorted" / "cleaner.py").exists()


def test_migrate_skips_config_and_dunder(tmp_path):
    """Should not move config.py or __init__.py."""
    (tmp_path / "config.py").write_text("CONFIG = {}")
    (tmp_path / "__init__.py").write_text("")
    (tmp_path / "script.py").write_text("ok")

    migrate_flat_to_folders(str(tmp_path))

    assert (tmp_path / "config.py").exists()
    assert (tmp_path / "__init__.py").exists()
    assert (tmp_path / "_unsorted" / "script.py").exists()


def test_migrate_noop_if_no_root_scripts(tmp_path):
    """Should do nothing if no root .py files exist."""
    folder = tmp_path / "爬虫"
    folder.mkdir()
    (folder / "scraper.py").write_text("ok")

    migrate_flat_to_folders(str(tmp_path))

    assert not (tmp_path / "_unsorted").exists()
    assert (folder / "scraper.py").exists()


def test_migrate_handles_name_conflict(tmp_path):
    """Should handle case where _unsorted/ already has same-named file."""
    unsorted = tmp_path / "_unsorted"
    unsorted.mkdir()
    (unsorted / "script.py").write_text("existing")
    (tmp_path / "script.py").write_text("new version")

    migrate_flat_to_folders(str(tmp_path))

    # Root file should not overwrite existing — skip or rename
    assert (unsorted / "script.py").read_text() == "existing"
    # The conflicting root file gets a suffix
    assert (unsorted / "script_1.py").exists()


def test_migrate_preserves_existing_folders(tmp_path):
    """Should not touch existing subdirectories."""
    folder = tmp_path / "爬虫"
    folder.mkdir()
    (folder / "scraper.py").write_text("ok")
    (tmp_path / "loose.py").write_text("loose")

    migrate_flat_to_folders(str(tmp_path))

    assert (folder / "scraper.py").exists()
    assert (tmp_path / "_unsorted" / "loose.py").exists()
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_migration.py -v`
Expected: FAIL — `ModuleNotFoundError`

**Step 3: Write implementation**

```python
# backend/migration.py
"""One-time migration: move root-level scripts into _unsorted/ subfolder."""

import os
import shutil


def migrate_flat_to_folders(scripts_dir: str) -> bool:
    """Move any .py files in the root scripts/ directory to _unsorted/.

    Returns True if any files were moved.
    """
    if not os.path.isdir(scripts_dir):
        return False

    root_scripts = []
    for filename in os.listdir(scripts_dir):
        if not filename.endswith(".py"):
            continue
        if filename.startswith("__"):
            continue
        if filename == "config.py":
            continue
        filepath = os.path.join(scripts_dir, filename)
        if os.path.isfile(filepath):
            root_scripts.append(filename)

    if not root_scripts:
        return False

    unsorted_dir = os.path.join(scripts_dir, "_unsorted")
    os.makedirs(unsorted_dir, exist_ok=True)

    for filename in root_scripts:
        src = os.path.join(scripts_dir, filename)
        dst = os.path.join(unsorted_dir, filename)

        if os.path.exists(dst):
            # Conflict: add numeric suffix
            base, ext = os.path.splitext(filename)
            counter = 1
            while os.path.exists(dst):
                dst = os.path.join(unsorted_dir, f"{base}_{counter}{ext}")
                counter += 1

        shutil.move(src, dst)

    return True
```

**Step 4: Run tests**

Run: `pytest tests/test_migration.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add backend/migration.py tests/test_migration.py
git commit -m "feat: add migration to move root scripts into _unsorted/ folder"
```

---

### Task 4: Backend — Folder CRUD API Endpoints

**Files:**
- Modify: `backend/app.py`
- Modify: `tests/test_app.py`

Add folder create/rename/delete endpoints and update existing script endpoints to be folder-aware.

**Step 1: Write the failing tests**

Add to `tests/test_app.py`:

```python
import os
import json


@pytest.fixture
def scripts_dir(tmp_path, monkeypatch):
    """Set up a temp scripts dir with folders for testing."""
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    unsorted = scripts / "_unsorted"
    unsorted.mkdir()
    (unsorted / "hello.py").write_text("print('hi')")
    crawl = scripts / "爬虫"
    crawl.mkdir()
    (crawl / "scraper.py").write_text("print('scrape')")
    monkeypatch.setattr("backend.app.SCRIPTS_DIR", str(scripts))
    return scripts


@pytest.mark.asyncio
async def test_list_scripts_returns_tree(scripts_dir):
    """GET /api/scripts should return tree structure with folders."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts")
    assert resp.status_code == 200
    data = resp.json()
    assert "folders" in data
    assert "tags" in data
    folder_names = [f["name"] for f in data["folders"]]
    assert "_unsorted" in folder_names
    assert "爬虫" in folder_names


@pytest.mark.asyncio
async def test_create_folder(scripts_dir):
    """POST /api/folders should create a new directory."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/folders", json={"name": "数据处理"})
    assert resp.status_code == 200
    assert (scripts_dir / "数据处理").is_dir()


@pytest.mark.asyncio
async def test_create_duplicate_folder(scripts_dir):
    """POST /api/folders with existing name should return 409."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/folders", json={"name": "爬虫"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_rename_folder(scripts_dir):
    """PUT /api/folders/{name} should rename the directory."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/folders/爬虫", json={"new_name": "蜘蛛"})
    assert resp.status_code == 200
    assert not (scripts_dir / "爬虫").exists()
    assert (scripts_dir / "蜘蛛").is_dir()
    assert (scripts_dir / "蜘蛛" / "scraper.py").exists()


@pytest.mark.asyncio
async def test_delete_empty_folder(scripts_dir):
    """DELETE /api/folders/{name} should delete empty folder."""
    empty = scripts_dir / "empty_folder"
    empty.mkdir()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.delete("/api/folders/empty_folder")
    assert resp.status_code == 200
    assert not empty.exists()


@pytest.mark.asyncio
async def test_delete_nonempty_folder(scripts_dir):
    """DELETE /api/folders/{name} should return 409 if folder has scripts."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.delete("/api/folders/爬虫")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_create_folder_invalid_name(scripts_dir):
    """POST /api/folders with invalid characters should return 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/folders", json={"name": "../evil"})
    assert resp.status_code == 400
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_app.py -v`
Expected: New tests FAIL

**Step 3: Add folder endpoints to app.py**

Add these endpoints to `backend/app.py`:

```python
import re
from backend.metadata import ScriptsMetadata
from backend.migration import migrate_flat_to_folders

# In lifespan:
@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate_flat_to_folders(SCRIPTS_DIR)
    yield

VALID_FOLDER_NAME = re.compile(r'^[\w\u4e00-\u9fff\-]+$')


@app.post("/api/folders")
async def create_folder(body: dict):
    name = body.get("name", "").strip()
    if not name or not VALID_FOLDER_NAME.match(name):
        return JSONResponse(status_code=400, content={"error": "文件夹名称无效"})
    folder_path = os.path.join(SCRIPTS_DIR, name)
    if os.path.exists(folder_path):
        return JSONResponse(status_code=409, content={"error": "文件夹已存在"})
    os.makedirs(folder_path)
    metadata = ScriptsMetadata(SCRIPTS_DIR)
    metadata.add_folder(name)
    metadata.save()
    await broadcast({"type": "folder_created", "folder": name})
    return {"message": f"文件夹 '{name}' 已创建"}


@app.put("/api/folders/{name}")
async def rename_folder(name: str, body: dict):
    new_name = body.get("new_name", "").strip()
    if not new_name or not VALID_FOLDER_NAME.match(new_name):
        return JSONResponse(status_code=400, content={"error": "新名称无效"})
    old_path = os.path.join(SCRIPTS_DIR, name)
    new_path = os.path.join(SCRIPTS_DIR, new_name)
    if not os.path.isdir(old_path):
        return JSONResponse(status_code=404, content={"error": "文件夹不存在"})
    if os.path.exists(new_path):
        return JSONResponse(status_code=409, content={"error": "目标名称已存在"})
    os.rename(old_path, new_path)
    metadata = ScriptsMetadata(SCRIPTS_DIR)
    metadata.rename_folder(name, new_name)
    metadata.save()
    await broadcast({"type": "folder_renamed", "old_name": name, "new_name": new_name})
    return {"message": f"文件夹已重命名为 '{new_name}'"}


@app.delete("/api/folders/{name}")
async def delete_folder(name: str):
    folder_path = os.path.join(SCRIPTS_DIR, name)
    if not os.path.isdir(folder_path):
        return JSONResponse(status_code=404, content={"error": "文件夹不存在"})
    # Check if folder has .py files
    py_files = [f for f in os.listdir(folder_path) if f.endswith(".py")]
    if py_files:
        return JSONResponse(status_code=409, content={"error": f"文件夹中还有 {len(py_files)} 个脚本，请先移走"})
    os.rmdir(folder_path)
    metadata = ScriptsMetadata(SCRIPTS_DIR)
    metadata.remove_folder(name)
    metadata.save()
    await broadcast({"type": "folder_deleted", "folder": name})
    return {"message": f"文件夹 '{name}' 已删除"}
```

**Step 4: Run tests**

Run: `pytest tests/test_app.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add backend/app.py tests/test_app.py
git commit -m "feat: add folder CRUD API endpoints"
```

---

### Task 5: Backend — Script Move/Tags/Description Endpoints

**Files:**
- Modify: `backend/app.py`
- Modify: `tests/test_app.py`

Update script run/stop/content endpoints to use `{folder}/{name}` path params, and add move/tags/description endpoints.

**Step 1: Write the failing tests**

Add to `tests/test_app.py`:

```python
@pytest.mark.asyncio
async def test_move_script(scripts_dir):
    """POST /api/scripts/{folder}/{name}/move should move file to target folder."""
    target = scripts_dir / "数据处理"
    target.mkdir()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/scripts/爬虫/scraper/move",
            json={"target_folder": "数据处理"}
        )
    assert resp.status_code == 200
    assert not (scripts_dir / "爬虫" / "scraper.py").exists()
    assert (scripts_dir / "数据处理" / "scraper.py").exists()


@pytest.mark.asyncio
async def test_update_script_tags(scripts_dir):
    """PUT /api/scripts/{folder}/{name}/tags should update tags."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put(
            "/api/scripts/爬虫/scraper/tags",
            json={"tags": ["电商", "淘宝"]}
        )
    assert resp.status_code == 200
    # Verify in metadata
    from backend.metadata import ScriptsMetadata
    meta = ScriptsMetadata(str(scripts_dir))
    assert meta.get_script("爬虫/scraper")["tags"] == ["电商", "淘宝"]


@pytest.mark.asyncio
async def test_update_script_description(scripts_dir):
    """PUT /api/scripts/{folder}/{name}/description should update description."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put(
            "/api/scripts/爬虫/scraper/description",
            json={"description": "淘宝商品数据采集"}
        )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_run_script_with_folder(scripts_dir):
    """POST /api/scripts/{folder}/{name}/run should run the script."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/爬虫/scraper/run")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_run_nonexistent_script_in_folder(scripts_dir):
    """POST /api/scripts/{folder}/{name}/run should 404 for missing script."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/爬虫/nonexistent/run")
    assert resp.status_code == 404
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_app.py::test_move_script -v`
Expected: FAIL — route does not exist

**Step 3: Add endpoints to app.py**

```python
# Helper to find script in tree
def _find_script(folder: str, name: str) -> dict | None:
    """Find a script by folder and name."""
    script_path = os.path.join(SCRIPTS_DIR, folder, f"{name}.py")
    if os.path.isfile(script_path):
        return {"name": name, "folder": folder, "path": script_path}
    return None


@app.post("/api/scripts/{folder}/{name}/run")
async def run_script_in_folder(folder: str, name: str):
    script = _find_script(folder, name)
    if not script:
        return JSONResponse(status_code=404, content={"error": f"Script '{folder}/{name}' not found"})
    script_path = script["path"]
    script_key = f"{folder}/{name}"

    if runner.get_status(script_path) == "running":
        return JSONResponse(status_code=409, content={"error": f"Script '{name}' is already running"})

    async def on_log(line: str):
        await broadcast({"type": "log", "script": script_key, "data": line})

    async def run_and_notify():
        await broadcast({"type": "status", "script": script_key, "data": "running"})
        await runner.run(script_path, on_log=on_log)
        status = runner.get_status(script_path)
        await broadcast({"type": "status", "script": script_key, "data": status})

    asyncio.create_task(run_and_notify())
    return {"message": f"Script '{name}' started"}


@app.post("/api/scripts/{folder}/{name}/stop")
async def stop_script_in_folder(folder: str, name: str):
    script = _find_script(folder, name)
    if not script:
        return JSONResponse(status_code=404, content={"error": f"Script '{folder}/{name}' not found"})
    if runner.stop(script["path"]):
        return {"message": f"Script '{name}' stopped"}
    return JSONResponse(status_code=400, content={"error": f"Script '{name}' is not running"})


@app.get("/api/scripts/{folder}/{name}/content")
async def get_script_content_in_folder(folder: str, name: str):
    script = _find_script(folder, name)
    if not script:
        return JSONResponse(status_code=404, content={"error": f"Script '{folder}/{name}' not found"})
    with open(script["path"], "r", encoding="utf-8") as f:
        content = f.read()
    return {"content": content}


@app.post("/api/scripts/{folder}/{name}/move")
async def move_script(folder: str, name: str, body: dict):
    target_folder = body.get("target_folder", "").strip()
    if not target_folder:
        return JSONResponse(status_code=400, content={"error": "目标文件夹未指定"})

    src_path = os.path.join(SCRIPTS_DIR, folder, f"{name}.py")
    if not os.path.isfile(src_path):
        return JSONResponse(status_code=404, content={"error": "脚本不存在"})

    target_dir = os.path.join(SCRIPTS_DIR, target_folder)
    if not os.path.isdir(target_dir):
        return JSONResponse(status_code=404, content={"error": "目标文件夹不存在"})

    dst_path = os.path.join(target_dir, f"{name}.py")
    if os.path.exists(dst_path):
        return JSONResponse(status_code=409, content={"error": "目标文件夹已有同名脚本"})

    import shutil
    shutil.move(src_path, dst_path)

    # Also move draft if exists
    draft_src = os.path.join(SCRIPTS_DIR, folder, f"{name}_draft.py")
    if os.path.isfile(draft_src):
        shutil.move(draft_src, os.path.join(target_dir, f"{name}_draft.py"))

    # Update metadata
    metadata = ScriptsMetadata(SCRIPTS_DIR)
    metadata.rename_script(f"{folder}/{name}", f"{target_folder}/{name}")
    metadata.save()

    await broadcast({"type": "script_moved", "script": name, "from": folder, "to": target_folder})
    return {"message": f"脚本 '{name}' 已移动到 '{target_folder}'"}


@app.put("/api/scripts/{folder}/{name}/tags")
async def update_script_tags(folder: str, name: str, body: dict):
    script = _find_script(folder, name)
    if not script:
        return JSONResponse(status_code=404, content={"error": "脚本不存在"})
    tags = body.get("tags", [])
    metadata = ScriptsMetadata(SCRIPTS_DIR)
    metadata.set_tags(f"{folder}/{name}", tags)
    metadata.save()
    await broadcast({"type": "tags_updated", "script": f"{folder}/{name}", "tags": tags})
    return {"message": "标签已更新"}


@app.put("/api/scripts/{folder}/{name}/description")
async def update_script_description(folder: str, name: str, body: dict):
    script = _find_script(folder, name)
    if not script:
        return JSONResponse(status_code=404, content={"error": "脚本不存在"})
    description = body.get("description", "")
    metadata = ScriptsMetadata(SCRIPTS_DIR)
    metadata.set_description(f"{folder}/{name}", description)
    metadata.save()
    await broadcast({"type": "description_updated", "script": f"{folder}/{name}", "description": description})
    return {"message": "描述已更新"}
```

**Step 4: Run tests**

Run: `pytest tests/test_app.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add backend/app.py tests/test_app.py
git commit -m "feat: add script move/tags/description endpoints with folder-aware run/stop"
```

---

### Task 6: Frontend — Update API Client

**Files:**
- Modify: `frontend/src/api.js`

Update all API functions to use the new `{folder}/{name}` URL pattern and add new endpoints.

**Step 1: Update api.js**

```javascript
// frontend/src/api.js
const API_BASE = "http://localhost:8000";

export async function fetchScripts() {
  const res = await fetch(`${API_BASE}/api/scripts`);
  if (!res.ok) throw new Error(`Failed to fetch scripts: ${res.status}`);
  return res.json();
}

// --- Folder operations ---

export async function createFolder(name) {
  const res = await fetch(`${API_BASE}/api/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `Failed to create folder: ${res.status}`);
  }
  return res.json();
}

export async function renameFolder(name, newName) {
  const res = await fetch(`${API_BASE}/api/folders/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_name: newName }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `Failed to rename folder: ${res.status}`);
  }
  return res.json();
}

export async function deleteFolder(name) {
  const res = await fetch(`${API_BASE}/api/folders/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `Failed to delete folder: ${res.status}`);
  }
  return res.json();
}

// --- Script operations (folder-aware) ---

export async function runScript(folder, name) {
  const res = await fetch(`${API_BASE}/api/scripts/${encodeURIComponent(folder)}/${encodeURIComponent(name)}/run`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `Failed to run script: ${res.status}`);
  }
  return res.json();
}

export async function stopScript(folder, name) {
  const res = await fetch(`${API_BASE}/api/scripts/${encodeURIComponent(folder)}/${encodeURIComponent(name)}/stop`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `Failed to stop script: ${res.status}`);
  }
  return res.json();
}

export async function fetchScriptContent(folder, name) {
  const res = await fetch(`${API_BASE}/api/scripts/${encodeURIComponent(folder)}/${encodeURIComponent(name)}/content`);
  if (!res.ok) throw new Error(`Failed to fetch content: ${res.status}`);
  return res.json();
}

export async function moveScript(folder, name, targetFolder) {
  const res = await fetch(`${API_BASE}/api/scripts/${encodeURIComponent(folder)}/${encodeURIComponent(name)}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_folder: targetFolder }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `Failed to move script: ${res.status}`);
  }
  return res.json();
}

export async function updateScriptTags(folder, name, tags) {
  const res = await fetch(`${API_BASE}/api/scripts/${encodeURIComponent(folder)}/${encodeURIComponent(name)}/tags`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) throw new Error(`Failed to update tags: ${res.status}`);
  return res.json();
}

export async function updateScriptDescription(folder, name, description) {
  const res = await fetch(`${API_BASE}/api/scripts/${encodeURIComponent(folder)}/${encodeURIComponent(name)}/description`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error(`Failed to update description: ${res.status}`);
  return res.json();
}

// --- Keep existing draft/settings/AI functions but update paths ---
// (drafts will need folder awareness in a future task — keep current signatures for now)

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

export async function testAIConnection(aiConfig) {
  const res = await fetch(`${API_BASE}/api/ai/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(aiConfig),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "连接失败");
  return data;
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
git commit -m "refactor: update API client for folder-aware script endpoints"
```

---

### Task 7: Frontend — FolderTree Component

**Files:**
- Create: `frontend/src/components/FolderTree.jsx`
- Create: `frontend/src/components/FolderTree.css`

The collapsible folder tree panel that sits between Sidebar and content area.

**Step 1: Build FolderTree component**

See design doc for full interaction spec. Key features:
- List of folders with script count badges
- "全部" virtual node at top
- Hover `···` menu button on each folder (rename, delete)
- `[+ 新建文件夹]` button at bottom
- Inline rename on double-click or F2
- Collapse toggle button in header
- Drop zone support for drag-and-drop (wire in Task 11)

Component props:
```jsx
FolderTree({
  folders,          // array from API: [{name, icon, scripts: [...]}]
  selectedFolder,   // string: current folder name or "all"
  onSelectFolder,   // (folderName) => void
  onCreateFolder,   // () => void — opens inline input
  onRenameFolder,   // (oldName, newName) => void
  onDeleteFolder,   // (name) => void
  collapsed,        // boolean
  onToggleCollapse, // () => void
})
```

**Implementation notes:**
- Use CSS variable `--folder-tree-width: 200px` for the panel width
- Active folder gets `background: var(--bg-active)` highlight
- Script count uses a small rounded badge
- Folder icon defaults to 📁 emoji, can be customized later
- `···` button appears on hover only, positioned absolutely to right of row
- Delete shows `window.confirm()` dialog for now (upgrade to custom modal later)
- Inline rename: on double-click, replace folder name with `<input>`, Enter to confirm, Escape to cancel

**Step 2: Build FolderTree.css**

Match existing dark theme from `index.css`:
- Background: `var(--bg-secondary)`
- Border-right: `1px solid var(--border-color)`
- Font: Inter, 13px
- Folder row height: 36px, padding-left: 12px
- Hover: `var(--bg-hover)`
- Active: `var(--bg-active)` with left border accent

**Step 3: Commit**

```bash
git add frontend/src/components/FolderTree.jsx frontend/src/components/FolderTree.css
git commit -m "feat: add FolderTree component with folder CRUD interactions"
```

---

### Task 8: Frontend — Refactor ScriptCard with Tags & Description

**Files:**
- Modify: `frontend/src/components/ScriptCard.jsx`
- Modify: `frontend/src/components/ScriptCard.css`

Add description line, tag chips, and `···` context menu to ScriptCard.

**Step 1: Update ScriptCard.jsx**

Add to the card layout:
- Description text (single line, `text-overflow: ellipsis`)
- Tag chips row (small colored pills, clickable to filter)
- `···` menu button (hover-visible) with: "移动到...", "编辑标签", "编辑描述"

New props:
```jsx
ScriptCard({
  script,         // now includes: tags, description, folder, path
  status,
  selected,
  onClick,
  onEdit,
  onTagClick,     // (tag) => void — filter by this tag
  onContextMenu,  // (action, script) => void — "move", "editTags", "editDescription"
  draggable,      // boolean — for drag-and-drop
  onDragStart,    // drag event handler
  selectable,     // boolean — batch mode
  isSelected,     // boolean — batch selection state
  onSelectToggle, // () => void — toggle batch selection
})
```

**Step 2: Update ScriptCard.css**

- Description: `color: var(--text-secondary)`, font-size 12px, margin-top 2px
- Tags: flex-wrap row, small pills with `background: var(--tag-bg)`, `color: var(--tag-text)`, border-radius 10px, padding 1px 8px, font-size 11px
- `···` button: absolute position, top-right, opacity 0 → 1 on card hover
- Checkbox (batch mode): left side of card, appears when `selectable` is true

**Step 3: Commit**

```bash
git add frontend/src/components/ScriptCard.jsx frontend/src/components/ScriptCard.css
git commit -m "feat: enhance ScriptCard with tags, description, and context menu"
```

---

### Task 9: Frontend — Refactor ScriptList for Folder-Aware Display

**Files:**
- Modify: `frontend/src/components/ScriptList.jsx`
- Modify: `frontend/src/components/ScriptList.css`

Refactor ScriptList to receive folder-structured data and display scripts for the selected folder, with enhanced search and tag filtering.

**Step 1: Update ScriptList.jsx**

Key changes:
- Receives `folders` (array) and `selectedFolder` instead of flat `scripts` array
- Computes displayed scripts based on selected folder ("all" shows all, grouped by folder)
- Search bar matches name, description, and tags
- Tag filter dropdown (multi-select, populated from global tags list)
- When "all" is selected, show folder group headers between script sections
- Pass `folder` info to ScriptCard

New props:
```jsx
ScriptList({
  folders,         // from API
  tags,            // global tag list
  selectedFolder,  // "all" or folder name
  statuses,
  selectedScript,  // now "{folder}/{name}" format
  onSelect,
  onRefresh,
  onEdit,
  onTagClick,
  onScriptAction,  // (action, script) => void
})
```

**Step 2: Update ScriptList.css**

- Folder group header: sticky, `background: var(--bg-primary)`, font-weight 600, padding 8px 16px
- Tag filter: dropdown with checkboxes, positioned below filter button
- Search scope indicator (compact)

**Step 3: Commit**

```bash
git add frontend/src/components/ScriptList.jsx frontend/src/components/ScriptList.css
git commit -m "refactor: ScriptList supports folder filtering and tag-based search"
```

---

### Task 10: Frontend — Wire Everything in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/hooks/useWebSocket.js`

Wire the new FolderTree and updated ScriptList into App, update state management and WebSocket handler for folder events.

**Step 1: Update App.jsx state**

```jsx
// New state
const [scriptData, setScriptData] = useState({ folders: [], tags: [] });
const [selectedFolder, setSelectedFolder] = useState("all");
const [folderTreeCollapsed, setFolderTreeCollapsed] = useState(false);

// selectedScript changes from "name" to "folder/name" format
const [selectedScript, setSelectedScript] = useState(null); // e.g. "爬虫/scraper"
```

**Step 2: Update loadScripts**

```jsx
const loadScripts = useCallback(async () => {
  try {
    const data = await fetchScripts();
    setScriptData(data); // data is now {folders: [...], tags: [...]}
  } catch (err) {
    console.error("Failed to fetch scripts:", err);
  }
}, []);
```

**Step 3: Update handleRun/handleStop**

```jsx
const handleRun = async () => {
  if (!selectedScript) return;
  const [folder, name] = selectedScript.split("/");
  clearLogs(selectedScript);
  await runScript(folder, name);
};

const handleStop = async () => {
  if (!selectedScript) return;
  const [folder, name] = selectedScript.split("/");
  await stopScript(folder, name);
};
```

**Step 4: Update WebSocket handler**

In `useWebSocket.js`, add handlers for new message types:

```javascript
// In ws.onmessage handler, add:
if (msg.type === "folder_created" || msg.type === "folder_deleted" ||
    msg.type === "folder_renamed" || msg.type === "script_moved" ||
    msg.type === "tags_updated" || msg.type === "description_updated") {
  // Trigger a refresh of the script list
  if (onFsChange) onFsChange(msg);
}
```

Add `onFsChange` callback to the hook interface.

**Step 5: Update App.jsx layout**

```jsx
<div className="app-body">
  <Sidebar ... />
  {activePage === "scripts" && (
    <FolderTree
      folders={scriptData.folders}
      selectedFolder={selectedFolder}
      onSelectFolder={setSelectedFolder}
      onCreateFolder={handleCreateFolder}
      onRenameFolder={handleRenameFolder}
      onDeleteFolder={handleDeleteFolder}
      collapsed={folderTreeCollapsed}
      onToggleCollapse={() => setFolderTreeCollapsed(v => !v)}
    />
  )}
  <div className="app-page" style={{ display: activePage === "scripts" ? "contents" : "none" }}>
    <ScriptList
      folders={scriptData.folders}
      tags={scriptData.tags}
      selectedFolder={selectedFolder}
      statuses={statuses}
      selectedScript={selectedScript}
      onSelect={setSelectedScript}
      onRefresh={loadScripts}
      onEdit={handleEditScript}
    />
    <LogPanel ... />
  </div>
  ...
</div>
```

**Step 6: Update App.css**

Add CSS for the three-column layout when folder tree is visible:
```css
.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
```

No special grid needed — sidebar, folder-tree, and script-list are all flex children.

**Step 7: Add keyboard shortcut handler**

```jsx
useEffect(() => {
  const handler = (e) => {
    if (e.ctrlKey && e.key === "b") {
      e.preventDefault();
      setFolderTreeCollapsed(v => !v);
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

**Step 8: Auto-collapse on narrow window**

```jsx
useEffect(() => {
  const handleResize = () => {
    if (window.innerWidth < 1024) {
      setFolderTreeCollapsed(true);
    }
  };
  window.addEventListener("resize", handleResize);
  handleResize();
  return () => window.removeEventListener("resize", handleResize);
}, []);
```

**Step 9: Commit**

```bash
git add frontend/src/App.jsx frontend/src/App.css frontend/src/hooks/useWebSocket.js
git commit -m "feat: wire FolderTree into App with folder state management and keyboard shortcuts"
```

---

### Task 11: Frontend — Drag and Drop

**Files:**
- Modify: `frontend/src/components/ScriptCard.jsx`
- Modify: `frontend/src/components/FolderTree.jsx`
- Create: `frontend/src/components/Snackbar.jsx`
- Create: `frontend/src/components/Snackbar.css`

Enable drag-and-drop of ScriptCards onto FolderTree nodes.

**Step 1: ScriptCard — add draggable**

```jsx
// In ScriptCard, add:
<div
  draggable
  onDragStart={(e) => {
    e.dataTransfer.setData("application/json", JSON.stringify({
      name: script.name,
      folder: script.folder,
    }));
    e.dataTransfer.effectAllowed = "move";
  }}
  ...
>
```

**Step 2: FolderTree — add drop zones**

```jsx
// Each folder node:
<div
  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(folder.name); }}
  onDragLeave={() => setDragOver(null)}
  onDrop={(e) => {
    e.preventDefault();
    setDragOver(null);
    const data = JSON.parse(e.dataTransfer.getData("application/json"));
    if (data.folder !== folder.name) {
      onMoveScript(data.folder, data.name, folder.name);
    }
  }}
  className={`folder-node ${dragOver === folder.name ? "drag-over" : ""}`}
>
```

**Step 3: Snackbar component for undo**

Simple snackbar that auto-dismisses after 5 seconds with undo button:

```jsx
// frontend/src/components/Snackbar.jsx
export default function Snackbar({ message, onUndo, onDismiss }) { ... }
```

**Step 4: Wire undo in App.jsx**

```jsx
const [snackbar, setSnackbar] = useState(null);

const handleMoveScript = async (fromFolder, name, toFolder) => {
  await moveScript(fromFolder, name, toFolder);
  await loadScripts();
  setSnackbar({
    message: `已将 ${name} 移动到 ${toFolder}`,
    undo: () => moveScript(toFolder, name, fromFolder).then(loadScripts),
  });
};
```

**Step 5: Commit**

```bash
git add frontend/src/components/ScriptCard.jsx frontend/src/components/FolderTree.jsx \
    frontend/src/components/Snackbar.jsx frontend/src/components/Snackbar.css \
    frontend/src/App.jsx
git commit -m "feat: add drag-and-drop script movement with undo snackbar"
```

---

### Task 12: Frontend — Batch Operations

**Files:**
- Create: `frontend/src/components/BatchToolbar.jsx`
- Create: `frontend/src/components/BatchToolbar.css`
- Modify: `frontend/src/components/ScriptList.jsx`
- Create: `frontend/src/components/TagEditor.jsx`
- Create: `frontend/src/components/TagEditor.css`

Add multi-select mode with batch move and batch tag editing.

**Step 1: BatchToolbar component**

Shows when 1+ scripts are selected:
```
☑ 已选 3 个脚本   [移动到▾] [编辑标签] [取消]
```

**Step 2: TagEditor component**

A popover/modal with:
- Text input with autocomplete from global tag pool
- List of current tags with remove (×) button
- Add button
- Used both for batch editing and single-script tag editing from ScriptCard `···` menu

**Step 3: Wire into ScriptList**

```jsx
const [batchMode, setBatchMode] = useState(false);
const [selectedScripts, setSelectedScripts] = useState(new Set());

// Ctrl+A handler
useEffect(() => {
  const handler = (e) => {
    if (e.ctrlKey && e.key === "a" && activePage === "scripts") {
      e.preventDefault();
      setBatchMode(true);
      // Select all visible scripts
    }
  };
  ...
}, []);
```

**Step 4: Commit**

```bash
git add frontend/src/components/BatchToolbar.jsx frontend/src/components/BatchToolbar.css \
    frontend/src/components/TagEditor.jsx frontend/src/components/TagEditor.css \
    frontend/src/components/ScriptList.jsx
git commit -m "feat: add batch operations toolbar and tag editor"
```

---

### Task 13: Frontend — Empty States

**Files:**
- Create: `frontend/src/components/EmptyState.jsx`
- Create: `frontend/src/components/EmptyState.css`
- Modify: `frontend/src/components/ScriptList.jsx`
- Modify: `frontend/src/components/FolderTree.jsx`

**Step 1: EmptyState component**

Reusable empty state component:
```jsx
EmptyState({ icon, title, subtitle, action, onAction })
```

**Step 2: Use in ScriptList**

- No folders at all: "创建你的第一个文件夹" + button
- Empty folder: "这个文件夹还没有脚本" + "拖拽脚本到这里"
- No search results: "没有匹配的脚本" + clear filters link

**Step 3: Commit**

```bash
git add frontend/src/components/EmptyState.jsx frontend/src/components/EmptyState.css \
    frontend/src/components/ScriptList.jsx frontend/src/components/FolderTree.jsx
git commit -m "feat: add empty state designs for folders and script list"
```

---

### Task 14: Frontend — Sidebar Market Icon + FilesPanel Update

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`
- Modify: `frontend/src/components/FilesPanel.jsx`

**Step 1: Add market icon to Sidebar**

Add "market" entry to `navItems` between "editor" and "settings":
```jsx
{
  key: "market",
  label: "市场",
  icon: (/* store/shop SVG icon */),
}
```

**Step 2: Update FilesPanel for folder structure**

FilesPanel receives `folders` instead of flat `scripts`. Display table grouped by folder with folder name as section headers.

**Step 3: Add market placeholder page**

In App.jsx, add a placeholder for the market page:
```jsx
{mountedPages.market && (
  <div className="app-page" style={{ display: activePage === "market" ? "contents" : "none" }}>
    <EmptyState
      icon="🏪"
      title="脚本市场"
      subtitle="即将推出 — 发现和分享自动化脚本"
    />
  </div>
)}
```

**Step 4: Commit**

```bash
git add frontend/src/components/Sidebar.jsx frontend/src/components/FilesPanel.jsx frontend/src/App.jsx
git commit -m "feat: add market icon to sidebar, update FilesPanel for folder structure"
```

---

### Task 15: Backend — Keep Legacy API Compatibility

**Files:**
- Modify: `backend/app.py`

Keep the old `/api/scripts/{name}/run` and `/api/scripts/{name}/stop` endpoints working by mapping them to `_unsorted` folder. This prevents breaking any existing integrations during transition.

**Step 1: Add legacy route handlers**

```python
# Keep old routes working — map to _unsorted
@app.post("/api/scripts/{name}/run")
async def run_script_legacy(name: str):
    return await run_script_in_folder("_unsorted", name)

@app.post("/api/scripts/{name}/stop")
async def stop_script_legacy(name: str):
    return await stop_script_in_folder("_unsorted", name)
```

**Important:** These must be registered AFTER the `{folder}/{name}` routes so FastAPI matches the more specific routes first. In FastAPI, routes are matched in registration order, so place legacy routes at the bottom.

**Step 2: Verify old tests still pass**

Run: `pytest tests/test_app.py -v`
Expected: All PASS (both old and new tests)

**Step 3: Commit**

```bash
git add backend/app.py
git commit -m "feat: add legacy API compatibility routes mapping to _unsorted"
```

---

### Task 16: Integration Testing & Polish

**Files:**
- Run full test suite
- Manual testing checklist

**Step 1: Run all backend tests**

```bash
pytest -v
```
Expected: All PASS

**Step 2: Start dev environment and manual test**

```bash
npm run dev
```

Manual testing checklist:
- [ ] App loads with scripts organized in `_unsorted/` (migration worked)
- [ ] Folder tree displays correctly
- [ ] Click folder → shows only that folder's scripts
- [ ] Click "全部" → shows all scripts grouped
- [ ] Create new folder via `[+]` button
- [ ] Rename folder via double-click
- [ ] Delete empty folder
- [ ] Try to delete non-empty folder → shows error
- [ ] Drag script card to folder → moves successfully, snackbar appears
- [ ] Click undo on snackbar → script moves back
- [ ] `···` menu on script card → "移动到..." works
- [ ] Edit tags on a script → tags appear on card
- [ ] Click tag chip → filters by that tag
- [ ] Search matches name, description, tags
- [ ] `Ctrl+B` toggles folder tree
- [ ] Narrow window → folder tree auto-collapses, dropdown appears
- [ ] `Ctrl+A` enters batch mode, Esc exits
- [ ] Batch move multiple scripts
- [ ] Empty folder shows empty state
- [ ] Market icon in sidebar shows placeholder
- [ ] WebSocket: open two browser tabs, create folder in one → appears in other

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish and integration fixes for folder management"
```

---

## Summary

| Task | Area | Description |
|------|------|-------------|
| 1 | Backend | Metadata manager module (`.scripts-meta.json`) |
| 2 | Backend | Refactor scanner for folder-aware tree scanning |
| 3 | Backend | Migration script (root → `_unsorted/`) |
| 4 | Backend | Folder CRUD API endpoints |
| 5 | Backend | Script move/tags/description endpoints |
| 6 | Frontend | Update API client |
| 7 | Frontend | FolderTree component |
| 8 | Frontend | ScriptCard with tags/description/menu |
| 9 | Frontend | ScriptList folder-aware refactor |
| 10 | Frontend | Wire into App.jsx + WebSocket + keyboard |
| 11 | Frontend | Drag and drop |
| 12 | Frontend | Batch operations + tag editor |
| 13 | Frontend | Empty states |
| 14 | Frontend | Sidebar market icon + FilesPanel update |
| 15 | Backend | Legacy API compatibility |
| 16 | All | Integration testing & polish |

**Dependencies:** Tasks 1→2→3→4→5 (backend chain), Task 6 after 4+5, Tasks 7-14 after 6, Task 15 after 5, Task 16 last.

**Parallelizable:** Tasks 7, 8, 12, 13 can be built in parallel once Task 6 is done.
