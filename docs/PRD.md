# RPA Desktop Manager — 产品需求文档 (PRD)

**版本:** 1.0
**日期:** 2026-03-19
**状态:** MVP 已实现

---

## 1. 产品概述

### 1.1 产品定位

RPA Desktop Manager 是一款桌面端 RPA（机器人流程自动化）管理工具。用户将 Python 自动化脚本放入 `scripts/` 目录，通过图形界面一键运行、停止脚本，并实时查看执行日志和状态。

### 1.2 目标用户

- 需要管理和运行多个 Python 自动化脚本的个人用户
- 使用 Playwright / Selenium 等工具进行网页自动化的开发者
- 希望通过可视化界面替代命令行操作脚本的非技术人员

### 1.3 核心价值

| 痛点 | 解决方案 |
|------|----------|
| 命令行运行脚本不直观 | 图形界面一键运行/停止 |
| 脚本输出散落在终端中 | 实时日志面板，按脚本分组查看 |
| 无法直观了解脚本运行状态 | 状态指示器（idle/running/completed/failed） |
| 多个脚本难以管理 | 统一脚本列表，搜索、分类、刷新 |

---

## 2. 技术架构

### 2.1 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| 桌面壳 | Electron 33 | 跨平台桌面应用，成熟稳定 |
| 前端 | React 19 + Vite 6 | 快速开发，热更新体验好 |
| 后端 | FastAPI (Python) | 异步支持好，与 Python 脚本生态一致 |
| 实时通信 | WebSocket | 低延迟双向通信，适合日志流推送 |
| 脚本执行 | subprocess.Popen + threading | Windows 兼容，线程安全的日志流传输 |

### 2.2 架构图

```
Electron App
├── React 前端 (renderer process)
│   ├── HTTP REST → localhost:8000/api/*
│   └── WebSocket  → localhost:8000/ws
└── FastAPI 后端 (child_process, 仅生产模式)
    └── subprocess.Popen 运行 scripts/*.py
```

开发模式下，后端由 `concurrently` 独立启动（支持 `--reload` 热重载）；生产模式下，Electron 主进程负责启动和管理后端生命周期。

### 2.3 项目结构

```
rpa-mpv/
├── backend/                     # FastAPI 后端
│   ├── __init__.py
│   ├── app.py                   # API 路由 + WebSocket
│   ├── runner.py                # 脚本运行器（子进程管理）
│   └── scanner.py               # 脚本目录扫描
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── App.jsx              # 主应用 + 页面路由
│   │   ├── api.js               # HTTP API 封装
│   │   ├── hooks/
│   │   │   └── useWebSocket.js  # WebSocket 连接管理
│   │   └── components/
│   │       ├── TitleBar.jsx     # 自定义标题栏
│   │       ├── Sidebar.jsx      # 侧边导航
│   │       ├── ScriptList.jsx   # 脚本列表（含搜索）
│   │       ├── ScriptCard.jsx   # 脚本卡片
│   │       ├── LogPanel.jsx     # 日志终端面板
│   │       ├── FilesPanel.jsx   # 文件管理页
│   │       ├── SettingsPanel.jsx# 设置页
│   │       └── StatusBar.jsx    # 底部状态栏
│   └── vite.config.js
├── electron/                    # Electron 主进程
│   ├── main.js                  # 窗口管理 + 后端生命周期
│   └── preload.js               # IPC 桥接
├── scripts/                     # 用户脚本目录
│   ├── scraper.py               # 示例：Amazon 爬虫
│   └── config.py                # 爬虫配置
├── tests/                       # 测试
├── package.json                 # Electron + 开发脚本
└── requirements.txt             # Python 依赖
```

---

## 3. 功能需求

### 3.1 脚本管理

#### F-001 脚本自动发现

- **描述**: 自动扫描 `scripts/` 目录下的 `.py` 文件
- **规则**:
  - 仅识别 `.py` 后缀文件
  - 排除 `__init__.py` 等 dunder 文件
  - 排除 `config.py` 配置文件
- **返回字段**: 脚本名称、文件路径、文件大小、最后修改时间
- **状态**: ✅ 已实现

#### F-002 脚本列表展示

- **描述**: 以卡片列表形式展示所有可用脚本
- **交互**:
  - 点击卡片选中脚本，高亮显示
  - 顶部搜索框实时过滤脚本名称
  - 刷新按钮重新扫描目录
- **信息展示**: 脚本名、运行状态徽标、文件大小
- **状态**: ✅ 已实现

#### F-003 脚本运行

- **描述**: 选中脚本后点击 Run 按钮启动执行
- **规则**:
  - 同一脚本同时只允许一个运行实例
  - 重复运行返回 409 Conflict
  - 不存在的脚本返回 404 Not Found
- **执行方式**: 后端通过 `subprocess.Popen` 以子进程运行
- **状态**: ✅ 已实现

#### F-004 脚本停止

