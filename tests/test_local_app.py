# tests/test_local_app.py
import os
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


@pytest.mark.asyncio
async def test_create_script():
    """POST /api/scripts should create a .py file with template content."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts", json={"name": "test_new_script", "folder": "测试"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "test_new_script"
    assert data["folder"] == "测试"
    # Verify file exists
    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")
    script_path = os.path.join(scripts_dir, "test_new_script.py")
    assert os.path.exists(script_path)
    with open(script_path) as f:
        content = f.read()
    assert "def main():" in content
    assert 'if __name__ == "__main__":' in content
    # Cleanup
    os.remove(script_path)


@pytest.mark.asyncio
async def test_create_script_duplicate():
    """Creating a script that already exists should return 409."""
    transport = ASGITransport(app=app)
    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")
    script_path = os.path.join(scripts_dir, "dup_test.py")
    # Ensure clean state
    if os.path.exists(script_path):
        os.remove(script_path)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First create
        await client.post("/api/scripts", json={"name": "dup_test", "folder": "测试"})
        # Second create - should fail
        resp = await client.post("/api/scripts", json={"name": "dup_test", "folder": "测试"})
    assert resp.status_code == 409
    # Cleanup
    if os.path.exists(script_path):
        os.remove(script_path)


@pytest.mark.asyncio
async def test_create_script_invalid_name():
    """Empty or invalid script names should return 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts", json={"name": "", "folder": "测试"})
    assert resp.status_code == 400

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts", json={"name": "__system", "folder": "测试"})
    assert resp.status_code == 400
