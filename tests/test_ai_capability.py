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
    })
    assert "timestamp" in snap
    assert snap["python"]["ok"] is True
    assert snap["playwright"]["version"] == "1.50.1"


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
