# AI Assistant Capability + Skill Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a capability-constrained, skill-extensible AI script generation pipeline with validation gate and one-shot auto-repair before code apply.

**Architecture:** Introduce a backend `ai_assistant` package that owns capability snapshot, skill registry/pipeline, and validator pipeline. Keep `/api/ai/chat` request shape compatible while adding internal orchestration and metadata. Reuse existing environment checks conceptually, but make capability collection backend-accessible without depending on Settings page lifecycle.

**Tech Stack:** FastAPI, Python 3.11, httpx SSE stream handling, pytest, existing settings persistence (`backend/settings.py`).

---

## Required Skills During Execution

- `@superpowers:test-driven-development` for every feature/fix task.
- `@superpowers:verification-before-completion` before any "done" claim.
- `@superpowers:systematic-debugging` if any test fails unexpectedly.

---

## File Structure Map

- Create: `backend/ai_assistant/__init__.py`
- Create: `backend/ai_assistant/types.py`
- Create: `backend/ai_assistant/capability.py`
- Create: `backend/ai_assistant/skills.py`
- Create: `backend/ai_assistant/validators.py`
- Create: `backend/ai_assistant/pipeline.py`
- Modify: `backend/settings.py`
- Modify: `backend/ai_chat.py`
- Modify: `backend/local_app.py`
- Modify: `backend/app.py`
- Modify: `backend/scripts_data.py`
- Modify: `tests/test_ai_chat.py`
- Create: `tests/test_ai_capability.py`
- Create: `tests/test_ai_skills_api.py`
- Create: `tests/test_ai_pipeline.py`
- Modify: `tests/test_settings.py`

Spec reference: `docs/superpowers/specs/2026-03-22-ai-assistant-capability-skill-pipeline-design.md`

### Task 1: Add AI Assistant Settings Contract

**Files:**
- Modify: `backend/settings.py`
- Modify: `tests/test_settings.py`

- [ ] **Step 1: Write failing test for default ai_assistant settings**

```python
def test_default_settings_include_ai_assistant():
    from backend.settings import DEFAULT_SETTINGS
    assert "ai_assistant" in DEFAULT_SETTINGS
    cfg = DEFAULT_SETTINGS["ai_assistant"]
    assert cfg["capability_ttl_sec"] == 60
    assert cfg["auto_repair_max_attempts"] == 1
    assert cfg["skills"]["enabled"] == []
```

- [ ] **Step 2: Run targeted test and verify failure**

Run: `pytest tests/test_settings.py::test_default_settings_include_ai_assistant -v`  
Expected: FAIL with missing `ai_assistant` key.

- [ ] **Step 3: Implement default config and merge behavior**

```python
DEFAULT_AI_ASSISTANT_SETTINGS = {
    "capability_ttl_sec": 60,
    "auto_repair_max_attempts": 1,
    "skills": {
        "enabled": [],
        "order": [],
        "configs": {},
    },
}

DEFAULT_SETTINGS = {
    "ai": {
        "provider": "openai",
        "api_url": "https://api.openai.com/v1",
        "api_key": "",
        "model": "gpt-4o",
    },
    "ai_assistant": DEFAULT_AI_ASSISTANT_SETTINGS,
    "editor": {"font_size": 14, "tab_size": 4, "word_wrap": True},
    "scripts_dir": "./scripts",
    "theme": "dark",
    "cloud_url": "http://localhost:8000",
}
```

- [ ] **Step 4: Re-run test and verify pass**

Run: `pytest tests/test_settings.py::test_default_settings_include_ai_assistant -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/settings.py tests/test_settings.py
git commit -m "feat(settings): add ai assistant config contract"
```

### Task 2: Implement Capability Snapshot Service

**Files:**
- Create: `backend/ai_assistant/types.py`
- Create: `backend/ai_assistant/capability.py`
- Create: `tests/test_ai_capability.py`

- [ ] **Step 1: Write failing tests for snapshot shape and TTL caching**

```python
def test_capability_snapshot_contains_required_keys():
    service = CapabilityService(ttl_sec=60)
    snap = service._normalize_raw({
        "python": {"ok": True, "version": "3.11.9"},
        "venv": {"ok": True},
        "playwright": {"ok": True, "version": "1.50.1", "chromium": "chromium"},
        "node": {"ok": True, "version": "22.13.0"},
        "cloudBackend": {"ok": True, "status": 200},
    })
    assert "timestamp" in snap
    assert snap["python"]["ok"] is True

def test_capability_snapshot_uses_cache_within_ttl(monkeypatch):
    service = CapabilityService(ttl_sec=60)
    calls = {"n": 0}
    def fake_probe():
        calls["n"] += 1
        return {"python": {"ok": True, "version": "3.11.9"}}
    monkeypatch.setattr(service, "_probe", fake_probe)
    service.get_snapshot()
    service.get_snapshot()
    assert calls["n"] == 1
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pytest tests/test_ai_capability.py -v`  
Expected: FAIL because module/class not found.

