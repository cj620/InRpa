# 运行环境卡片刷新按钮设计

## 概述

在"运行环境"卡片右上角添加刷新按钮，支持用户手动重新检测环境状态。

## 视觉位置

- 运行环境卡片（`sp-card`）的 `sp-card-header` 右上角
- 使用 `position: absolute` 定位，不影响现有布局

## 图标

SVG 旋转箭头图标，与 SpinnerIcon 区分：

```jsx
function RefreshIcon({ spinning }) {
  return (
    <svg
      className={spinning ? "sp-refresh-icon--spinning" : ""}
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
```

## 交互状态

| 状态 | 视觉 | 行为 |
|------|------|------|
| idle（可刷新） | `color: var(--text-secondary)`，静态图标 | 可点击 |
| hover | `color: var(--text-primary)`，`background: var(--bg-hover)` | — |
| checking（刷新中） | `color: var(--text-secondary)`，图标旋转 | disabled，cursor: not-allowed |

## 动画

图标旋转复用现有 `.sp-spin` keyframes 动画（0.8s linear infinite）。

## 代码改动

### SettingsPanel.jsx
- 抽取 RefreshIcon 组件
- 在"运行环境"卡片 map 内渲染刷新按钮
- 驱动图标旋转：当任意 env 项 status 为 checking 时图标旋转
- onClick 触发 checkEnv 流程（复用现有的 useEffect 逻辑）

### SettingsPanel.css
- `.sp-refresh-btn`：绝对定位、背景透明、hover 效果、disabled 状态
- `.sp-refresh-icon--spinning`：应用 sp-spin 动画

## 数据流

点击 → 设置所有 envStatus 为 `checking` → 调用 `checkEnv()` → 更新状态
