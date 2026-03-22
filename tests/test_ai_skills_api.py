import pytest
from httpx import AsyncClient, ASGITransport

import backend.settings as settings_mod
from backend.local_app import app


@pytest.fixture(autouse=True)
def isolated_settings(tmp_path, monkeypatch):
    tmp_settings = str(tmp_path / "settings.json")
    monkeypatch.setattr(settings_mod, "SETTINGS_PATH", tmp_settings)


@pytest.mark.asyncio
async def test_get_ai_capability_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/ai/capability")
    assert resp.status_code == 200
    data = resp.json()
    assert "python" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_put_ai_skills_updates_settings():
    payload = {
        "enabled": ["runtime_guard"],
        "order": ["runtime_guard"],
        "configs": {"runtime_guard": {"strict": True}},
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/ai/skills", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["skills"]["enabled"] == ["runtime_guard"]
    assert body["skills"]["order"] == ["runtime_guard"]
