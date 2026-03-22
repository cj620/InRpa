"""AI chat — generate code under capability constraints and stream SSE events."""

from __future__ import annotations

import json

import httpx

from backend.ai_assistant.capability import CapabilityService
from backend.ai_assistant.pipeline import AssistantOrchestrator
from backend.ai_assistant.validators import GeneratedCodeValidator
from backend.settings import load_settings

SYSTEM_PROMPT = """你是一个 Python 脚本助手。用户会给你一段 Python 脚本代码和修改需求。

规则：
1. 仔细理解用户的修改需求
2. 返回修改后的完整代码（不是片段）
3. 用中文解释你做了什么修改
4. 代码放在 ```python ``` 代码块中

格式示例：
我已经做了以下修改：
- 修改点1
- 修改点2

```python
# 完整的修改后代码
```"""

BROWSER_AUTOMATION_HINTS = (
    "网页", "浏览器", "点击", "输入", "抓取页面", "Playwright",
    "page.goto", "locator", "browser.new_page",
)

capability_service = CapabilityService()


def build_system_prompt(capability: dict | None = None, rules: list[str] | None = None) -> str:
    if not capability and not rules:
        return SYSTEM_PROMPT

    chunks = [SYSTEM_PROMPT]
    if capability:
        chunks.append("\n\n当前运行环境能力快照（真实约束，必须遵守）：")
        chunks.append(json.dumps(capability, ensure_ascii=False))
        allowed_imports = capability.get("allowed_imports", {})
        stdlib_preview = ", ".join(allowed_imports.get("stdlib", [])[:12])
        third_party = ", ".join(allowed_imports.get("third_party", [])) or "无"
        chunks.append(
            "\n允许依赖范围：Python 标准库"
            + (f"（示例：{stdlib_preview}）" if stdlib_preview else "")
            + f"；第三方仅允许：{third_party}"
        )
    if rules:
        chunks.append("\n\nSkill 规则补充：")
        chunks.extend([f"- {rule}" for rule in rules])
    chunks.append("\n\n严禁编造未确认可用的依赖或环境能力。")
    return "\n".join(chunks)


def build_messages(code: str, message: str, history: list, system_prompt: str | None = None) -> list:
    """Build message list for LLM API."""
    messages = [{"role": "system", "content": system_prompt or SYSTEM_PROMPT}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    user_content = f"当前脚本代码：\n```python\n{code}\n```\n\n用户需求：{message}"
    messages.append({"role": "user", "content": user_content})
    return messages


def _is_browser_automation_request(code: str, message: str) -> bool:
    haystack = f"{code}\n{message}".lower()
    return any(hint.lower() in haystack for hint in BROWSER_AUTOMATION_HINTS)


class CapabilityConstrainedLLM:
    def __init__(self, *, api_url: str, api_key: str, model: str, provider: str):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.provider = provider

    async def generate(self, ctx: dict) -> str:
        system_prompt = build_system_prompt(ctx["capability"], ctx["rules"])
        messages = build_messages(ctx["code"], ctx["message"], ctx["history"], system_prompt=system_prompt)
        return await self._complete(messages, system_prompt=system_prompt)

    async def repair(self, ctx: dict, code: str, issues: list[dict]) -> str:
        issues_json = json.dumps(issues, ensure_ascii=False)
        repair_rules = list(ctx["rules"]) + [
            "你必须删除所有未允许的第三方依赖 import",
            "如果任务涉及浏览器自动化，必须改写为 Playwright 方案",
            "保持用户需求功能语义不变",
            "若原代码已使用 Playwright，请延续原有风格",
        ]
        system_prompt = build_system_prompt(ctx["capability"], repair_rules)
        repair_request = (
            f"当前代码未通过环境校验。请根据以下问题修复并返回完整回答。\n"
            f"校验问题：{issues_json}\n\n"
            f"原始用户需求：{ctx['message']}\n\n"
            f"待修复代码：\n```python\n{code}\n```"
        )
        messages = [{"role": "system", "content": system_prompt}]
        for msg in ctx["history"]:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": repair_request})
        return await self._complete(messages, system_prompt=system_prompt)

    async def _complete(self, messages: list[dict], system_prompt: str) -> str:
        if self.provider == "anthropic":
            url = f"{self.api_url}/messages"
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            body = {
                "model": self.model,
                "max_tokens": 4096,
                "stream": False,
                "system": system_prompt,
                "messages": [m for m in messages if m["role"] != "system"],
            }
        else:
            url = f"{self.api_url}/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            body = {
                "model": self.model,
                "stream": False,
                "messages": messages,
            }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
        if self.provider == "anthropic":
            parts = payload.get("content", [])
            return "".join(part.get("text", "") for part in parts if part.get("type") == "text")
        return payload.get("choices", [{}])[0].get("message", {}).get("content", "")


def build_assistant_orchestrator(*, api_url: str, api_key: str, model: str, provider: str, max_repair_attempts: int) -> AssistantOrchestrator:
    return AssistantOrchestrator(
        validator=GeneratedCodeValidator(),
        llm=CapabilityConstrainedLLM(
            api_url=api_url,
            api_key=api_key,
            model=model,
            provider=provider,
        ),
        max_repair_attempts=max_repair_attempts,
    )


async def stream_chat(code: str, message: str, history: list):
    """Generate constrained code and stream SSE data strings."""
    settings = load_settings()
    ai_config = settings.get("ai", {})

    api_key = ai_config.get("api_key", "")
    if not api_key:
        raise ValueError("AI API key not configured")

    api_url = ai_config.get("api_url", "https://api.openai.com/v1")
    model = ai_config.get("model", "gpt-4o")
    provider = ai_config.get("provider", "openai")
    assistant_cfg = settings.get("ai_assistant", {})
    capability_ttl = assistant_cfg.get("capability_ttl_sec", 60)
    capability_service.ttl_sec = capability_ttl
    capability = capability_service.get_snapshot()

    rules = [
        "只能使用能力快照中确认可用的依赖与 API",
        "如果依赖不确定，明确说明并提供替代方案",
        "输出完整 Python 文件，而不是片段",
    ]
    if _is_browser_automation_request(code, message):
        rules.extend([
            "当前任务属于浏览器自动化，必须优先使用 Playwright",
            "禁止引入 Selenium、Requests、BeautifulSoup、Pandas 等未确认依赖",
        ])

    ctx = {
        "code": code,
        "message": message,
        "history": history,
        "capability": capability,
        "rules": rules,
    }
    orchestrator = build_assistant_orchestrator(
        api_url=api_url,
        api_key=api_key,
        model=model,
        provider=provider,
        max_repair_attempts=assistant_cfg.get("auto_repair_max_attempts", 1),
    )
    result = await orchestrator.generate(ctx)

    if not result["appliable"]:
        yield json.dumps({
            "type": "validation_failed",
            "message": "检测到未允许依赖，已阻止应用本次代码",
            "report": {
                **result["validation_report"],
                "repair_attempts": result["repair_attempts"],
            },
        }, ensure_ascii=False)
        yield json.dumps({"type": "done"}, ensure_ascii=False)
        return

    content = result.get("content", "")
    if content:
        yield json.dumps({"type": "text", "content": content}, ensure_ascii=False)
    yield json.dumps({"type": "done"}, ensure_ascii=False)