- [ ] **Step 3: Implement `CapabilityService` and types**

```python
class CapabilityService:
    def __init__(self, ttl_sec: int = 60):
        self.ttl_sec = ttl_sec
        self._cached_snapshot = None
        self._cached_at = 0.0

    def get_snapshot(self, force_refresh: bool = False) -> dict:
        now = time.time()
        if not force_refresh and self._cached_snapshot and now - self._cached_at < self.ttl_sec:
            return dict(self._cached_snapshot, stale=False)
        raw = self._probe()
        normalized = self._normalize_raw(raw)
        self._cached_snapshot = normalized
        self._cached_at = now
        return dict(normalized, stale=False)
```

- [ ] **Step 4: Re-run tests and verify pass**

Run: `pytest tests/test_ai_capability.py -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/ai_assistant/types.py backend/ai_assistant/capability.py tests/test_ai_capability.py
git commit -m "feat(ai): add capability snapshot service with ttl cache"
```

### Task 3: Build Skill Registry and Hook Pipeline

**Files:**
- Create: `backend/ai_assistant/skills.py`
- Modify: `backend/ai_assistant/types.py`
- Create: `tests/test_ai_pipeline.py`

- [ ] **Step 1: Write failing tests for ordered skill execution**

```python
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
    pipeline.build_prompt_rules({"request": {}})
    assert events == ["s2", "s1"]
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pytest tests/test_ai_pipeline.py::test_skill_before_prompt_runs_in_configured_order -v`  
Expected: FAIL with missing skill classes.

- [ ] **Step 3: Implement base skill, registry, and pipeline hooks**

```python
class BaseSkill:
    name = "base"
    def before_prompt(self, ctx): return {}
    def after_generate(self, ctx, code): return code
    def validate(self, ctx, code): return []
    def repair(self, ctx, code, issues): return {}

class SkillRegistry:
    def __init__(self, skills: list[BaseSkill]):
        self._skills = {s.name: s for s in skills}
    def resolve(self, enabled: list[str], order: list[str]) -> list[BaseSkill]:
        ordered = [name for name in order if name in enabled]
        tail = [name for name in enabled if name not in ordered]
        return [self._skills[name] for name in ordered + tail if name in self._skills]
```

- [ ] **Step 4: Re-run tests and verify pass**

Run: `pytest tests/test_ai_pipeline.py::test_skill_before_prompt_runs_in_configured_order -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/ai_assistant/skills.py backend/ai_assistant/types.py tests/test_ai_pipeline.py
git commit -m "feat(ai): add skill registry and ordered hook pipeline"
```

### Task 4: Add Validator Pipeline and One-Shot Repair Orchestration

**Files:**
- Create: `backend/ai_assistant/validators.py`
- Create: `backend/ai_assistant/pipeline.py`
- Modify: `backend/ai_chat.py`
- Modify: `tests/test_ai_chat.py`
- Modify: `tests/test_ai_pipeline.py`

- [ ] **Step 1: Write failing tests for validation gate and single repair attempt**

```python
@pytest.mark.asyncio
async def test_pipeline_retries_once_then_blocks():
    orch = AssistantOrchestrator(
        validator=FakeValidator(always_fail=True),
        llm=FakeLLM(outputs=["bad_code", "still_bad"]),
        max_repair_attempts=1,
    )
    result = await orch.generate({"message": "x"})
    assert result["status"] == "failed"
    assert result["repair_attempts"] == 1
    assert result["appliable"] is False
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pytest tests/test_ai_pipeline.py::test_pipeline_retries_once_then_blocks -v`  
Expected: FAIL because `AssistantOrchestrator` not implemented.

- [ ] **Step 3: Implement validator + orchestrator**

```python
class AssistantOrchestrator:
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
```

- [ ] **Step 4: Wire `backend/ai_chat.py` to inject capability + rules + report**

```python
prompt_ctx = {
    "capability": capability_service.get_snapshot(),
    "skills": skill_config,
    "request": {"code": code, "message": message, "history": history},
}
orchestration = await assistant_orchestrator.generate(prompt_ctx)
if not orchestration["appliable"]:
    yield json.dumps({"type": "validation_failed", "report": orchestration["validation_report"]}, ensure_ascii=False)
    yield json.dumps({"type": "done"})
    return
```

