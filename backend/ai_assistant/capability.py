"""Capability snapshot service with simple TTL caching."""

from __future__ import annotations

from datetime import datetime, timezone
import time


class CapabilityService:
    def __init__(self, ttl_sec: int = 60):
        self.ttl_sec = ttl_sec
        self._cached_snapshot: dict | None = None
        self._cached_at = 0.0

    def _probe(self) -> dict:
        # Placeholder probing data; to be replaced by real environment probing.
        return {"python": {"ok": False, "error": "not_implemented"}}

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

