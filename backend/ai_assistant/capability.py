"""Capability snapshot service with simple TTL caching."""

from __future__ import annotations

from datetime import datetime, timezone
import importlib
import importlib.metadata
import sys
import time


PLAYWRIGHT_PACKAGE_MAP = {
    "playwright": {"import_name": "playwright", "category": "playwright"},
    "playwright-stealth": {"import_name": "playwright_stealth", "category": "playwright_ecosystem"},
}


class CapabilityService:
    def __init__(self, ttl_sec: int = 60):
        self.ttl_sec = ttl_sec
        self._cached_snapshot: dict | None = None
        self._cached_at = 0.0

    def _probe(self) -> dict:
        packages: dict[str, dict] = {}
        allowed_imports = {
            "stdlib": sorted(getattr(sys, "stdlib_module_names", set())),
            "third_party": [],
        }

        python = {
            "ok": True,
            "version": ".".join(str(part) for part in sys.version_info[:3]),
        }

        playwright = self._probe_playwright()
        for dist_name, meta in PLAYWRIGHT_PACKAGE_MAP.items():
            pkg = self._probe_package(dist_name, meta["category"])
            if pkg["ok"]:
                packages[dist_name] = pkg
                allowed_imports["third_party"].append(meta["import_name"])

        if playwright.get("ok"):
            packages["playwright"] = {
                "ok": True,
                "version": playwright.get("version", ""),
                "category": "playwright",
            }
            if "playwright" not in allowed_imports["third_party"]:
                allowed_imports["third_party"].append("playwright")

        allowed_imports["third_party"] = sorted(set(allowed_imports["third_party"]))
        return {
            "python": python,
            "playwright": playwright,
            "packages": packages,
            "allowed_imports": allowed_imports,
        }

    def _probe_package(self, dist_name: str, category: str) -> dict:
        try:
            version = importlib.metadata.version(dist_name)
        except importlib.metadata.PackageNotFoundError:
            return {"ok": False, "error": f"{dist_name} not installed", "category": category}
        return {"ok": True, "version": version, "category": category}

    def _probe_playwright(self) -> dict:
        try:
            version = importlib.metadata.version("playwright")
        except importlib.metadata.PackageNotFoundError:
            return {"ok": False, "error": "playwright not installed"}

        try:
            from playwright.sync_api import sync_playwright
        except Exception as exc:  # pragma: no cover - import error path covered by version lookup branch
            return {"ok": False, "version": version, "error": str(exc)}

        try:
            with sync_playwright() as pw:
                return {"ok": True, "version": version, "chromium": pw.chromium.name}
        except Exception as exc:
            return {"ok": False, "version": version, "error": str(exc)}

    def _normalize_raw(self, raw: dict) -> dict:
        snapshot = dict(raw)
        snapshot["timestamp"] = datetime.now(timezone.utc).isoformat()
        return snapshot

    def get_snapshot(self, force_refresh: bool = False) -> dict:
        now = time.time()
        if (
            not force_refresh
            and self._cached_snapshot is not None
            and now - self._cached_at < self.ttl_sec
        ):
            return {**self._cached_snapshot, "stale": False}

        normalized = self._normalize_raw(self._probe())
        self._cached_snapshot = normalized
        self._cached_at = now
        return {**normalized, "stale": False}
