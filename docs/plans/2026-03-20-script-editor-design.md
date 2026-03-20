# Script Editor Module Design

**Date:** 2026-03-20
**Status:** Approved

## Overview

为 InRpa 新增脚本编辑器模块，支持内嵌代码编辑（Monaco Editor）、AI 辅助修改（对话式）、草稿/发布版本管理、草稿热测试，以及一键打开外部编辑器的混合模式。

## Design Decisions

| 维度 | 决定 | 备选方案 |
|------|------|---------|
| 编辑器引擎 | Monaco Editor | CodeMirror 6, react-simple-code-editor |
| 编辑模式 | 混合：内嵌 + 一键外部编辑器 | 纯内嵌, 纯外部联动 |
| AI 交互 | 对话式（聊天框 → AI 返回代码 → 用户确认） | 内联指令式, 混合 |
| 版本管理 | 单草稿（正式版 + 1个草稿，发布替换） | 多版本历史, 简单备份 |
| 热测试 | 直接执行草稿，日志显示在编辑器旁 | 对比测试, 沙箱测试 |
| 入口 | Sidebar 新页面 | 从脚本列表进入, 双击进入 |

## Page Layout

### 整体设计理念

参考 VS Code + Cursor AI 的交互范式，做减法。核心原则：

1. **编辑器为王** — 代码区域占据最大视觉权重
2. **渐进式披露** — 右侧面板默认收起，按需展开
3. **状态即时可见** — 通过视觉符号而非文字传达状态

### 布局结构

```
┌─────────────────────────────────────────────────────────┐
│ TitleBar                                                │
├────┬────────────────────────────────────────────────────┤
│    │ ┌─ Editor Toolbar ──────────────────────────────┐  │
│    │ │ 📄 scraper.py (草稿·未保存)  [Diff] [▶测试] [⟳] │  │
│ S  │ └──────────────────────────────────────────────-┘  │
│ i  │ ┌─────────────────────────┬─────────────────────┐  │
│ d  │ │                         │   (可折叠右侧面板)    │  │
│ e  │ │    Monaco Editor        │                     │  │
│ b  │ │                         │   AI 对话 / 测试日志  │  │
│ a  │ │    (全高代码编辑区)       │                     │  │
│ r  │ │                         │                     │  │
│    │ │                         │                     │  │
│    │ └─────────────────────────┴─────────────────────┘  │
│    │ ┌─ Action Bar ─────────────────────────────────┐   │
│    │ │ [保存草稿] [发布] [放弃草稿] │ [外部编辑器打开]  │   │
│    │ └──────────────────────────────────────────────-┘   │
├────┴────────────────────────────────────────────────────┤
│ StatusBar                                               │
└─────────────────────────────────────────────────────────┘
```

### 脚本选择器

Toolbar 左侧下拉脚本选择器（取代独立侧栏），点击弹出搜索式下拉菜单：
- 输入即过滤，支持模糊匹配
- 每项显示：脚本名 + 草稿标记（蓝色圆点）+ 最后修改时间
- 编辑器获得最大水平空间

### Editor Toolbar

一行工具栏，三区域布局：

| 左侧 | 中间 | 右侧 |
|------|------|------|
| 脚本选择器下拉 + 状态标签 | Diff 切换按钮 | ▶ 测试运行 + 面板折叠按钮 |

状态标签：
- `草稿` — 蓝色
- `已修改` — 橙色圆点（未保存更改）
- `已发布` — 绿色

### 右侧面板

- 默认收起，编辑器占满宽度
- 展开方式：按钮点击 或 快捷键
- 300ms ease-out 过渡动画
- 面板宽度可拖拽调节（min 280px, max 50%）
- 两个 Tab：AI 助手 | 测试日志

### Action Bar

底部操作栏，半透明背景：
- 左侧主要操作：保存草稿（主色）、发布到正式版（需确认）、放弃草稿（红色文字，需确认）
- 右侧次要操作：在外部编辑器中打开
- 发布确认弹窗显示 diff 摘要（+X行 / -X行）

### 空状态

居中引导：编辑器图标 + "选择一个脚本开始编辑" + 下拉选择器

## Backend API

### 新增端点

```
GET    /api/scripts/{name}/content          读取正式版脚本内容
GET    /api/scripts/{name}/draft            读取草稿内容（无草稿返回 404）
PUT    /api/scripts/{name}/draft            保存草稿
DELETE /api/scripts/{name}/draft            放弃草稿
POST   /api/scripts/{name}/draft/publish    发布草稿（覆盖正式版，删除草稿）
POST   /api/scripts/{name}/draft/run        测试运行草稿
POST   /api/scripts/{name}/draft/stop       停止草稿测试
POST   /api/scripts/{name}/open-external    用系统默认编辑器打开
POST   /api/ai/chat                         AI 对话（SSE 流式响应）
GET    /api/settings                        获取设置
PUT    /api/settings                        保存设置
```

### 草稿存储

```
scripts/
├── scraper.py            ← 正式版
├── .drafts/              ← 草稿目录（gitignore）
│   └── scraper.py        ← 草稿
```

- `.drafts/` 在 `scripts/` 下，scanner 自动忽略
- 首次编辑时复制正式版到 `.drafts/` 创建草稿
- 发布 = 草稿覆盖正式版 + 删除草稿
- 放弃 = 删除草稿文件

