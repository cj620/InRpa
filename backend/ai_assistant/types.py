"""Types for AI assistant capability snapshot."""

from typing import TypedDict


class CheckResult(TypedDict, total=False):
    ok: bool
    version: str
    chromium: str
    status: int
    error: str


class CapabilitySnapshot(TypedDict, total=False):
    timestamp: str
    stale: bool
    python: CheckResult
    node: CheckResult
    venv: CheckResult
    playwright: CheckResult
    cloudBackend: CheckResult
    packages: dict[str, dict]
    allowed_imports: dict[str, list[str]]