- **描述**: 运行中的脚本可通过 Stop 按钮终止
- **规则**:
  - 向子进程发送 `terminate` 信号
  - 非运行状态的脚本停止操作返回 400 Bad Request
- **状态**: ✅ 已实现

### 3.2 实时日志

#### F-005 日志实时推送

- **描述**: 脚本运行时 stdout/stderr 输出实时推送到前端
- **技术**: WebSocket 广播，消息格式 `{"type":"log", "script":"name", "data":"..."}`
- **状态**: ✅ 已实现

#### F-006 日志面板

- **描述**: 仿终端风格的日志查看器
- **功能**:
  - 按脚本名分组存储和展示日志
  - 自动滚动到最新日志（可锁定/解锁）
  - 日志级别颜色区分（info 白 / warn 黄 / error 红）
  - Clear 按钮清空当前脚本日志
- **状态**: ✅ 已实现

#### F-007 状态实时同步

- **描述**: 脚本状态变化通过 WebSocket 实时推送
- **状态流转**: `idle` → `running` → `completed` / `failed`
- **消息格式**: `{"type":"status", "script":"name", "data":"running"}`
- **前端响应**: ScriptCard 状态徽标和指示条实时更新
- **状态**: ✅ 已实现

### 3.3 页面导航

#### F-008 侧边栏导航

- **描述**: 左侧图标导航栏，支持页面切换
- **页面**:
  - **Scripts** (代码图标) — 脚本列表 + 日志面板（主工作区）
  - **Files** (文件夹图标) — 脚本文件表格视图（名称、大小、修改时间）
  - **Settings** (齿轮图标) — 应用设置页
- **交互**: 当前页面图标高亮，左侧 2px 紫色指示条
- **状态**: ✅ 已实现

### 3.4 桌面应用

#### F-009 Electron 桌面窗口

- **描述**: 无边框窗口，自定义标题栏
- **窗口**: 默认 1280×800，最小 960×600
- **标题栏**: 左侧应用名称，右侧最小化/最大化/关闭按钮
- **IPC**: 通过 `preload.js` 暴露 `window.electronAPI` 接口
- **状态**: ✅ 已实现

#### F-010 后端生命周期管理

- **描述**: Electron 自动管理 FastAPI 后端进程
- **行为**:
  - 生产模式: 启动时 spawn 后端进程，等待端口就绪后加载页面
  - 开发模式: 跳过后端启动（由 concurrently 管理）
  - 关闭窗口时自动 kill 后端进程
- **状态**: ✅ 已实现

---

## 4. API 接口规范

### 4.1 REST API

| 端点 | 方法 | 功能 | 成功响应 | 错误响应 |
|------|------|------|----------|----------|
| `/api/scripts` | GET | 获取脚本列表 | `200` 脚本数组 | — |
| `/api/scripts/{name}/run` | POST | 运行脚本 | `200` 启动消息 | `404` 不存在 / `409` 已在运行 |
| `/api/scripts/{name}/stop` | POST | 停止脚本 | `200` 停止消息 | `400` 未在运行 |

### 4.2 WebSocket

- **端点**: `ws://localhost:8000/ws`
- **方向**: 服务端 → 客户端（单向广播）
- **消息类型**:

```json
// 日志消息
{"type": "log", "script": "scraper", "data": "Found 10 products."}

// 状态变化
{"type": "status", "script": "scraper", "data": "completed"}
```

### 4.3 脚本元数据格式

```json
{
  "name": "scraper",
  "path": "/absolute/path/to/scripts/scraper.py",
  "size": 4096,
  "modified_at": "2026-03-19T15:30:00"
}
```

---

## 5. 界面设计

### 5.1 设计风格

暗色主题，VS Code / Raycast 风格。干净、克制、信息密度适中。

### 5.2 色彩系统

| 用途 | 颜色值 |
|------|--------|
| 主背景 | `#0F1117` |
| 卡片背景 | `#161822` |
| 悬停背景 | `#1C1F2E` |
| 终端背景 | `#0A0C10` |
| 主强调色 | `#6C5CE7` |
| 浅强调色 | `#A29BFE` |
| 成功/完成 | `#00D68F` |
| 失败/错误 | `#FF6B6B` |
| 运行中 | `#FFC048` |
| 主文字 | `#E4E6EF` |
| 次文字 | `#8F93A2` |
| 边框 | `rgba(255,255,255,0.06)` |

### 5.3 字体

- UI 文字: Inter
- 代码/日志: JetBrains Mono

### 5.4 布局

```
┌──────────────────────────────────────────────────┐
│  TitleBar (自定义标题栏, 可拖拽)          [─ □ ×] │
├────┬──────────┬──────────────────────────────────┤
│ S  │ Script   │                                  │
│ i  │ List     │    LogPanel (日志终端)            │
│ d  │ (260px)  │    (自适应宽度)                   │
│ e  │          │                                  │
│ b  │ [搜索]   │    > Starting scraper...          │
│ a  │ ┌──────┐ │    > Found 10 products.           │
│ r  │ │card 1│ │    > Scraping detail...            │
│    │ │card 2│ │                                   │
│ 48 │ │card 3│ │              [Run] [Stop] [Clear] │
│ px │ └──────┘ │                                   │
├────┴──────────┴──────────────────────────────────┤
│  StatusBar: ● Connected          1/3 running     │
└──────────────────────────────────────────────────┘
```

