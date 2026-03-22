from backend.ai_assistant.skills import BaseSkill, SkillPipeline, SkillRegistry
import pytest
from backend.ai_assistant.pipeline import AssistantOrchestrator
from backend.ai_assistant.validators import (
    validate_generated_code,
    validate_imports_against_capability,
    validate_playwright_preference,
)


def test_skill_before_prompt_runs_in_configured_order():
    events = []

    class S1(BaseSkill):
        name = "s1"

        def before_prompt(self, ctx):
            events.append("s1")
            return {"system_rules": ["r1"]}

    class S2(BaseSkill):
        name = "s2"

        def before_prompt(self, ctx):
            events.append("s2")
            return {"system_rules": ["r2"]}

    registry = SkillRegistry([S1(), S2()])
    pipeline = SkillPipeline(registry, enabled=["s2", "s1"], order=["s2", "s1"])
    rules = pipeline.build_prompt_rules({"request": {}})

    assert events == ["s2", "s1"]
    assert rules == ["r2", "r1"]


@pytest.mark.asyncio
async def test_pipeline_retries_once_then_blocks():
    class FakeValidator:
        def validate(self, code, ctx):
            return [{"code": "bad"}]

    class FakeLLM:
        def __init__(self):
            self.calls = []

        async def generate(self, ctx):
            self.calls.append("generate")
            return "bad_code"

        async def repair(self, ctx, code, issues):
            self.calls.append("repair")
            return "still_bad"

    orch = AssistantOrchestrator(
        validator=FakeValidator(),
        llm=FakeLLM(),
        max_repair_attempts=1,
    )
    result = await orch.generate({"message": "x"})
    assert result["status"] == "failed"
    assert result["repair_attempts"] == 1
    assert result["appliable"] is False


def test_validate_imports_rejects_unknown_dependency():
    capability = {
        "allowed_imports": {
            "stdlib": ["json", "os"],
            "third_party": ["playwright"],
        }
    }

    issues = validate_imports_against_capability(
        "import selenium\nfrom bs4 import BeautifulSoup\n",
        capability,
    )

    assert [issue["import"] for issue in issues] == ["selenium", "bs4"]


def test_validate_playwright_preference_requires_playwright_for_browser_tasks():
    capability = {
        "allowed_imports": {
            "stdlib": ["json"],
            "third_party": ["playwright"],
        }
    }
    ctx = {
        "message": "打开网页并点击登录按钮，抓取页面数据",
        "code": "",
    }

    issues = validate_playwright_preference(
        "import selenium\n",
        ctx,
        capability,
    )

    assert issues[0]["code"] == "playwright_required"


def test_validate_generated_code_allows_playwright_and_stdlib():
    capability = {
        "allowed_imports": {
            "stdlib": ["json", "asyncio"],
            "third_party": ["playwright"],
        }
    }
    ctx = {
        "message": "使用 Playwright 打开网页",
        "code": "from playwright.sync_api import sync_playwright\n",
        "capability": capability,
    }

    issues = validate_generated_code(
        "import json\nfrom playwright.sync_api import sync_playwright\n",
        ctx,
    )

    assert issues == []
