# 云端后端 + 本地执行引擎 设计文档

**日期：** 2026-03-21
**状态：** 已批准，待实现

## 背景

InRpa 当前是全本地架构：FastAPI 后端与 Electron 桌面端运行在同一台机器上。
目标：将脚本管理功能迁移到云端服务器，桌面端从云端同步脚本后在本地执行（Playwright 控制本地浏览器），实现后端与桌面端完全解耦。

## 核心原则

- **云端 = 脚本仓库**：存储脚本文件、元数据、文件夹，无状态，不涉及执行
- **本地 = 执行引擎**：同步脚本到本地磁盘后运行，WebSocket 推送日志
- **开发与生产唯一区别**：`settings.json` 中的 `cloud_url` 字段
  - 开发：`http://localhost:8000`
  - 生产：`https://your-server.com`

## 整体架构

```
┌─────────────────────────────────────────────────────┐
│                    云端服务器                         │
│  cloud_app.py (FastAPI, :8000)                      │
│  ├── 脚本文件存储 (scripts/*.py)                    │
│  ├── 元数据/文件夹 (scripts_data.json)              │
│  └── API:                                           │
│       GET  /api/scripts            列举脚本+hash    │
│       GET  /api/scripts/{name}/content 下载脚本     │
│       POST/PUT/DELETE /api/scripts  脚本 CRUD       │
│       GET/POST/PUT/DELETE /api/folders              │
│       PUT  /api/scripts/{name}/meta                 │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP (cloud_url 可配置)
┌───────────────────────▼─────────────────────────────┐
│                   本地桌面端                          │
│                                                     │
│  Electron main.js                                   │
│  ├── 生产模式拉起 local_app.py (:8001)              │
│  └── 启动时触发脚本同步                              │
│                                                     │
│  本地执行服务 localhost:8001                         │
│  ├── POST /api/scripts/{name}/run                   │
│  ├── POST /api/scripts/{name}/stop                  │
│  ├── WS   /ws  (日志推送)                           │
│  ├── 草稿接口 (本地编辑)                            │
│  └── AI 接口                                        │
│                                                     │
│  React 前端                                         │
│  ├── 脚本管理 UI → cloudApi.js → 云端               │
│  └── 执行/日志 UI → localApi.js → 本地:8001         │
└─────────────────────────────────────────────────────┘
```

## 启动同步流程

1. 桌面端启动，StatusBar 显示"正在同步脚本..."
2. `GET {cloud_url}/api/scripts` → 返回 `[{ name, hash, updated_at }, ...]`
3. 与本地 `scripts/` 目录文件对比（MD5 hash）：
   - 云端有、本地无 → 下载
   - hash 不一致 → 覆盖更新
   - 本地有、云端无 → 保留（不删除，防误操作）
4. `GET {cloud_url}/api/scripts/{name}/content` 下载内容，写入 `scripts/{name}.py`
5. 同步完成，UI 解锁
6. 同步失败（云端不可达）→ 提示"使用本地缓存"，已有脚本仍可执行

手动同步：前端保留"同步"按钮，随时触发。

## 代码改动范围

### 后端

| 文件 | 变化 |
|------|------|
| `backend/app.py` | 保留作参考，功能拆入以下两个文件 |
| `backend/cloud_app.py` | 新增：脚本管理 + CRUD + 文件下载（供云端部署） |
| `backend/local_app.py` | 新增：执行 + WebSocket + 草稿 + AI（供本地运行） |
| `backend/runner.py` | 不变 |
| `backend/scanner.py` | 不变 |
| `backend/scripts_data.py` | 不变（云端使用） |

`cloud_app.py` 在脚本列表响应中增加 `hash` 字段（文件内容 MD5）。

### 前端

| 文件 | 变化 |
|------|------|
| `frontend/src/api.js` | 拆成 `cloudApi.js`（管理）和 `localApi.js`（执行） |
| `frontend/src/hooks/useWebSocket.js` | WebSocket 指向本地执行服务 `:8001` |
| `frontend/src/App.jsx` | 启动时调用脚本同步逻辑 |
| `frontend/src/components/SettingsPanel` | 新增云端 URL 配置项 |

### Electron

| 文件 | 变化 |
|------|------|
| `electron/main.js` | 生产模式拉起 `local_app.py`（端口 8001） |

## 端口约定

| 服务 | 端口 | 说明 |
|------|------|------|
| 云端管理服务 | 8000 | 开发时本地运行，生产时部署到服务器 |
| 本地执行服务 | 8001 | 始终在桌面机器本地运行 |

## 不在本次范围内

- 身份认证（后续迭代）
- 脚本版本历史
- 多用户权限隔离