### 5.5 动效

| 元素 | 效果 |
|------|------|
| 状态指示条 | 颜色渐变 `transition: 0.3s ease` |
| Running 状态 | 呼吸动画 `opacity: 0.5 ↔ 1.0` |
| 卡片悬停 | 背景色变化 + `translateX(2px)` |
| 按钮点击 | `scale(0.97)` 按压反馈 |

---

## 6. 数据流

```
用户点击 [▶ Run]
    │
    ▼
React ──POST──▶ /api/scripts/scraper/run
                       │
                       ▼
               runner.py 启动子进程
               python -u scripts/scraper.py
                       │ (stdout 实时读取, 通过线程+队列传回事件循环)
                       ▼
    ◀──WebSocket── {"type":"log", ...}
    ◀──WebSocket── {"type":"status", "data":"running"}
    │
    ▼
LogPanel 实时显示日志，ScriptCard 状态指示器更新
    │
    ... 脚本执行完毕 ...
    │
    ◀──WebSocket── {"type":"status", "data":"completed"}
```

---

## 7. 测试覆盖

### 7.1 后端测试 (pytest + pytest-asyncio)

| 模块 | 测试用例 | 数量 |
|------|----------|------|
| scanner | 扫描发现 .py 文件、返回正确元数据、空目录返回空列表、忽略 dunder 文件 | 4 |
| runner | 成功运行、失败检测、空闲状态查询、停止运行中脚本、防止重复运行 | 5 |
| app | 列出脚本、运行不存在脚本返回404、停止空闲脚本返回400 | 3 |
| **合计** | | **12** |

### 7.2 运行命令

```bash
python -m pytest tests/ -v
```

---

## 8. 开发与运行

### 8.1 环境依赖

- Python 3.11+
- Node.js 18+
- pip 包: `fastapi`, `uvicorn[standard]`, `websockets`, `playwright`, `playwright-stealth`
- npm 包: `electron`, `concurrently`, `react`, `vite`, `@vitejs/plugin-react`

### 8.2 安装

```bash
# Python 依赖
pip install -r requirements.txt

# 根目录 Node 依赖 (Electron + concurrently)
npm install

# 前端依赖
cd frontend && npm install
```

### 8.3 开发模式

```bash
npm run dev
```

该命令通过 `concurrently` 并行启动：
- `dev:backend` — FastAPI 后端 (端口 8000, 热重载)
- `dev:frontend` — Vite 开发服务器 (端口 5173, 代理 API 到 8000)
- `dev:electron` — Electron 窗口 (开发模式不启动后端，连接已有的)

---

## 9. 已知问题与修复记录

| 问题 | 原因 | 修复方案 |
|------|------|----------|
| Windows 下 `NotImplementedError` | `asyncio.create_subprocess_exec` 不支持 `SelectorEventLoop` | 改用 `subprocess.Popen` + `threading.Thread` + `asyncio.Queue` |
| 端口 8000 冲突 (Errno 10048) | `dev:backend` 和 Electron `main.js` 同时启动后端 | 开发模式下 Electron 跳过后端启动 |
| 脚本运行后瞬间完成 | `scraper.py` 无 `__main__` 入口 | 添加 `if __name__ == "__main__"` 入口 |
| `import config` 找不到模块 | 子进程工作目录不是 `scripts/` | 运行时将脚本目录加入 `sys.path` |
| `config.py` 出现在脚本列表 | scanner 未过滤配置文件 | 在 scanner 中排除 `config.py` |

---

## 10. 后续规划

### Phase 2 — 增强功能

- [ ] 脚本参数配置：运行脚本时传入自定义参数
- [ ] 定时任务：支持 cron 表达式定时执行脚本
- [ ] 脚本编辑器：内置代码编辑器，直接编辑 `scripts/` 中的文件
- [ ] 运行历史：记录每次运行的日志、耗时、结果
- [ ] 通知系统：脚本完成/失败时桌面通知

### Phase 3 — 高级特性

- [ ] 多目录支持：管理多个脚本目录
- [ ] 脚本依赖管理：每个脚本独立的虚拟环境
- [ ] 远程执行：连接远程服务器运行脚本
- [ ] 工作流编排：可视化编排多个脚本的执行顺序和条件分支
- [ ] 数据看板：脚本产出数据的可视化展示

### Phase 4 — 生产化

- [ ] 自动更新：Electron auto-updater
- [ ] 安装包打包：Windows (.exe) / macOS (.dmg) / Linux (.AppImage)
- [ ] 国际化：中英文界面切换
- [ ] 用户认证：多用户权限管理
