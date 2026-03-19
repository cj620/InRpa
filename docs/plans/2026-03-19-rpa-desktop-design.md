# RPA Desktop Manager — Design Document

**Date:** 2026-03-19

**Goal:** 基于现有 Playwright 脚本模式，构建一个桌面端 RPA 管理工具。管理 `scripts/` 目录下的 Python 脚本，点击运行即可执行，实时查看日志和状态。

---

## 技术选型

| 层 | 技术 |
|---|------|
| 桌面壳 | Electron |
| 前端 | React + Vite |
| 后端 | FastAPI (Python) |
| 通信 | HTTP API + WebSocket |
| 脚本运行 | asyncio.create_subprocess_exec |

## 架构：单进程

Electron 启动时内部通过 `child_process.spawn` 启动 FastAPI 进程，前后端作为一个整体运行。

```
Electron App
├── React 前端 (renderer)
│   └── HTTP/WebSocket → localhost:8000
└── FastAPI 后端 (child_process)
    └── subprocess 运行脚本
```

---

## 项目结构

```
rpa-mpv/
├── electron/                  # Electron 主进程
│   ├── main.js                # Electron 入口，启动窗口 + FastAPI 子进程
│   └── preload.js             # 预加载脚本
├── frontend/                  # React 前端
│   ├── src/
│   │   ├── App.jsx            # 主界面
│   │   ├── components/
│   │   │   ├── ScriptList.jsx     # 脚本列表
│   │   │   ├── ScriptCard.jsx     # 单个脚本卡片
│   │   │   └── LogPanel.jsx       # 运行日志面板
│   │   ├── hooks/
│   │   │   └── useWebSocket.js    # WebSocket 连接 hook
│   │   └── api.js             # HTTP API 调用封装
│   ├── index.html
│   └── package.json
├── backend/                   # FastAPI 后端
│   ├── app.py                 # FastAPI 应用入口 + WebSocket
│   ├── runner.py              # 脚本运行器（subprocess 管理）
│   └── scanner.py             # 脚本目录扫描
├── scripts/                   # 脚本存放目录
│   └── scraper.py             # 现有爬虫脚本
├── config.py                  # 现有配置
├── requirements.txt           # Python 依赖
└── package.json               # 根 package.json
```

---

## 后端设计（FastAPI）

### 模块

**scanner.py** — 扫描 `scripts/` 目录下所有 `.py` 文件，返回脚本列表（名称、路径、修改时间、文件大小）。

**runner.py** — 用 `asyncio.create_subprocess_exec` 运行脚本：
- 维护运行状态字典：`{script_name: {status, pid, start_time}}`
- 实时读取 stdout/stderr，通过回调推送日志
- 状态流转：`idle` → `running` → `completed` / `failed`
- 同一脚本同一时间只能有一个运行实例

**app.py** — API 路由 + WebSocket：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/scripts` | GET | 获取脚本列表 |
| `/api/scripts/{name}/run` | POST | 运行指定脚本 |
| `/api/scripts/{name}/stop` | POST | 停止运行中的脚本 |
| `/ws` | WebSocket | 实时推送日志和状态变化 |

### WebSocket 消息格式

```json
{"type": "log", "script": "scraper", "data": "Found 10 products."}
{"type": "status", "script": "scraper", "data": "completed"}
```

---

## 前端设计（React）

### 设计语言

暗色主题，VS Code / Raycast 风格。干净、克制、信息密度适中。

### 色板

- 背景：`#0F1117`（主）/ `#161822`（卡片）/ `#1C1F2E`（悬停）
- 强调色：`#6C5CE7`（主紫）/ `#A29BFE`（浅紫）
- 状态：`#00D68F` 成功 / `#FF6B6B` 失败 / `#FFC048` 运行中
- 文字：`#E4E6EF`（主）/ `#8F93A2`（次）
- 边框：`rgba(255,255,255,0.06)`

### 字体

Inter（UI）/ JetBrains Mono（日志）

### 布局：三栏式

**左侧导航栏（48px 宽）**
- 图标导航：脚本列表、文件管理、设置
- 当前页高亮用左侧 2px 紫色竖条指示

**中间脚本列表（260px 宽）**
- 顶部搜索栏 + 刷新按钮
- 脚本卡片：圆角 8px，左侧 3px 状态指示条（颜色随状态变化）
- 卡片内容：脚本名（粗体）、描述（灰色小字）、底部标签（状态 + 文件大小）
- 选中卡片：背景色 `#1C1F2E`，左侧指示条变紫色
- 悬停：微弱背景色变化 + `translateX(2px)` 位移

**右侧详情区（自适应宽度）**
- 上半部：脚本信息卡片（描述、上次运行时间、文件大小），折叠式
- 下半部：日志终端面板
  - 仿终端风格，背景 `#0A0C10`，等宽字体
  - 日志行带时间戳，颜色区分级别（白 info / 黄 warning / 红 error）
  - 自动滚动，右上角锁定/解锁按钮
- 底部操作栏：Run（紫色渐变，悬停发光）/ Stop（ghost 样式，运行中变红色实心）

### 动效

- 状态切换：指示条颜色 `transition: 0.3s ease`
- Running 状态：指示条呼吸动画（opacity 0.5 ↔ 1.0）
- 日志新增：`fadeInUp` 入场
- 按钮点击：`scale(0.97)` 按压反馈

### 底部状态栏（28px 高）

- 左侧：WebSocket 连接状态（绿点 = 已连接）
- 右侧：运行中脚本数 / 总脚本数

---

## Electron 主进程

**main.js：**
- 启动时 `child_process.spawn` 启动 FastAPI（`python backend/app.py`）
- 等待端口就绪后创建 BrowserWindow
- 窗口关闭时 kill FastAPI 子进程
- 开发模式加载 `localhost:5173`，生产模式加载打包后 `index.html`

**窗口配置：**
- 默认：1280 x 800，最小：960 x 600
- 无边框窗口（frameless），自定义标题栏
- 标题栏：左侧 app 名称，右侧窗口控制按钮

**preload.js：**
- 暴露 `window.electronAPI`（如打开文件所在目录）

---

## 数据流

```
用户点击 [▶ Run]
    │
    ▼
React ──POST──▶ /api/scripts/scraper/run
                       │
                       ▼
               runner.py 启动子进程
               python scripts/scraper.py
                       │ (stdout/stderr 实时读取)
                       ▼
    ◀──WebSocket── {"type":"log", ...}
    ◀──WebSocket── {"type":"status", "data":"running"}
    │
    ▼
LogPanel 实时显示，ScriptCard 状态更新
    │
    ... 执行完毕 ...
    │
    ◀──WebSocket── {"type":"status", "data":"completed"}
```

---

## 脚本管理

- 当前阶段：固定目录 `scripts/`，自动扫描发现
- 后续扩展：存储在服务器，通过 API 拉取
