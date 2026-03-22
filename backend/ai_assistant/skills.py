"""Skill plugin contracts and execution helpers."""


class BaseSkill:
    name = "base"

    def before_prompt(self, ctx):
        return {}

    def after_generate(self, ctx, code):
        return code

    def validate(self, ctx, code):
        return []

    def repair(self, ctx, code, issues):
        return {}


class SkillRegistry:
    def __init__(self, skills):
        self._skills = {skill.name: skill for skill in skills}

    def resolve(self, enabled, order):
        ordered = [name for name in order if name in enabled]
        tail = [name for name in enabled if name not in ordered]
        resolved = []
        for name in ordered + tail:
            skill = self._skills.get(name)
            if skill is not None:
                resolved.append(skill)
        return resolved


class SkillPipeline:
    def __init__(self, registry: SkillRegistry, enabled: list[str], order: list[str]):
        self._skills = registry.resolve(enabled, order)

    def build_prompt_rules(self, ctx):
        rules = []
        for skill in self._skills:
            result = skill.before_prompt(ctx) or {}
            rules.extend(result.get("system_rules", []))
        return rules

