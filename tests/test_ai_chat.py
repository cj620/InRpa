# tests/test_ai_chat.py
import pytest
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from backend.app import app
from backend.settings import DEFAULT_SETTINGS
from backend.ai_chat import build_system_prompt, stream_chat
import copy
import json


@pytest.mark.asyncio
async def test_ai_chat_no_config():
    """POST /api/ai/chat should return 400 if AI not configured."""
    # Ensure api_key is empty regardless of settings.json on disk
    mock_settings = copy.deepcopy(DEFAULT_SETTINGS)
    mock_settings["ai"]["api_key"] = ""

    with patch("backend.app.load_settings", return_value=mock_settings):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/ai/chat", json={
                "script_name": "test",
                "code": "print('hello')",
                "message": "add logging",
                "history": []
            })
        # Should return 400 when API key is empty
        assert resp.status_code == 400


def test_build_system_prompt_includes_capability_and_rules():
    prompt = build_system_prompt(
        capability={"python": {"ok": True, "version": "3.11.9"}},
        rules=["rule-a", "rule-b"],
    )
    assert "能力快照" in prompt
    assert "3.11.9" in prompt
    assert "rule-a" in prompt


@pytest.mark.asyncio
async def test_stream_chat_emits_validation_failed_event():
    mock_settings = copy.deepcopy(DEFAULT_SETTINGS)
    mock_settings["ai"]["api_key"] = "test-key"

    class FakeResponse:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            if False:
                yield ""

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def stream(self, *args, **kwargs):
            return FakeResponse()

    class FakeOrchestrator:
        async def generate(self, ctx):
            return {
                "status": "failed",
                "appliable": False,
                "code": "",
                "repair_attempts": 1,
                "validation_report": {
                    "issues": [{"code": "unsupported_import", "message": "检测到未允许依赖: selenium"}]
                },
            }

    with (
        patch("backend.ai_chat.load_settings", return_value=mock_settings),
        patch("backend.ai_chat.capability_service.get_snapshot", return_value={
            "python": {"ok": True, "version": "3.11.9"},
            "allowed_imports": {"stdlib": ["json"], "third_party": ["playwright"]},
        }),
        patch("backend.ai_chat.httpx.AsyncClient", return_value=FakeClient()),
        patch("backend.ai_chat.build_assistant_orchestrator", return_value=FakeOrchestrator()),
    ):
        chunks = [json.loads(item) async for item in stream_chat("print('x')", "打开网页", [])]

    assert chunks[0]["type"] == "validation_failed"
    assert chunks[0]["report"]["issues"][0]["code"] == "unsupported_import"
    assert chunks[-1]["type"] == "done"
