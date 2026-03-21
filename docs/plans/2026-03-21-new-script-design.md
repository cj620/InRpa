# 新建脚本功能设计

## 1. 概述

允许用户在 InRpa 中创建新的 Python 脚本。创建时需要选择目标文件夹，并在 `scripts/` 目录下生成包含基础模板的 `.py` 文件。

## 2. 用户流程

1. 用户在 **脚本管理（FolderTree）** 面板底部点击「新建脚本」按钮
2. 弹出模态对话框，用户输入脚本名称并从下拉列表选择目标文件夹
3. 点击「创建」后，后端在 `scripts/{folder}/` 目录下创建文件
4. 前端刷新脚本列表，自动选中并打开编辑器

## 3. 入口设计

**位置**：FolderTree 面板底部，与「新建文件夹」按钮并列

**按钮样式**：与「新建文件夹」一致，副标签为「新建脚本」

## 4. 模态对话框

### 4.1 布局

```
┌─────────────────────────────────────────┐
│  新建脚本                           [×]  │
├─────────────────────────────────────────┤
│  脚本名称                               │
│  ┌─────────────────────────────────┐   │
│  │ my_script                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  保存到                                 │
│  ┌─────────────────────────────────┐   │
│  │ 📁 请选择文件夹              ▾  │   │
│  └─────────────────────────────────┘   │
│    • 爬虫                              │
│    • 数据处理                           │
│    • 工具脚本                           │
│    • 未分类                             │
│                                         │
├─────────────────────────────────────────┤
│              [取消]    [创建]            │
└─────────────────────────────────────────┘
```

### 4.2 行为规则

- 脚本名称输入框：必填，不允许为空或仅空格
- 文件夹下拉：必选，默认不选中任何项，提示文字「请选择文件夹」
- [创建] 按钮：名称非空且文件夹已选中时启用
- 点击 × 或「取消」关闭对话框，清空所有输入
- 按 Escape 键关闭对话框

## 5. 创建后行为

1. 在 `scripts/{folder}/` 目录下创建 `{name}.py`
2. 写入基础模板内容：
   ```python
   def main():
       pass


   if __name__ == "__main__":
       main()
   ```
3. 刷新脚本列表（loadFolders）
4. 自动选中刚创建的脚本（setSelectedScript）
5. 自动切换到编辑器页面并打开脚本（handleEditScript）

## 6. API 设计

### 6.1 新增接口

**POST /api/scripts**

创建新脚本文件。

Request:
```json
{
  "name": "my_script",
  "folder": "爬虫"
}
```

Response:
```json
{
  "name": "my_script",
  "folder": "爬虫",
  "path": "scripts/爬虫/my_script.py"
}
```

Errors:
- `400` — 名称为空或包含非法字符
- `409` — 同目录下已存在同名脚本

### 6.2 前端 API

`localApi.js` 新增：

```js
export async function createScript(name, folder) {
  return req("/api/scripts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder }),
  });
}
```

## 7. 组件变更

| 文件 | 变更 |
|------|------|
| `frontend/src/components/FolderTree.jsx` | 底部新增「新建脚本」按钮 |
| `frontend/src/components/CreateScriptDialog.jsx` | 新建模态对话框组件 |
| `frontend/src/localApi.js` | 新增 `createScript` 方法 |
| `frontend/src/App.jsx` | 新增 dialog state、onCreateScript 回调 |
| `backend/local_app.py` | 新增 POST /api/scripts endpoint |

## 8. 文件路径规范

脚本文件路径：`scripts/{folder}/{name}.py`

- folder 为空时，创建在 `scripts/` 根目录
- 文件名只允许字母、数字、下划线、中文
- 不允许创建 `__*.py` 文件（系统文件）
