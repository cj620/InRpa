# StatusBar AI 状态展示设计

## 概述

丰富底部状态栏，增加 AI 大模型名称和连接状态展示。采用 Settings Context 方案，确保设置修改后状态栏实时同步。

## 布局

```
┌─────────────────────────────────────────────────────────┐
│ ● Connected │ 🤖 gpt-4o ●       3 running / 12 scripts │
│ └─ WS状态 ─┘ └─── AI区域 ───┘   └──── 脚本统计 ────┘   │
└─────────────────────────────────────────────────────────┘
```

左侧区域（从左到右）：
1. **WebSocket 连接状态** — 保持不变（绿/红点 + 文字）
2. **分隔符** — 竖线
3. **AI 模型状态** — 机器人图标 + 模型名 + 状态指示点

右侧区域不变：脚本运行统计。

## AI 状态逻辑

| 场景 | 显示 | 状态点颜色 |
|------|------|-----------|
| API Key 已配置且连接正常 | 🤖 模型名 + 绿点 | `var(--status-success)` |
| API Key 已配置但未验证 | 🤖 模型名 + 灰点 | `var(--text-secondary)` |
| API Key 未配置 | 🤖 未配置 + 灰点 | `var(--text-secondary)` |

## 方案：Settings Context

新增 `frontend/src/contexts/SettingsContext.jsx`：

- **state:** `{ settings, loading }`
- **fetchSettings()** — 启动时从 `GET /api/settings` 加载
- **updateSettings(partial)** — `PUT /api/settings` 并更新 state

`App.jsx` 中用 `<SettingsProvider>` 包裹应用。`SettingsPanel` 和 `StatusBar` 共享同一份 settings 数据。

## 交互

- 点击 AI 区域 → 跳转到 Settings 页面
- AI 区域 `cursor: pointer`，hover 时轻微高亮

## 文件改动

| 文件 | 改动 |
|------|------|
| 新建 `contexts/SettingsContext.jsx` | Settings Context Provider |
| `App.jsx` | 包裹 SettingsProvider，传 setCurrentPage 给 StatusBar |
| `StatusBar.jsx` | 消费 Context，展示 AI 模型信息，点击跳转 |
| `StatusBar.css` | AI 区域样式、分隔符、hover 效果 |
| `SettingsPanel.jsx` | 改为使用 Context 管理 settings |

## 设计决策

- **方案 B（Settings Context）**优于方案 A（前端单次读取）：设置修改后状态栏实时同步
- **方案 B 优于方案 C（WebSocket 推送）**：单窗口应用不需要多窗口同步，避免过度工程化
- **YAGNI**：先只做 AI 状态，其他状态项（Python 版本、脚本目录等）后续按需添加
