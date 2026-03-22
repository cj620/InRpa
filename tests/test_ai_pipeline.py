from backend.ai_assistant.skills import BaseSkill, SkillPipeline, SkillRegistry


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
