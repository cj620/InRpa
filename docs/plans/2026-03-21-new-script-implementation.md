# 新建脚本功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 允许用户在 InRpa 中创建新的 Python 脚本，创建时选择目标文件夹，自动生成基础模板并打开编辑器。

**Architecture:**
- 前端：新增 CreateScriptDialog 组件 + FolderTree 底部按钮 + localApi.createScript
- 后端 local（port 8001）：新增 POST /api/scripts 创建脚本文件
- metadata 更新走 cloud_api（port 8000）的 PUT /api/scripts/{name}/folder

**Tech Stack:** React 19, FastAPI, httpx

---

## 任务 1: 后端 — local_app.py 新增 POST /api/scripts

**Files:**
- Modify: `backend/local_app.py`

**Step 1: 添加 create_script 函数**

在 `backend/local_app.py` 文件末尾（在 `# ── WebSocket ─────────────────────────────────────────────────────────────────` 之前）添加：

```python
# ── Script creation ───────────────────────────────────────────────────────────

TEMPLATE_CONTENT = '''def main():
    pass


if __name__ == "__main__":
    main()
'''

def _validate_script_name(name: str) -> str | None:
    """Validate script name. Returns error message or None if valid."""
    if not name or not name.strip():
        return "脚本名称不能为空"
    import re
    if not re.match(r'^[\w\u4e00-\u9fff]+$', name):
        return "脚本名称只能包含字母、数字、下划线、中文"
    if name.startswith("__"):
        return "不能使用 __ 开头"
    return None


@app.post("/api/scripts")
async def create_script(body: dict):
    """Create a new script file in scripts/ directory.

    Request: { "name": "my_script", "folder": "爬虫" }
    Response: { "name": "my_script", "folder": "爬虫", "path": "scripts/my_script.py" }
    """
    name = (body.get("name") or "").strip()
    folder = body.get("folder")

    err = _validate_script_name(name)
    if err:
        return JSONResponse(status_code=400, content={"error": err})

    script_path = os.path.join(SCRIPTS_DIR, f"{name}.py")
    if os.path.exists(script_path):
        return JSONResponse(status_code=409, content={"error": f"脚本 '{name}' 已存在"})

    os.makedirs(SCRIPTS_DIR, exist_ok=True)
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(TEMPLATE_CONTENT)

    return {"name": name, "folder": folder, "path": script_path}
```

**Step 2: 运行测试验证新端点存在**

Run: `curl -s -X POST http://localhost:8001/api/scripts -H "Content-Type: application/json" -d '{"name":"test_script","folder":"测试"}' | python3 -m json.tool`
Expected: `{"name":"test_script","folder":"测试","path":".../scripts/test_script.py"}`

**Step 3: 提交**

```bash
git add backend/local_app.py
git commit -m "feat(backend): 添加 POST /api/scripts 创建脚本文件端点"
```

---

## 任务 2: 前端 — localApi.js 新增 createScript 方法

**Files:**
- Modify: `frontend/src/localApi.js:68-79`

**Step 1: 添加 createScript 方法**

在 `localApi.js` 末尾（`openExternal` 函数之后）添加：

```js
export async function createScript(name, folder) {
  return req("/api/scripts", {
    method: "POST",
    headers: { "Content-Type: application/json" },
    body: JSON.stringify({ name, folder }),
  });
}
```

**Step 2: 确认 api.js 导出**

检查 `frontend/src/api.js` 是否已从 localApi 导出。查看现有导出确认不需要修改。

**Step 3: 提交**

```bash
git add frontend/src/localApi.js
git commit -m "feat(frontend): 添加 createScript API 方法"
```

---

## 任务 3: 前端 — CreateScriptDialog 组件

**Files:**
- Create: `frontend/src/components/CreateScriptDialog.jsx`
- Create: `frontend/src/components/CreateScriptDialog.css`

**Step 1: 创建 CreateScriptDialog.jsx**

