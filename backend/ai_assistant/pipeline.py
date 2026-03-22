"""Orchestrate generation, validation, and one-shot repair."""

from __future__ import annotations

import re


CODE_BLOCK_RE = re.compile(r"```(?:python)?\n([\s\S]*?)```", re.IGNORECASE)


def extract_code(text: str) -> str:
    match = CODE_BLOCK_RE.search(text or "")
    if match:
        return match.group(1).rstrip()
    return (text or "").strip()


class AssistantOrchestrator:
    def __init__(self, validator, llm, max_repair_attempts: int = 1):
        self.validator = validator
        self.llm = llm
        self.max_repair_attempts = max_repair_attempts

    async def generate(self, ctx: dict) -> dict:
        content = await self.llm.generate(ctx)
        code = extract_code(content)
        issues = self.validator.validate(code, ctx)
        attempts = 0

        while issues and attempts < self.max_repair_attempts:
            attempts += 1
            repaired = await self.llm.repair(ctx, code, issues)
            content = repaired
            code = extract_code(repaired)
            issues = self.validator.validate(code, ctx)

        passed = len(issues) == 0
        return {
            "status": "passed" if passed else "failed",
            "appliable": passed,
            "content": content,
            "code": code,
            "repair_attempts": attempts,
            "validation_report": {"issues": issues},
        }