### AI 对话接口

```
POST /api/ai/chat
Request:
{
    "script_name": "scraper",
    "code": "当前编辑器代码",
    "message": "把延迟改为5秒",
    "history": [...]
}
Response: SSE 流式
data: {"type": "text", "content": "好的，我来修改..."}
data: {"type": "code", "content": "完整修改后代码", "diff_summary": "+3 -2"}
data: {"type": "done"}
```

- 后端拼接 system prompt + 用户代码 + 对话历史
- AI 配置从 settings.json 读取

### WebSocket 消息扩展

```json
{"type": "log", "script": "scraper", "source": "draft", "data": "..."}
{"type": "status", "script": "scraper", "source": "draft", "data": "running"}
```

新增 `source` 字段：`"draft"` 表示草稿测试，前端据此路由日志。

### scanner.py 扩展

返回数据新增 `has_draft` 字段。

### 设置持久化

```json
// settings.json（项目根目录，gitignore）
{
    "ai": {
        "provider": "openai",
        "api_url": "https://api.openai.com/v1",
        "api_key": "sk-xxx",
        "model": "gpt-4o"
    },
    "editor": {
        "font_size": 14,
        "tab_size": 4,
        "word_wrap": true
    },
    "scripts_dir": "./scripts"
}
```

## Frontend Components

### 新增组件树

```
EditorPage.jsx                  ← 编辑器页面容器
├── EditorToolbar.jsx           ← 顶部工具栏
│   ├── ScriptSelector.jsx      ← 下拉脚本选择器
│   ├── StatusBadge.jsx         ← 状态标签
│   └── ToolbarActions.jsx      ← Diff/测试/面板按钮
├── EditorMain.jsx              ← 编辑区域
│   ├── Monaco Editor           ← 普通编辑
│   └── Monaco DiffEditor       ← Diff 对比
├── SidePanel.jsx               ← 右侧可折叠面板
│   ├── AIChatPanel.jsx         ← AI 对话 Tab
│   │   ├── ChatMessage.jsx     ← 消息气泡
│   │   ├── CodeDiffBlock.jsx   ← 代码修改块
│   │   └── ChatInput.jsx       ← 输入框
│   └── TestLogPanel.jsx        ← 测试日志 Tab
├── EditorActionBar.jsx         ← 底部操作栏
└── EmptyState.jsx              ← 空状态引导
```

### State Hooks

```javascript
// hooks/useEditor.js
{ selectedScript, originalCode, draftCode, isDirty, hasDraft, viewMode, saving, publishing }

// hooks/useAIChat.js
{ messages, isStreaming, error }

// hooks/useDraftRunner.js
{ status, logs }
```

### 交互流程

**选择脚本：** ScriptSelector 选择 → 加载正式版和草稿 → 显示在 Editor

**AI 修改：** 用户输入需求 → SSE 流式回复 → CodeDiffBlock 渲染 diff → 点击"应用修改" → Editor 更新 + 行高亮

**测试发布：** 测试运行 → 自动展开日志面板 → WebSocket 实时日志 → 测试通过 → 点击发布 → 确认弹窗（含 diff 摘要）→ 覆盖正式版

### 快捷键

| 快捷键 | 操作 |
|--------|------|
| Ctrl+S | 保存草稿 |
| Ctrl+Shift+A | 展开/收起 AI 面板 |
| Ctrl+Shift+L | 展开/收起测试日志 |
| Ctrl+D | 切换 Diff 视图 |
| Ctrl+Enter | 测试运行草稿 |

## Settings Panel Redesign

分区卡片布局：

1. **AI 模型配置** — 服务商下拉（OpenAI/Anthropic/自定义）、API 地址、API Key（掩码+眼睛切换）、模型名、测试连接按钮
2. **编辑器设置** — 字体大小、Tab 宽度、自动换行
3. **通用设置** — 脚本目录、后端端口、版本号

服务商切换自动填充默认 API 地址。保存成功后按钮淡出。

## Error Handling

| 场景 | 处理 |
|------|------|
| AI 未配置 | 输入框上方提示 + 设置跳转链接 |
| AI 请求失败 | 错误气泡（红色边框）+ 重试 |
| AI 流式中断 | 显示已接收内容 + 重试按钮 |
| 保存失败 | Toolbar 抖动 + 红色 toast |
| 正式版被外部修改 | 发布确认弹窗额外提醒 + 三方 diff |
| 外部编辑器失败 | toast 提示 |
| 测试超时（60s 无日志） | 提示 + 强制停止按钮 |
| 切换脚本时未保存 | 三选一弹窗：保存并切换 / 不保存切换 / 取消 |
| WebSocket 断连 | 日志面板黄色横条 + 自动重连 |

## Animation Specs

| 动效 | 参数 |
|------|------|
| 面板展开/收起 | width, 300ms ease-out |
| 状态 badge 切换 | background-color, 200ms |
| Toast 通知 | 顶部滑入 + 淡入, 3s 后淡出 |
| AI 代码应用行高亮 | 背景闪烁 2 次, 500ms/cycle, 淡出 |
| 确认弹窗 | opacity + scale(0.95→1), 200ms ease-out |
| 保存按钮浮现 | opacity + translateY(8→0), 250ms |
| 下拉选择器 | max-height + opacity, 200ms |
