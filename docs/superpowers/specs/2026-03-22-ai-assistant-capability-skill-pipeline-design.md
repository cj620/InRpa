# AI 助手能力增强设计：Capability Contract + Skill Pipeline

日期：2026-03-22  
状态：已评审（待实现计划）  
作者：Codex（与用户共创）

## 1. 背景与目标

当前编辑器内 AI 助手可以基于“当前脚本 + 用户需求”生成代码，但缺少对本机真实环境的强约束，存在以下问题：

- 可能引用未安装依赖或不可用 API（“弄虚做假”）。
- 缺少应用前验证门禁，导致“看起来正确但不可运行”。
- 扩展能力依赖硬编码，后续新增规则/策略成本高。

本设计目标：

1. 让 AI 仅在真实运行环境边界内生成脚本。
2. 在“应用代码”前执行静态 + 最小运行验证，失败自动修复 1 次。
3. 构建可配置 Skill 管道，支持后续独立 Skill 管理模块接入。
4. 预留脚本输入/输出契约，不阻塞后续参数化执行能力扩展。

## 2. 范围与非范围

### 2.1 本期范围（V1）

- 能力快照（Capability Snapshot）统一采集与注入。
- Skill Pipeline（配置启停、排序、参数化）。
- 验证门禁（静态检查 + 最小执行验证）。
- 失败自动修复 1 次（固定上限）。
- 提供 `GET/PUT /api/ai/skills` 与 `GET /api/ai/capability`。
- 预留 `inputs_schema` / `outputs_schema` 元数据字段。

### 2.2 非范围（延期）

- 完整参数化运行 UI（动态表单、批量任务编排）。
- 业务正确性保障（如 DOM 选择器是否抓到真实价格）。
- 外部动态加载 Skill（先不开放，避免安全复杂度）。

## 3. 复用现有能力

设置模块已有环境检测能力，可直接复用和抽取：

- `electron/main.js` 的 `check-env` 已覆盖：
  - Python 版本
  - Node 版本
  - `.venv` 可用性
  - Playwright 包与 Chromium 可用性
  - 云端后端连通性
- `frontend/src/components/SettingsPanel.jsx` 已完成可视化展示。

设计要求：

- 将检测逻辑抽取为可复用能力提供器（Provider），避免仅依赖设置页触发。
- AI 请求时可直接读取最近能力快照（带 TTL），不依赖前端页面状态。

## 4. 架构设计

### 4.1 总体流程

`AI Chat Request -> Capability Snapshot -> Skill before_prompt -> LLM Generation -> Skill after_generate -> Validator Pipeline -> (fail) Skill repair + Re-generate once -> Apply Gate`

### 4.2 核心组件

1. `CapabilityService`
- 负责采集、缓存、刷新能力快照。
- 输出结构化事实，不输出自然语言。

2. `SkillRegistry`
- 管理可用 Skill 的注册、启停、顺序。
- 按配置加载并组装执行链。

3. `SkillPipeline`
- 标准 Hook：
  - `before_prompt(ctx) -> prompt_patch`
  - `after_generate(ctx, code) -> code`
  - `validate(ctx, code) -> issues[]`
  - `repair(ctx, code, issues) -> repair_instruction`

4. `ValidatorPipeline`
- 基础验证：
  - 语法检查（`py_compile`）
  - import/依赖可用性检查
  - Playwright smoke（命中场景时执行 `chromium.launch(headless=True)`）

5. `ApplyGate`
- 仅 `passed=true` 时允许应用代码到编辑器。
- 保留失败详情与修复尝试记录。

## 5. 数据结构与接口

### 5.1 配置（settings.json 扩展）

```json
{
  "ai_assistant": {
    "capability_ttl_sec": 60,
    "auto_repair_max_attempts": 1,
    "skills": {
      "enabled": ["anti_hallucination", "runtime_guard", "playwright_smoke"],
      "order": ["anti_hallucination", "runtime_guard", "playwright_smoke"],
      "configs": {
        "anti_hallucination": { "strict": true },
        "runtime_guard": { "forbid_unknown_imports": true },
        "playwright_smoke": { "headless": true }
      }
    }
  }
}
```

### 5.2 能力快照结构（示意）

```json
{
  "timestamp": "2026-03-22T09:50:00Z",
  "python": { "ok": true, "version": "3.11.9" },
  "venv": { "ok": true },
  "playwright": { "ok": true, "version": "1.50.1", "chromium": "chromium" },
  "node": { "ok": true, "version": "22.13.0" },
  "cloudBackend": { "ok": true, "status": 200 }
}
```

### 5.3 API 设计

- `GET /api/ai/capability`
  - 返回最新能力快照（可带 `stale` 标记）。

- `GET /api/ai/skills`
  - 返回当前 Skill 启停状态、顺序、参数。

- `PUT /api/ai/skills`
  - 更新 Skill 配置（启停/顺序/参数）。

- `POST /api/ai/chat`
  - 兼容现有协议。
  - 服务端内部接入 capability + skill + validate + repair 流水线。

### 5.4 脚本 I/O 契约预留

在脚本元数据中增加：

- `inputs_schema`：输入参数结构定义（后续参数化执行 UI 使用）。
- `outputs_schema`：输出结果结构定义（后续结果管理与断言使用）。

V1 只定义字段，不改变当前无参运行主流程。

## 6. 执行与失败策略

1. 请求到达：读取能力快照 + Skill 配置。  
2. 生成阶段：注入事实约束，禁止虚构未确认能力。  
3. 验证阶段：静态检查 + 最小执行验证。  
4. 失败处理：自动回喂错误并重写 1 次。  
5. 再失败：拦截应用，返回结构化失败原因。  
6. 成功：允许应用代码，并返回验证报告与使用的 Skill 列表。

## 7. 真实性与可解释性要求

- 任何未在能力快照确认的依赖/API，默认不可用。
- 模型必须在不确定时显式标注不确定，不得伪造“已验证”结论。
- 每次生成结果附带：
  - `used_skills`
  - `validation_report`
  - `repair_attempts`

## 8. 测试策略

### 8.1 单元测试

- CapabilityService 缓存与 TTL 行为。
- SkillPipeline 顺序执行与冲突优先级。
- ValidatorPipeline 各失败分支。
- 自动修复 1 次的重试边界。

### 8.2 集成测试

- `/api/ai/chat` 成功路径。
- 首次失败 -> 修复成功路径。
- 首次失败 -> 修复失败 -> 拦截路径。
- `GET/PUT /api/ai/skills` 配置读写生效路径。

## 9. 成功标准（验收）

1. AI 输出引用未安装依赖的比例显著下降并被门禁拦截。  
2. 应用到编辑器前 100% 经验证门禁。  
3. 用户可见清晰失败原因与修复尝试记录。  
4. 新增 Skill 不修改主流程，只通过配置接入。  

## 10. 风险与后续演进

### 风险

- 验证阶段增加延迟（尤其 Playwright smoke）。
- 部分第三方模型对“严格格式与约束”遵循度不稳定。

### 缓解

- TTL 缓存减少重复环境检测。
- 验证按脚本特征条件触发（仅命中 Playwright 时执行浏览器 smoke）。
- 失败报告结构化，便于后续策略迭代。

### 后续演进

- 对接独立 Skill 管理模块（直接复用 `GET/PUT /api/ai/skills`）。
- 引入业务级断言模板（可选）。
- 再评估外部动态 Skill 加载与安全模型。
