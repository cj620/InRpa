"""Orchestrate generation, validation, and one-shot repair."""

from __future__ import annotations


class AssistantOrchestrator:
    def __init__(self, validator, llm, max_repair_attempts: int = 1):
        self.validator = validator
        self.llm = llm
        self.max_repair_attempts = max_repair_attempts

    async def generate(self, ctx: dict) -> dict:
        code = await self.llm.generate(ctx)
        issues = self.validator.validate(code, ctx)
        attempts = 0

        while issues and attempts < self.max_repair_attempts:
            attempts += 1
            code = await self.llm.repair(ctx, code, issues)
            issues = self.validator.validate(code, ctx)

        passed = len(issues) == 0
        return {
            "status": "passed" if passed else "failed",
            "appliable": passed,
            "code": code,
            "repair_attempts": attempts,
            "validation_report": {"issues": issues},
        }

