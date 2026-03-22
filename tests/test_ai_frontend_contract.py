from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_local_api_forwards_validation_failed_chunks():
    source = (ROOT / "frontend/src/localApi.js").read_text(encoding="utf-8")

    assert 'else onChunk(data);' in source
    assert 'if (data.type === "done") onDone();' in source


def test_use_ai_chat_tracks_validation_failures():
    source = (ROOT / "frontend/src/hooks/useAIChat.js").read_text(encoding="utf-8")

    assert "lastValidationFailure" in source
    assert 'if (chunk.type === "validation_failed")' in source


def test_editor_page_shows_toast_on_validation_failure():
    source = (ROOT / "frontend/src/components/editor/EditorPage.jsx").read_text(encoding="utf-8")

    assert "aiChat.lastValidationFailure" in source
    assert "toast.error(" in source
