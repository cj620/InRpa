# tests/test_scanner.py
import os
import tempfile
import pytest
from backend.scanner import scan_scripts


def test_scan_finds_py_files(tmp_path):
    """Scanner should find .py files in directory."""
    (tmp_path / "script_a.py").write_text("print('a')")
    (tmp_path / "script_b.py").write_text("print('b')")
    (tmp_path / "readme.txt").write_text("not a script")

    result = scan_scripts(str(tmp_path))

    assert len(result) == 2
    names = [s["name"] for s in result]
    assert "script_a" in names
    assert "script_b" in names


def test_scan_returns_metadata(tmp_path):
    """Each script entry should have name, path, size, modified_at."""
    (tmp_path / "demo.py").write_text("print('hello')")

    result = scan_scripts(str(tmp_path))

    assert len(result) == 1
    script = result[0]
    assert script["name"] == "demo"
    assert script["path"].endswith("demo.py")
    assert isinstance(script["size"], int)
    assert isinstance(script["modified_at"], str)


def test_scan_empty_dir(tmp_path):
    """Scanner should return empty list for empty directory."""
    result = scan_scripts(str(tmp_path))
    assert result == []


def test_scan_ignores_dunder_files(tmp_path):
    """Scanner should ignore __init__.py and similar."""
    (tmp_path / "__init__.py").write_text("")
    (tmp_path / "__pycache__").mkdir()
    (tmp_path / "real_script.py").write_text("print('hi')")

    result = scan_scripts(str(tmp_path))

    assert len(result) == 1
    assert result[0]["name"] == "real_script"
