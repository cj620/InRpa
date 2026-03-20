"""Draft management — CRUD for script drafts in .drafts/ directory."""

import os
import shutil


def get_drafts_dir(scripts_dir: str) -> str:
    """Return path to .drafts/ directory, creating if needed."""
    drafts_dir = os.path.join(scripts_dir, ".drafts")
    os.makedirs(drafts_dir, exist_ok=True)
    return drafts_dir


def read_script_content(scripts_dir: str, name: str) -> str | None:
    """Read production script content. Returns None if not found."""
    path = os.path.join(scripts_dir, f"{name}.py")
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def read_draft(scripts_dir: str, name: str) -> str | None:
    """Read draft content. Returns None if no draft exists."""
    path = os.path.join(get_drafts_dir(scripts_dir), f"{name}.py")
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def save_draft(scripts_dir: str, name: str, content: str) -> None:
    """Save draft content."""
    path = os.path.join(get_drafts_dir(scripts_dir), f"{name}.py")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def delete_draft(scripts_dir: str, name: str) -> bool:
    """Delete draft. Returns True if existed and was deleted."""
    path = os.path.join(get_drafts_dir(scripts_dir), f"{name}.py")
    if os.path.isfile(path):
        os.remove(path)
        return True
    return False


def publish_draft(scripts_dir: str, name: str) -> bool:
    """Replace production script with draft, then delete draft."""
    draft_path = os.path.join(get_drafts_dir(scripts_dir), f"{name}.py")
    prod_path = os.path.join(scripts_dir, f"{name}.py")
    if not os.path.isfile(draft_path):
        return False
    shutil.copy2(draft_path, prod_path)
    os.remove(draft_path)
    return True


def has_draft(scripts_dir: str, name: str) -> bool:
    """Check if a draft exists for the given script."""
    path = os.path.join(get_drafts_dir(scripts_dir), f"{name}.py")
    return os.path.isfile(path)
