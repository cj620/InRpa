# tests/test_drafts.py
import os
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app, SCRIPTS_DIR


@pytest.fixture(autouse=True)
def setup_test_script(tmp_path, monkeypatch):
    """Create a temp scripts dir with a test script."""
    scripts_dir = str(tmp_path / "scripts")
    os.makedirs(scripts_dir)
    with open(os.path.join(scripts_dir, "example.py"), "w") as f:
        f.write("print('hello')\n")
    monkeypatch.setattr("backend.app.SCRIPTS_DIR", scripts_dir)
    yield scripts_dir


@pytest.mark.asyncio
async def test_get_script_content(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts/example/content")
    assert resp.status_code == 200
    assert resp.json()["content"] == "print('hello')\n"


@pytest.mark.asyncio
async def test_save_and_get_draft(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/scripts/example/draft", json={"content": "print('draft')\n"})
        assert resp.status_code == 200

        resp = await client.get("/api/scripts/example/draft")
        assert resp.status_code == 200
        assert resp.json()["content"] == "print('draft')\n"


@pytest.mark.asyncio
async def test_get_draft_not_found(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/scripts/example/draft")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_draft(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.put("/api/scripts/example/draft", json={"content": "x"})
        resp = await client.delete("/api/scripts/example/draft")
        assert resp.status_code == 200

        resp = await client.get("/api/scripts/example/draft")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_publish_draft(setup_test_script):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.put("/api/scripts/example/draft", json={"content": "print('published')\n"})
        resp = await client.post("/api/scripts/example/draft/publish")
        assert resp.status_code == 200

        resp = await client.get("/api/scripts/example/content")
        assert resp.json()["content"] == "print('published')\n"

        resp = await client.get("/api/scripts/example/draft")
        assert resp.status_code == 404
