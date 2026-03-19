# tests/test_app.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app


@pytest.mark.asyncio
async def test_list_scripts():
    """GET /api/scripts should return a list."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_run_nonexistent_script():
    """POST /api/scripts/nonexistent/run should return 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/nonexistent/run")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_stop_idle_script():
    """POST /api/scripts/somescript/stop should return 400 if not running."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/somescript/stop")

    assert resp.status_code == 400
