"""Validation helpers for generated Python scripts."""

from __future__ import annotations

import ast
import re
from typing import List, Dict


def validate_python_syntax(code: str) -> List[Dict[str, str]]:
    try:
        ast.parse(code)
        return []
    except SyntaxError as exc:
        return [{"code": "syntax_error", "message": str(exc)}]


def _collect_imports(code: str) -> list[str]:
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return []

    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append(node.module.split(".")[0])
    return imports


def validate_imports_against_capability(code: str, capability: dict, policy: str = "playwright_first") -> List[Dict[str, str]]:
    del policy
    allowed = capability.get("allowed_imports", {})
    allowed_stdlib = set(allowed.get("stdlib", []))
    allowed_third_party = set(allowed.get("third_party", []))
    issues: list[dict[str, str]] = []

    for module in _collect_imports(code):
        if module in allowed_stdlib or module in allowed_third_party:
            continue
        issues.append({
            "code": "unsupported_import",
            "message": f"检测到未允许依赖: {module}",
            "import": module,
            "suggestion": "请改为 Playwright 方案",
        })
    return issues


def _is_browser_automation_context(ctx: dict) -> bool:
    haystacks = [ctx.get("message", ""), ctx.get("code", "")]
    patterns = (
        "网页", "浏览器", "点击", "输入", "抓取页面", "playwright",
        "page.goto", "locator", "browser.new_page",
    )
    lowered = "\n".join(text.lower() for text in haystacks if text)
    return any(pattern.lower() in lowered for pattern in patterns)


def validate_playwright_preference(code: str, ctx: dict, capability: dict) -> List[Dict[str, str]]:
    del capability
    if not _is_browser_automation_context(ctx):
        return []

    imports = set(_collect_imports(code))
    if "playwright" in imports or re.search(r"\b(sync_playwright|async_playwright|page\.goto|locator)\b", code):
        return []
    if not imports:
        return []
    return [{
        "code": "playwright_required",
        "message": "当前项目浏览器自动化脚本必须优先使用 Playwright",
    }]


def validate_generated_code(code: str, ctx: dict) -> List[Dict[str, str]]:
    capability = ctx.get("capability", {})
    issues: list[dict[str, str]] = []
    issues.extend(validate_python_syntax(code))
    if issues:
        return issues
    issues.extend(validate_imports_against_capability(code, capability))
    issues.extend(validate_playwright_preference(code, ctx, capability))
    return issues


class GeneratedCodeValidator:
    def validate(self, code: str, ctx: dict) -> List[Dict[str, str]]:
        return validate_generated_code(code, ctx)
