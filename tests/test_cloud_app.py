# tests/test_cloud_app.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.cloud_app import app


@pytest.mark.asyncio
async def test_list_scripts_has_hash():
    """GET /api/scripts must return hash field on each script."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # hash field present on non-draft scripts
    for s in data:
        if not s.get("is_draft"):
            assert "hash" in s, f"Missing hash on script {s.get('name')}"


@pytest.mark.asyncio
async def test_script_content_returns_content():
    """GET /api/scripts/{name}/content on missing script returns 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts/nonexistent_xyz/content")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_no_run_endpoint():
    """cloud_app must NOT expose /api/scripts/{name}/run."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts/anything/run")
    assert resp.status_code == 404
