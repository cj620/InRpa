from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_shoppesclaw_uses_current_playwright_stealth_api():
    source = (ROOT / "scripts/shoppesclaw.py").read_text(encoding="utf-8")

    assert "from playwright_stealth.stealth import Stealth" in source
    assert "from playwright_stealth import stealth_async" not in source
    assert "apply_stealth_async(page)" in source
