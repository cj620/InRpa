# FilesPanel 批量操作 + ScriptList 简化设计

## 概述

将 ScriptCard 的"更多操作"菜单（移动/标签/描述）迁移至 FilesPanel，使 FilesPanel 成为唯一的文件管理入口。同时移除 ScriptList 的批量选择，回归单击执行的简洁交互。

## 两个视图的职责划分

| 视图 | 职责 |
|------|------|
| **Scripts (ScriptList)** | 脚本执行 — 单击选中运行，展示运行状态、日志 |
| **Files (FilesPanel)** | 文件管理 — 批量选择 + 批量操作（移动/标签/描述） |

## 1. FilesPanel 批量操作

### 1.1 表格新增 Checkbox 列

- 在"文件名"列左侧新增 Checkbox 列（宽度 40px，列头有全选框）
- 每行一个 Checkbox，支持单行选择
- 全选框：选中时所有当前页脚本全选；取消时清空

### 1.2 行内更多操作菜单

- 每行右侧"编辑"按钮旁新增 `···` 按钮（hover 时显示）
- 点击弹出菜单，包含三项：
  - **移动到...** — 弹出文件夹选择弹窗
  - **编辑标签** — 弹出标签编辑弹窗
  - **编辑描述** — 弹出描述编辑弹窗
- 菜单弹出时该行高亮（背景色轻微变化）
- 点击菜单外部或按 Esc 关闭菜单

### 1.3 批量操作栏

- 选中任意项后，表格下方（而非页面底部）浮现**批量操作条**
- 固定在 panel 内部，高度 52px，内边距 12px 16px
- 背景：`#1E1E2E`（比当前 bg 深一个色阶），圆角 8px，box-shadow 上浮
- 内容左侧：已选 N 项
- 内容右侧：三个操作按钮 + 分隔线 + 取消按钮

**批量操作条布局（flex, align-center, gap=12px）：**

```
[已选 3 项] | [移动到...] [编辑标签] [编辑描述] | [× 取消]
```

- 无选中项时，批量操作条不显示（淡出动画，高度从 52px 缩至 0，200ms ease-out）
- 选中项后，操作条从底部滑入（translateY 20px → 0，opacity 0 → 1，200ms ease-out）

### 1.4 弹窗规范

**移动到... 弹窗**
- 标题：移动到文件夹
- 内容：文件夹列表（单选），当前文件夹项禁用
- 底部：取消 / 确认

**编辑标签 弹窗**
- 标题：编辑标签
- 内容：当前标签（可删除）+ 新增标签输入框（输入后按回车添加）
- 底部：取消 / 确认

**编辑描述 弹窗**
- 标题：编辑描述
- 内容：多行文本框（textarea），预填当前描述
- 底部：取消 / 确认

所有弹窗：居中显示，背景遮罩 `rgba(0,0,0,0.5)`，弹窗圆角 12px，最大宽度 420px。

## 2. ScriptList 简化

### 2.1 移除批量选择

- 移除 ScriptCard 左上角的 Checkbox 元素（`isSelectable` prop 去掉）
- 移除 `isSelected` / `onSelectToggle` 相关 state 和逻辑
- 单卡点击行为：直接触发 `onClick`（运行/选中），不再切换选中状态

### 2.2 交互保持简洁

- 单卡 hover：轻微提亮背景（和当前一致）
- 单卡点击：边框高亮 + 触发 onClick
- 单卡右上角"更多操作"菜单保留（`···` 按钮），但其中"移动到..."和文件操作逻辑一致

## 3. 状态管理

### 3.1 FilesPanel 新增 state

```js
const [selectedScripts, setSelectedScripts] = useState(new Set()); // Set<string> 脚本名集合
const [batchBarVisible, setBatchBarVisible] = useState(false);     // 批量操作条显示
```

### 3.2 批量操作条显示逻辑

- `selectedScripts.size > 0` → 显示
- 取消选中：`setSelectedScripts(new Set())` → 隐藏

### 3.3 Checkbox 全选逻辑

- 全选：选中当前展示的所有脚本（按当前 folder 过滤后的列表）
- 当前页全选，不跨页

## 4. API 调用

批量操作的 API 调用和单行操作共用同一个后端接口，后端需支持批量传入多个脚本名。

示例：

```
POST /api/scripts/batch-move
Body: { script_names: ["script1", "script2"], target_folder: "folder_name" }
```

## 5. 边界情况

| 情况 | 处理 |
|------|------|
| 批量移动到当前所在文件夹 | 提示"已是目标文件夹"，不调用 API |
| 批量编辑标签时脚本数 > 50 | 显示确认提示"即将同时编辑 N 项标签" |
| 选中草稿脚本 + 正式脚本混合 | 批量操作对草稿脚本不生效，弹窗提示"草稿脚本不支持此操作" |
| 批量操作进行中（API 调用中） | 操作按钮显示 loading spinner，禁止重复点击 |
| 批量操作失败 | Toast 错误提示，操作条保持显示，不自动清空选中 |

## 6. CSS 变量（参考当前 design system）

```css
--bg-primary: #0F1117;
--bg-secondary: #1A1D27;
--bg-elevated: #1E1E2E;
--accent: #6C5CE7;
--accent-hover: #7D6DF5;
--text-primary: #E8E8F0;
--text-secondary: #8888A0;
--border: #2A2D3A;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
```

## 7. 文件改动清单

| 文件 | 改动 |
|------|------|
| `frontend/src/components/FilesPanel.jsx` | 新增 Checkbox 列、更多操作菜单、批量操作条 |
| `frontend/src/components/FilesPanel.css` | 批量操作条样式、菜单样式、Checkbox 样式 |
| `frontend/src/components/ScriptCard.jsx` | 移除 `selectable`/`isSelected`/`onSelectToggle` 相关逻辑 |
| `frontend/src/components/ScriptCard.css` | 移除 checkbox 样式 |

## 8. 动效规范

- 批量操作条出现/消失：200ms ease-out
- 菜单弹出：100ms ease-out，transform scale 从 0.95 → 1
- Checkbox 选中：100ms，背景色 + 勾选图标淡入
- 弹窗出现：200ms ease-out，背景遮罩淡入 + 弹窗 scale 0.95 → 1
