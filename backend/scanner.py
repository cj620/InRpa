"""Scan scripts directory for available Python scripts."""

import os
from datetime import datetime

from backend.drafts import has_draft as check_has_draft


def scan_scripts(directory: str) -> list[dict]:
    """Scan directory for .py files and return metadata list.

    Returns production scripts and draft scripts as separate entries.
    Draft scripts have is_draft=True and parent_name pointing to the production script.
    """
    scripts = []

    if not os.path.isdir(directory):
        return scripts

    for filename in sorted(os.listdir(directory)):
        if not filename.endswith(".py"):
            continue
        if filename.startswith("__"):
            continue
        if filename == "config.py":
            continue

        filepath = os.path.join(directory, filename)
        if not os.path.isfile(filepath):
            continue

        stat = os.stat(filepath)
        name = filename[:-3]  # remove .py
        is_draft = name.endswith("_draft")

        entry = {
            "name": name,
            "path": filepath,
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
            "is_draft": is_draft,
        }

        if is_draft:
            entry["parent_name"] = name[:-6]  # remove _draft suffix
        else:
            entry["has_draft"] = check_has_draft(directory, name)

        scripts.append(entry)

    return scripts
