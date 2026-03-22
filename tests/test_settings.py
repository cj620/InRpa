# tests/test_settings.py
import json
import pytest
from httpx import AsyncClient, ASGITransport

import backend.settings as settings_mod
from backend.app import app


@pytest.fixture(autouse=True)
def isolated_settings(tmp_path, monkeypatch):
    """Redirect SETTINGS_PATH to a temp directory so tests never touch the real file."""
    tmp_settings = str(tmp_path / "settings.json")
    monkeypatch.setattr(settings_mod, "SETTINGS_PATH", tmp_settings)


@pytest.mark.asyncio
async def test_get_settings():
    """GET /api/settings should return settings dict."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "ai" in data
    assert "editor" in data


@pytest.mark.asyncio
async def test_update_settings():
    """PUT /api/settings should update and persist settings."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/settings", json={
            "ai": {
                "provider": "anthropic",
                "api_url": "https://api.anthropic.com/v1",
                "api_key": "sk-test",
                "model": "claude-sonnet-4-20250514"
            }
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ai"]["provider"] == "anthropic"


@pytest.mark.asyncio
async def test_corrupt_settings_returns_defaults(tmp_path, monkeypatch):
    """load_settings should return defaults when settings.json is corrupt."""
    corrupt_path = str(tmp_path / "settings.json")
    monkeypatch.setattr(settings_mod, "SETTINGS_PATH", corrupt_path)
    with open(corrupt_path, "w") as f:
        f.write("{invalid json!!")
    result = settings_mod.load_settings()
    assert result == settings_mod.DEFAULT_SETTINGS


@pytest.mark.asyncio
async def test_load_merges_with_defaults(tmp_path, monkeypatch):
    """load_settings should merge saved settings over defaults so new keys appear."""
    saved_path = str(tmp_path / "settings.json")
    monkeypatch.setattr(settings_mod, "SETTINGS_PATH", saved_path)
    # Save a file missing the 'editor' key entirely
    with open(saved_path, "w") as f:
        json.dump({"ai": {"provider": "anthropic"}}, f)
    result = settings_mod.load_settings()
    # Should have the saved value
    assert result["ai"]["provider"] == "anthropic"
    # Should also have defaults for missing keys
    assert "editor" in result
    assert result["editor"]["font_size"] == 14


@pytest.mark.asyncio
async def test_theme_in_default_settings():
    """Default settings should include theme field."""
    result = settings_mod.load_settings()
    assert result["theme"] == "dark"


@pytest.mark.asyncio
async def test_update_theme_setting():
    """PUT /api/settings should persist theme choice."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/settings", json={"theme": "light"})
    assert resp.status_code == 200
    assert resp.json()["theme"] == "light"


def test_default_settings_not_mutated():
    """save_settings must not mutate DEFAULT_SETTINGS."""
    import copy
    original = copy.deepcopy(settings_mod.DEFAULT_SETTINGS)
    # Call save with a nested update — should not alter DEFAULT_SETTINGS
    settings_mod.save_settings({"ai": {"provider": "changed"}})
    assert settings_mod.DEFAULT_SETTINGS == original


def test_default_settings_include_ai_assistant():
    cfg = settings_mod.DEFAULT_SETTINGS
    assert "ai_assistant" in cfg
    ai_assistant = cfg["ai_assistant"]
    assert ai_assistant["capability_ttl_sec"] == 60
    assert ai_assistant["auto_repair_max_attempts"] == 1
    assert ai_assistant["skills"]["enabled"] == []
