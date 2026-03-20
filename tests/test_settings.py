# tests/test_settings.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app


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
