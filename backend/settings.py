"""Settings persistence — read/write settings.json."""

import json
import os

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


def load_settings() -> dict:
    """Load settings from file, creating default if not exists."""
    if not os.path.exists(SETTINGS_PATH):
        save_settings(DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS.copy()
    with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_settings(settings: dict) -> dict:
    """Merge partial settings update and save to file."""
    current = DEFAULT_SETTINGS.copy()
    if os.path.exists(SETTINGS_PATH):
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            current = json.load(f)
    # Deep merge top-level keys
    for key, value in settings.items():
        if isinstance(value, dict) and isinstance(current.get(key), dict):
            current[key].update(value)
        else:
            current[key] = value
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2, ensure_ascii=False)
    return current
