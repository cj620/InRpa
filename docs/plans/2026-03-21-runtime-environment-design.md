# 设计文档：设置模块 - 运行环境诊断

## 概述

将设置面板中现有的"依赖安装"卡片扩展为"运行环境"卡片，提供完整的本地运行时环境诊断功能。

## 改动范围

- `frontend/src/components/SettingsPanel.jsx` — 修改现有卡片
- `electron/main.js` — 添加多项环境检测 IPC handler
- `electron/preload.js` — 暴露新的检测方法

## UI 布局

将"依赖安装"卡片重命名为"运行环境"，每行显示一个检测项：

```
┌─ 运行环境 ──────────────────────────────────────┐
│  ● Python 3.11.9          ✓ 正常     [检测中...]  │
│  ○ Node.js v22.13.0       ✓ 正常                  │
│  ○ .venv                  ✓ 正常                  │
│  ○ Playwright v1.50.1     ✓ Chromium 已安装       │
│  ○ 云端后端 :8000         ✓ 连接正常  [重新检测]  │
│  ○ AI API                 - 未测试                │
└────────────────────────────────────────────────────┘
```

**状态符号：** ● 检测中 / ○ 待检测 / ✓ 正常 / ⚠ 警告 / ✗ 错误

## 检测项

| 检测项 | 检测方式 | 失败标准 |
|--------|----------|----------|
| Python | `python3 --version` | 命令失败或版本 < 3.9 |
| Node | `node --version` | 命令失败 |
| .venv | 检查 `.venv/bin/python3` 是否存在 + 可执行 | 文件不存在 |
| Playwright | Python 脚本用 `playwright.sync_api` 获取版本 | import 失败或浏览器不存在 |
| 云端后端 | HTTP GET `http://localhost:8000/health` | 连接超时或返回非 200 |
| AI API | 通过后端代理测试连接 | 请求失败 |

### Playwright 检测脚本（修复版）

```python
import json
from playwright.sync_api import sync_playwright

try:
    p = sync_playwright().start()
    chromium = p.chromium
    info = {
        "version": p._playwright.version,
        "chromium": chromium.name
    }
    p.stop()
    print(json.dumps(info))
except Exception as e:
    print(json.dumps({"error": str(e)}))
```

## 状态管理

```js
const [envStatus, setEnvStatus] = useState({
  python: { status: "idle" },       // idle | checking | ok | error
  node: { status: "idle" },
  venv: { status: "idle" },
  playwright: { status: "idle", version: null, chromium: null },
  cloudBackend: { status: "idle" },
  aiApi: { status: "idle" },
});
```

**初始行为：** 打开设置面板时自动并行检测，每项独立更新状态。

## 错误处理

- 检测失败不阻塞其他项 — 各自独立显示错误
- 网络相关使用 5 秒超时
- 检测过程中显示 `● 检测中...`，完成后更新为结果
