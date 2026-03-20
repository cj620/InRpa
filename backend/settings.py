"""Settings persistence — read/write settings.json."""

import copy
import json
import logging
import os
import tempfile

logger = logging.getLogger(__name__)

SETTINGS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "settings.json")

DEFAULT_SETTINGS = {
    "ai": {
        "provider": "openai",
        "api_url": "https://api.openai.com/v1",
        "api_key": "",
        "model": "gpt-4o"
    },
    "editor": {
        "font_size": 14,
        "tab_size": 4,
        "word_wrap": True
    },
    "scripts_dir": "./scripts"
}


def _deep_merge(base: dict, override: dict) -> dict:
    """Deep merge override into base, returning a new dict."""
    result = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def load_settings() -> dict:
    """Load settings from file, creating default if not exists.

    Merges saved settings over defaults so newly added default keys
    are always present.
    """
    if not os.path.exists(SETTINGS_PATH):
        save_settings(DEFAULT_SETTINGS)
        return copy.deepcopy(DEFAULT_SETTINGS)
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            saved = json.load(f)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Corrupt settings.json, falling back to defaults: %s", exc)
        return copy.deepcopy(DEFAULT_SETTINGS)
    return _deep_merge(DEFAULT_SETTINGS, saved)


def save_settings(settings: dict) -> dict:
    """Merge partial settings update and save to file."""
    current = copy.deepcopy(DEFAULT_SETTINGS)
    if os.path.exists(SETTINGS_PATH):
        try:
            with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
            current = _deep_merge(DEFAULT_SETTINGS, saved)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Corrupt settings.json during save, using defaults: %s", exc)
    # Deep merge the incoming partial update
    current = _deep_merge(current, settings)
    # Atomic write: write to temp file then rename
    dir_name = os.path.dirname(SETTINGS_PATH)
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, SETTINGS_PATH)
    except BaseException:
        # Clean up temp file on failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
    return current
