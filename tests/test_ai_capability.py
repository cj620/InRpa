import time

from backend.ai_assistant.capability import CapabilityService


def test_capability_snapshot_contains_required_keys():
    service = CapabilityService(ttl_sec=60)
    snap = service._normalize_raw({
        "python": {"ok": True, "version": "3.11.9"},
        "venv": {"ok": True},
        "playwright": {"ok": True, "version": "1.50.1", "chromium": "chromium"},
        "node": {"ok": True, "version": "22.13.0"},
        "cloudBackend": {"ok": True, "status": 200},
        "packages": {
            "playwright": {"ok": True, "version": "1.50.1", "category": "playwright"},
        },
        "allowed_imports": {
            "stdlib": ["json", "os"],
            "third_party": ["playwright"],
        },
    })
    assert "timestamp" in snap
    assert snap["python"]["ok"] is True
    assert snap["playwright"]["version"] == "1.50.1"
    assert snap["allowed_imports"]["third_party"] == ["playwright"]
    assert "playwright" in snap["packages"]


def test_capability_snapshot_uses_cache_within_ttl(monkeypatch):
    service = CapabilityService(ttl_sec=60)
    calls = {"n": 0}

    def fake_probe():
        calls["n"] += 1
        return {"python": {"ok": True, "version": "3.11.9"}}

    monkeypatch.setattr(service, "_probe", fake_probe)
    service.get_snapshot()
    service.get_snapshot()
    assert calls["n"] == 1


def test_capability_snapshot_refreshes_after_ttl(monkeypatch):
    service = CapabilityService(ttl_sec=1)
    calls = {"n": 0}

    def fake_probe():
        calls["n"] += 1
        return {"python": {"ok": True, "version": "3.11.9"}}

    monkeypatch.setattr(service, "_probe", fake_probe)
    service.get_snapshot()
    time.sleep(1.05)
    service.get_snapshot()
    assert calls["n"] == 2


def test_capability_snapshot_builds_allowed_imports_from_probe(monkeypatch):
    service = CapabilityService(ttl_sec=60)

    monkeypatch.setattr(service, "_probe", lambda: {
        "python": {"ok": True, "version": "3.11.9"},
        "playwright": {"ok": True, "version": "1.52.0", "chromium": "chromium"},
        "packages": {
            "playwright": {"ok": True, "version": "1.52.0", "category": "playwright"},
            "playwright-stealth": {"ok": True, "version": "1.0.6", "category": "playwright_ecosystem"},
        },
        "allowed_imports": {
            "stdlib": ["json", "asyncio"],
            "third_party": ["playwright", "playwright_stealth"],
        },
    })

    snap = service.get_snapshot(force_refresh=True)

    assert "playwright" in snap["allowed_imports"]["third_party"]
    assert "playwright_stealth" in snap["allowed_imports"]["third_party"]