- [ ] **Step 5: Re-run tests and verify pass**

Run: `pytest tests/test_ai_pipeline.py tests/test_ai_chat.py -v`  
Expected: PASS for new orchestrator and chat gate tests.

- [ ] **Step 6: Commit**

```bash
git add backend/ai_assistant/validators.py backend/ai_assistant/pipeline.py backend/ai_chat.py tests/test_ai_chat.py tests/test_ai_pipeline.py
git commit -m "feat(ai): add validation gate and one-shot auto-repair orchestration"
```

### Task 5: Expose Capability and Skill Config APIs

**Files:**
- Modify: `backend/local_app.py`
- Modify: `backend/app.py`
- Create: `tests/test_ai_skills_api.py`

- [ ] **Step 1: Write failing API tests**

```python
@pytest.mark.asyncio
async def test_get_ai_capability_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/ai/capability")
    assert resp.status_code == 200
    assert "python" in resp.json()

@pytest.mark.asyncio
async def test_put_ai_skills_updates_settings():
    payload = {"enabled": ["runtime_guard"], "order": ["runtime_guard"], "configs": {}}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/ai/skills", json=payload)
    assert resp.status_code == 200
    assert resp.json()["skills"]["enabled"] == ["runtime_guard"]
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pytest tests/test_ai_skills_api.py -v`  
Expected: FAIL with 404 endpoints.

- [ ] **Step 3: Implement endpoints in both local and cloud app**

```python
@app.get("/api/ai/capability")
async def ai_capability():
    return capability_service.get_snapshot()

@app.get("/api/ai/skills")
async def get_ai_skills():
    settings = load_settings()
    return settings.get("ai_assistant", {}).get("skills", {})

@app.put("/api/ai/skills")
async def update_ai_skills(body: dict):
    updated = save_settings({"ai_assistant": {"skills": body}})
    return updated["ai_assistant"]
```

- [ ] **Step 4: Re-run tests and verify pass**

Run: `pytest tests/test_ai_skills_api.py -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/local_app.py backend/app.py tests/test_ai_skills_api.py
git commit -m "feat(api): add ai capability and skills config endpoints"
```

### Task 6: Reserve Script Inputs/Outputs Schema in Metadata

**Files:**
- Modify: `backend/scripts_data.py`
- Modify: `backend/app.py`
- Modify: `backend/local_app.py`
- (Optional if needed) Modify: `tests/test_app.py` and/or `tests/test_local_app.py`

- [ ] **Step 1: Write failing test for metadata schema fields**

```python
def test_get_script_meta_contains_io_schema_defaults():
    meta = get_script_meta("example_script")
    assert "inputs_schema" in meta
    assert "outputs_schema" in meta
```

- [ ] **Step 2: Run test and verify failure**

Run: `pytest tests/test_app.py -k meta -v`  
Expected: FAIL because fields are missing.

- [ ] **Step 3: Add schema defaults and update path**

```python
def get_script_meta(name: str) -> dict:
    meta = _read_meta().get(name, {})
    return {
        "tags": meta.get("tags", []),
        "description": meta.get("description", ""),
        "folder": meta.get("folder"),
        "inputs_schema": meta.get("inputs_schema", {"type": "object", "properties": {}}),
        "outputs_schema": meta.get("outputs_schema", {"type": "object", "properties": {}}),
    }
```

- [ ] **Step 4: Re-run tests and verify pass**

Run: `pytest tests/test_app.py tests/test_local_app.py -v`  
Expected: PASS for metadata compatibility.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts_data.py backend/app.py backend/local_app.py tests/test_app.py tests/test_local_app.py
git commit -m "feat(metadata): reserve script input/output schema fields"
```

### Task 7: Full Verification and Handoff

**Files:**
- No new code; verification + docs sanity

- [ ] **Step 1: Run complete backend test suite**

Run: `pytest tests -v`  
Expected: PASS with newly added tests.

- [ ] **Step 2: Run focused smoke tests for AI endpoints**

Run: `pytest tests/test_ai_chat.py tests/test_ai_skills_api.py tests/test_ai_pipeline.py -v`  
Expected: PASS and no flaky failures.

- [ ] **Step 3: Capture final behavior checklist**

```text
- /api/ai/capability returns snapshot with timestamp + stale flag
- /api/ai/skills GET/PUT roundtrip works
- /api/ai/chat blocks unappliable code after one repair retry
- validation_report and used_skills are returned for debugging
```

- [ ] **Step 4: Final commit (if any follow-up fixes)**

```bash
git add -A
git commit -m "test: finalize ai assistant capability pipeline verification"
```
