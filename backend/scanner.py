"""Scan scripts directory for available Python scripts."""

import os
from datetime import datetime


def scan_scripts(directory: str) -> list[dict]:
    """Scan directory for .py files and return metadata list."""
    scripts = []

    if not os.path.isdir(directory):
        return scripts

    for filename in sorted(os.listdir(directory)):
        if not filename.endswith(".py"):
            continue
        if filename.startswith("__"):
            continue

        filepath = os.path.join(directory, filename)
        if not os.path.isfile(filepath):
            continue

        stat = os.stat(filepath)
        scripts.append({
            "name": filename[:-3],  # remove .py
            "path": filepath,
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        })

    return scripts
