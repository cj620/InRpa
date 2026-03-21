# tests/test_local_app.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.local_app import app


@pytest.mark.asyncio
async def test_run_nonexistent_script():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/nonexistent_xyz/run")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_stop_idle_script():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/somescript/stop")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_sync_offline_returns_cache():
    """POST /api/sync with unreachable cloud_url should return using_cache=true."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/sync", json={"cloud_url": "http://127.0.0.1:19999"})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("using_cache") is True


@pytest.mark.asyncio
async def test_no_folder_management():
    """local_app must NOT expose folder management endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/folders", json={"name": "test"})
    assert resp.status_code == 404
