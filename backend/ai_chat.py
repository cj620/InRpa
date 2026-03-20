"""AI chat — proxy requests to configured LLM provider via SSE."""

import json
import httpx
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


def build_messages(code: str, message: str, history: list) -> list:
    """Build message list for LLM API."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    user_content = f"当前脚本代码：\n```python\n{code}\n```\n\n用户需求：{message}"
    messages.append({"role": "user", "content": user_content})
    return messages


async def stream_chat(code: str, message: str, history: list):
    """Stream chat completion from configured AI provider. Yields SSE data strings."""
    settings = load_settings()
    ai_config = settings.get("ai", {})

    api_key = ai_config.get("api_key", "")
    if not api_key:
        raise ValueError("AI API key not configured")

    api_url = ai_config.get("api_url", "https://api.openai.com/v1")
    model = ai_config.get("model", "gpt-4o")
    provider = ai_config.get("provider", "openai")

    messages = build_messages(code, message, history)

    if provider == "anthropic":
        url = f"{api_url}/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": model,
            "max_tokens": 4096,
            "stream": True,
            "system": SYSTEM_PROMPT,
            "messages": [m for m in messages if m["role"] != "system"],
        }
    else:
        url = f"{api_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "stream": True,
            "messages": messages,
        }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, json=body, headers=headers) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    if provider == "anthropic":
                        if chunk.get("type") == "content_block_delta":
                            text = chunk.get("delta", {}).get("text", "")
                            if text:
                                yield json.dumps({"type": "text", "content": text}, ensure_ascii=False)
                    else:
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        text = delta.get("content", "")
                        if text:
                            yield json.dumps({"type": "text", "content": text}, ensure_ascii=False)
                except json.JSONDecodeError:
                    continue

    yield json.dumps({"type": "done"})
