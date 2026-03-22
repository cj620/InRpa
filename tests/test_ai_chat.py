# tests/test_ai_chat.py
import pytest
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from backend.app import app
from backend.settings import DEFAULT_SETTINGS
from backend.ai_chat import build_system_prompt
import copy


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