```jsx
import React, { useState, useEffect, useRef } from "react";
import "./CreateScriptDialog.css";

export default function CreateScriptDialog({ folders = [], onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownBtnRef = useRef(null);

  const realFolders = folders.filter((f) => f.name !== "_unsorted");
  const selectedFolderObj = folders.find((f) => f.name === selectedFolder);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!folderDropdownOpen) return;
    const handler = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !dropdownBtnRef.current?.contains(e.target)
      ) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [folderDropdownOpen]);

  const handleSubmit = () => {
    if (!name.trim() || !selectedFolder) return;
    onConfirm(name.trim(), selectedFolder);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Enter" && name.trim() && selectedFolder) {
      handleSubmit();
    }
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box create-script-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">新建脚本</span>
          <button className="dialog-close" onClick={onCancel} title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="dialog-body">
          <div className="form-field">
            <label className="form-label">脚本名称</label>
            <input
              ref={inputRef}
              className="form-input"
              type="text"
              placeholder="例如: my_scraper"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="form-field">
            <label className="form-label">保存到</label>
            <div className="dropdown-wrap">
              <button
                ref={dropdownBtnRef}
                className={`dropdown-btn ${selectedFolder ? "" : "dropdown-btn--placeholder"}`}
                onClick={() => setFolderDropdownOpen((v) => !v)}
                type="button"
              >
                <span className="dropdown-btn-icon">
                  {selectedFolderObj ? (selectedFolderObj.icon || "📁") : "📁"}
                </span>
                <span className="dropdown-btn-text">
                  {selectedFolderObj ? selectedFolderObj.name : "请选择文件夹"}
                </span>
                <span className="dropdown-btn-arrow">▾</span>
              </button>

              {folderDropdownOpen && (
                <div ref={dropdownRef} className="dropdown-list">
                  {realFolders.length === 0 ? (
                    <div className="dropdown-empty">还没有创建任何文件夹</div>
                  ) : (
                    realFolders.map((f) => (
                      <button
                        key={f.name}
                        className={`dropdown-item ${selectedFolder === f.name ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedFolder(f.name);
                          setFolderDropdownOpen(false);
                        }}
                        type="button"
                      >
                        <span className="dropdown-item-icon">{f.icon || "📁"}</span>
                        <span className="dropdown-item-text">{f.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button type="button" className="dialog-btn dialog-btn--cancel" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="dialog-btn dialog-btn--confirm"
            disabled={!name.trim() || !selectedFolder}
            onClick={handleSubmit}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 创建 CreateScriptDialog.css**

```css
.create-script-dialog {
  min-width: 380px;
}

.dialog-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-input {
  height: 36px;
  padding: 0 12px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
}

.form-input:focus {
  border-color: var(--accent);
}

.form-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.dropdown-wrap {
  position: relative;
}

.dropdown-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.dropdown-btn:focus {
  border-color: var(--accent);
}

.dropdown-btn--placeholder {
  color: var(--text-secondary);
}

.dropdown-btn-icon {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

.dropdown-btn-text {
  flex: 1;
  text-align: left;
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-btn-arrow {
  font-size: 10px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.dropdown-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s;
  text-align: left;
}

.dropdown-item:hover {
  background: var(--bg-hover);
}

.dropdown-item.selected {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.dropdown-item-icon {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

.dropdown-item-text {
  flex: 1;
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--text-primary);
}

.dropdown-empty {
  padding: 16px;
  text-align: center;
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--text-secondary);
}
```

**Step 3: 提交**

```bash
git add frontend/src/components/CreateScriptDialog.jsx frontend/src/components/CreateScriptDialog.css
git commit -m "feat(frontend): 新建 CreateScriptDialog 组件"
```

---

## 任务 4: 前端 — FolderTree 添加"新建脚本"按钮

**Files:**
- Modify: `frontend/src/components/FolderTree.jsx`（添加 onCreateScript prop 和底部按钮）
- Modify: `frontend/src/components/FolderTree.css`（新增按钮样式）

**Step 1: 修改 FolderTree.jsx props**

在 `FolderTree` 函数参数中添加 `onCreateScript`：

```js
export default function FolderTree({
  folders = [],
  selectedFolder = "all",
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  collapsed = false,
  onToggleCollapse,
  draggingScript = null,
  onFolderDrop,
  onCreateScript,   // <-- 新增
}) {
```

在底部 `folder-tree__footer` 中，在「新建文件夹」按钮旁边添加「新建脚本」按钮：

```jsx
<div className="folder-tree__footer">
  <button
    className="folder-tree__new-btn"
    onClick={() => {
      setNewFolderInput(true);
      setNewFolderName("");
    }}
  >
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
    新建文件夹
  </button>
  <button
    className="folder-tree__new-btn folder-tree__new-btn--script"
    onClick={() => onCreateScript?.()}
  >
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
    新建脚本
  </button>
</div>
```

**Step 2: 添加 CSS**

在 `FolderTree.css` 底部添加：

```css
.folder-tree__footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-top: 1px solid var(--border);
}

.folder-tree__new-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--text-secondary);
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.folder-tree__new-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.folder-tree__new-btn--script {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.folder-tree__new-btn--script:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
```

**Step 3: 提交**

```bash
git add frontend/src/components/FolderTree.jsx frontend/src/components/FolderTree.css
git commit -m "feat(frontend): FolderTree 添加新建脚本按钮"
```

---

## 任务 5: 前端 — App.jsx 集成

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: 导入 CreateScriptDialog**

在 `App.jsx` 顶部的 import 中添加：

```jsx
import CreateScriptDialog from "./components/CreateScriptDialog";
```

**Step 2: 添加 state**

在 `App` 组件的 state 定义区域添加：

```jsx
const [createScriptDialog, setCreateScriptDialog] = useState(null); // null or folders list
```

**Step 3: 添加 handleCreateScript 回调**

在回调区域（`handleDescSave` 之后）添加：

```jsx
const handleCreateScript = useCallback(async (name, folder) => {
  try {
    await createScript(name, folder);
    await loadFolders();
    setSelectedScript(name);
    handleEditScript(name);
  } catch (err) {
    console.error("Failed to create script:", err);
  }
  setCreateScriptDialog(null);
}, [loadFolders]);
```

**Step 4: 在 FolderTree 上传递 onCreateScript**

找到 App.jsx 中 FolderTree 组件的调用，在其 props 中添加：

```jsx
<FolderTree
  folders={folders}
  selectedFolder={selectedFolder}
  onSelectFolder={setSelectedFolder}
  onCreateFolder={handleCreateFolder}
  onRenameFolder={handleRenameFolder}
  onDeleteFolder={handleDeleteFolder}
  collapsed={folderTreeCollapsed}
  onToggleCollapse={() => setFolderTreeCollapsed((v) => !v)}
  draggingScript={null}
  onFolderDrop={null}
  onCreateScript={() => setCreateScriptDialog(folders)}  // <-- 新增
/>
```

**Step 5: 在 render 中添加 CreateScriptDialog**

在 App.jsx return 的 JSX 中，在 MoveToDialog 渲染附近添加：

```jsx
{createScriptDialog && (
  <CreateScriptDialog
    folders={createScriptDialog}
    onConfirm={handleCreateScript}
    onCancel={() => setCreateScriptDialog(null)}
  />
)}
```

**Step 6: 确保 createScript 从 api 导入**

确认 `createScript` 函数在 `App.jsx` 顶部从 `api.js` 导入。如果 `api.js` 只 re-exports localApi 的函数，需要在 `localApi.js` 中添加后，在 `api.js` 中导出。

检查 `frontend/src/api.js` 第 17-33 行，确认 `createScript` 需要被添加导出。

实际上，由于 `createScript` 在 `localApi.js` 中，需要在 `api.js` 中添加导出：

在 `frontend/src/api.js` 的 `localApi` 导出部分，添加 `createScript`。

**Step 7: 提交**

```bash
git add frontend/src/App.jsx frontend/src/api.js
git commit -m "feat(frontend): App.jsx 集成新建脚本功能"
```

---

## 任务 6: 后端测试

**Files:**
- Modify: `tests/test_local_app.py`

**Step 1: 写测试**

在 `test_local_app.py` 中添加：

```python
import os
import pytest
from httpx import AsyncClient, ASGITransport
from backend.local_app import app


@pytest.mark.asyncio
async def test_create_script():
    """POST /api/scripts should create a .py file with template content."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts", json={"name": "test_new_script", "folder": "测试"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "test_new_script"
    assert data["folder"] == "测试"
    # Verify file exists
    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")
    script_path = os.path.join(scripts_dir, "test_new_script.py")
    assert os.path.exists(script_path)
    with open(script_path) as f:
        content = f.read()
    assert "def main():" in content
    assert 'if __name__ == "__main__":' in content
    # Cleanup
    os.remove(script_path)


@pytest.mark.asyncio
async def test_create_script_duplicate():
    """Creating a script that already exists should return 409."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First create
        await client.post("/api/scripts", json={"name": "dup_test", "folder": "测试"})
        # Second create - should fail
        resp = await client.post("/api/scripts", json={"name": "dup_test", "folder": "测试"})
    assert resp.status_code == 409
    # Cleanup
    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")
    path = os.path.join(scripts_dir, "dup_test.py")
    if os.path.exists(path):
        os.remove(path)


@pytest.mark.asyncio
async def test_create_script_invalid_name():
    """Empty or invalid script names should return 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts", json={"name": "", "folder": "测试"})
    assert resp.status_code == 400

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/scripts", json={"name": "__system", "folder": "测试"})
    assert resp.status_code == 400
```

**Step 2: 运行测试**

Run: `pytest tests/test_local_app.py -v`
Expected: 所有测试 PASS

**Step 3: 提交**

```bash
git add tests/test_local_app.py
git commit -m "test: 添加 POST /api/scripts 端点测试"
```

---

## 任务 7: 端到端验证

**Step 1: 启动服务**

```bash
npm run dev
```

**Step 2: 手动测试流程**

1. 打开应用，进入「文件」页面
2. FolderTree 底部应该看到「新建脚本」按钮
3. 点击按钮，弹出对话框
4. 输入脚本名称如 `hello_world`，选择目标文件夹
5. 点击「创建」
6. 应该自动跳转到编辑器并打开新脚本
7. 验证 `scripts/hello_world.py` 文件已创建，内容为基础模板

**Step 3: 提交**

（如果端到端验证通过，提交所有剩余更改）
