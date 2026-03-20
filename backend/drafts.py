"""Draft management — drafts stored as {name}_draft.py alongside production scripts."""

import os
import shutil


def _draft_path(scripts_dir: str, name: str) -> str:
    """Return the draft file path: scripts/{name}_draft.py"""
    return os.path.join(scripts_dir, f"{name}_draft.py")


def read_script_content(scripts_dir: str, name: str) -> str | None:
    """Read production script content. Returns None if not found."""
    path = os.path.join(scripts_dir, f"{name}.py")
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def read_draft(scripts_dir: str, name: str) -> str | None:
    """Read draft content. Returns None if no draft exists."""
    path = _draft_path(scripts_dir, name)
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def save_draft(scripts_dir: str, name: str, content: str) -> None:
    """Save draft content as {name}_draft.py in scripts directory."""
    path = _draft_path(scripts_dir, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def delete_draft(scripts_dir: str, name: str) -> bool:
    """Delete draft. Returns True if existed and was deleted."""
    path = _draft_path(scripts_dir, name)
    if os.path.isfile(path):
        os.remove(path)
        return True
    return False


def publish_draft(scripts_dir: str, name: str) -> bool:
    """Replace production script with draft, then delete draft."""
    draft = _draft_path(scripts_dir, name)
    prod = os.path.join(scripts_dir, f"{name}.py")
    if not os.path.isfile(draft):
        return False
    shutil.copy2(draft, prod)
    os.remove(draft)
    return True


def has_draft(scripts_dir: str, name: str) -> bool:
    """Check if a draft exists for the given script."""
    return os.path.isfile(_draft_path(scripts_dir, name))


def get_draft_path(scripts_dir: str, name: str) -> str:
    """Return the draft file path (for use by runner)."""
    return _draft_path(scripts_dir, name)
