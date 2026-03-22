"""Validation helpers for generated Python scripts."""

from __future__ import annotations

import ast
from typing import List, Dict


def validate_python_syntax(code: str) -> List[Dict[str, str]]:
    try:
        ast.parse(code)
        return []
    except SyntaxError as exc:
        return [{"code": "syntax_error", "message": str(exc)}]

