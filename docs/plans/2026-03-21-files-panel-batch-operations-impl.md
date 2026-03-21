# FilesPanel Batch Operations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add batch selection and operations (move/tag/description) to FilesPanel, and remove batch selection from ScriptList.

**Architecture:** FilesPanel gets a checkbox column + inline `···` menus + floating batch action bar. ScriptCard loses its `selectable` prop entirely. The two components share the same modal components for move/tag/description editing.

**Tech Stack:** React (hooks), CSS Modules, existing modal pattern in the codebase.

---

## Task 1: Explore codebase — find modal pattern and API endpoints

**Files:**
- Read: `frontend/src/components/`
- Read: `backend/local_app.py` (for existing API endpoints)

**Step 1: Find existing modal component**

Search for any existing modal/dialog pattern in the frontend components.

Run: `grep -r "modal\|dialog\|Modal" frontend/src/ --include="*.jsx" --include="*.js" -l`

**Step 2: Find the backend API endpoints for move/tag/description**

Run: `grep -n "move\|tag\|description" backend/local_app.py | head -40`

**Step 3: Check if batch endpoints exist**

Run: `grep -n "batch\|bulk" backend/local_app.py`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: research existing modals and API endpoints"
```

---

## Task 2: Read existing modal components and CSS structure

**Files:**
- Read: `frontend/src/components/Modal.jsx` (if exists)
- Read: `frontend/src/components/FilesPanel.css`
- Read: `frontend/src/components/ScriptCard.css`

**Step 1: Check if Modal.jsx exists**

Run: `ls frontend/src/components/Modal*`

**Step 2: Note the CSS class naming convention used in FilesPanel.css and ScriptCard.css for consistency.**

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: review existing modal pattern and CSS conventions"
```

---

## Task 3: Add checkbox column to FilesPanel table

**Files:**
- Modify: `frontend/src/components/FilesPanel.jsx`
- Modify: `frontend/src/components/FilesPanel.css`

**Step 1: Add checkbox state to FilesPanel**

In `FilesPanel.jsx`, add useState:

```jsx
const [selectedScripts, setSelectedScripts] = useState(new Set());
```

**Step 2: Add checkbox column to table header**

In the `<thead>`, add a `<th>` with width 40px before the name column:

```jsx
<th className="files-th-check" style={{ width: 40 }}>
  <input
    type="checkbox"
    className="files-checkbox"
    checked={scripts.length > 0 && selectedScripts.size === scripts.length}
    onChange={(e) => {
      if (e.target.checked) {
        setSelectedScripts(new Set(scripts.map((s) => s.name)));
      } else {
        setSelectedScripts(new Set());
      }
    }}
  />
</th>
```

**Step 3: Add checkbox cell to each table row**

In the `<tbody>`, add before the name `<td>`:

```jsx
<td className="files-check">
  <input
    type="checkbox"
    className="files-checkbox"
    checked={selectedScripts.has(s.name)}
    onChange={(e) => {
      setSelectedScripts((prev) => {
        const next = new Set(prev);
        if (e.target.checked) next.add(s.name);
        else next.delete(s.name);
        return next;
      });
    }}
  />
</td>
```

**Step 4: Add CSS for checkbox column and header alignment**

In `FilesPanel.css`:

```css
.files-th-check,
.files-check {
  width: 40px;
  min-width: 40px;
  text-align: center;
}

.files-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent, #6C5CE7);
}
```

**Step 5: Verify checkbox column renders correctly**

Run: `cd frontend && npm run dev` — open browser and confirm checkboxes appear in table header and each row.

**Step 6: Commit**

```bash
git add frontend/src/components/FilesPanel.jsx frontend/src/components/FilesPanel.css
git commit -m "feat(files): add checkbox column to FilesPanel table"
```

---

## Task 4: Add row-level more-actions menu to FilesPanel

**Files:**
- Modify: `frontend/src/components/FilesPanel.jsx`
- Modify: `frontend/src/components/FilesPanel.css`

**Step 1: Add menu state and refs**

Add inside the component:

```jsx
const [menuOpen, setMenuOpen] = useState(null); // null or script name
const menuRef = useRef(null);
const menuBtnRef = useRef(null);
const [activeScript, setActiveScript] = useState(null);
```

**Step 2: Add useEffect to close menu on outside click**

```jsx
useEffect(() => {
  if (menuOpen === null) return;
  const handler = (e) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(e.target) &&
      !menuBtnRef.current?.contains(e.target)
    ) {
      setMenuOpen(null);
    }
  };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, [menuOpen]);
```

**Step 3: Add menu button and dropdown in each row's actions cell**

Replace the current single edit button in the actions `<td>`:

```jsx
<td className="files-actions">
  <button
    className="files-edit-btn"
    onClick={() => onEdit?.(s.is_draft ? s.parent_name : s.name)}
    title={s.is_draft ? "编辑草稿" : "编辑脚本"}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
    编辑
  </button>
  <div className="files-menu-wrap">
    <button
      ref={menuBtnRef}
      className="files-menu-btn"
      onClick={(e) => {
        e.stopPropagation();
        setMenuOpen(menuOpen === s.name ? null : s.name);
        setActiveScript(s);
      }}
      title="更多操作"
    >
      ···
    </button>
    {menuOpen === s.name && (
      <div className="files-menu" ref={menuRef}>
        <button
          className="files-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(null);
            // TODO: trigger move modal
          }}
        >
          移动到...
        </button>
        <button
          className="files-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(null);
            // TODO: trigger tag modal
          }}
        >
          编辑标签
        </button>
        <button
          className="files-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(null);
            // TODO: trigger description modal
          }}
        >
          编辑描述
        </button>
      </div>
    )}
  </div>
</td>
```

**Step 4: Add CSS for menu**

In `FilesPanel.css`:

```css
.files-menu-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.files-menu-btn {
  background: none;
  border: none;
  color: var(--text-secondary, #8888A0);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm, 6px);
  font-size: 14px;
  line-height: 1;
  transition: color 0.15s, background 0.15s;
}

.files-menu-btn:hover {
  color: var(--text-primary, #E8E8F0);
  background: rgba(255,255,255,0.06);
}

.files-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: #1E1E2E;
  border: 1px solid #2A2D3A;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  min-width: 140px;
  z-index: 100;
  overflow: hidden;
  animation: menu-pop 0.1s ease-out;
}

@keyframes menu-pop {
  from { opacity: 0; transform: scale(0.95) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.files-menu-item {
  display: block;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  color: #E8E8F0;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
}

.files-menu-item:hover {
  background: rgba(108, 92, 231, 0.15);
}

.files-menu-item + .files-menu-item {
  border-top: 1px solid #2A2D3A;
}
```

**Step 5: Verify menu opens/closes correctly**

Run dev server and test clicking the `···` button shows menu, clicking outside closes it.

**Step 6: Commit**

```bash
git add frontend/src/components/FilesPanel.jsx frontend/src/components/FilesPanel.css
git commit -m "feat(files): add row-level more-actions menu to FilesPanel"
```

---

## Task 5: Add floating batch action bar to FilesPanel

**Files:**
- Modify: `frontend/src/components/FilesPanel.jsx`
- Modify: `frontend/src/components/FilesPanel.css`

**Step 1: Add batch action bar below table**

Add after the `</table>` and before the closing `</div>`:

```jsx
{selectedScripts.size > 0 && (
  <div className="batch-bar">
    <span className="batch-bar-count">已选 {selectedScripts.size} 项</span>
    <div className="batch-bar-sep" />
    <button className="batch-bar-btn" onClick={() => {/* TODO: move */}}>
      移动到...
    </button>
    <button className="batch-bar-btn" onClick={() => {/* TODO: tags */}}>
      编辑标签
    </button>
    <button className="batch-bar-btn" onClick={() => {/* TODO: description */}}>
      编辑描述
    </button>
    <div className="batch-bar-sep" />
    <button
      className="batch-bar-cancel"
      onClick={() => setSelectedScripts(new Set())}
    >
      取消
    </button>
  </div>
)}
```

**Step 2: Add batch bar CSS**

In `FilesPanel.css`:

```css
.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #1E1E2E;
  border-radius: 8px;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
  margin-top: 12px;
  animation: bar-slide-in 0.2s ease-out;
}

@keyframes bar-slide-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.batch-bar-count {
  font-size: 13px;
  color: #8888A0;
  white-space: nowrap;
}

.batch-bar-sep {
  width: 1px;
  height: 20px;
  background: #2A2D3A;
}

.batch-bar-btn {
  background: none;
  border: 1px solid #2A2D3A;
  color: #E8E8F0;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s, border-color 0.15s;
}

.batch-bar-btn:hover {
  background: rgba(108, 92, 231, 0.15);
  border-color: #6C5CE7;
}

.batch-bar-cancel {
  background: none;
  border: none;
  color: #8888A0;
  cursor: pointer;
  font-size: 13px;
  padding: 6px 8px;
  transition: color 0.15s;
}

.batch-bar-cancel:hover {
  color: #E8E8F0;
}
```

**Step 3: Verify batch bar appears when checkbox selected**

**Step 4: Commit**

```bash
git add frontend/src/components/FilesPanel.jsx frontend/src/components/FilesPanel.css
git commit -m "feat(files): add floating batch action bar to FilesPanel"
```

---

## Task 6: Build a shared EditModal component for move/tag/description

**Files:**
- Create: `frontend/src/components/EditModal.jsx`
- Create: `frontend/src/components/EditModal.css`

**Step 1: Create EditModal component**

```jsx
import React from "react";
import "./EditModal.css";

export default function EditModal({ title, onClose, onConfirm, confirmLabel = "确认", confirmDisabled = false, loading = false, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="modal-btn-cancel" onClick={onClose}>取消</button>
          <button
            className="modal-btn-confirm"
            onClick={onConfirm}
            disabled={confirmDisabled || loading}
          >
            {loading ? "处理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create EditModal CSS**

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: overlay-fade 0.2s ease-out;
}

@keyframes overlay-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-box {
  background: #1A1D27;
  border: 1px solid #2A2D3A;
  border-radius: 12px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  animation: modal-pop 0.2s ease-out;
}

@keyframes modal-pop {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #2A2D3A;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: #E8E8F0;
}

.modal-close {
  background: none;
  border: none;
  color: #8888A0;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.15s;
}

.modal-close:hover { color: #E8E8F0; }

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #2A2D3A;
}

.modal-btn-cancel,
.modal-btn-confirm {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.modal-btn-cancel {
  background: none;
  border: 1px solid #2A2D3A;
  color: #8888A0;
}

.modal-btn-cancel:hover { color: #E8E8F0; border-color: #8888A0; }

.modal-btn-confirm {
  background: #6C5CE7;
  border: none;
  color: #fff;
}

.modal-btn-confirm:hover:not(:disabled) { background: #7D6DF5; }
.modal-btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
```

**Step 3: Commit**

```bash
git add frontend/src/components/EditModal.jsx frontend/src/components/EditModal.css
git commit -m "feat(ui): add shared EditModal component"
```

---

## Task 7: Wire move modal in FilesPanel

**Files:**
- Modify: `frontend/src/components/FilesPanel.jsx`

**Step 1: Add modal state**

```jsx
const [modalType, setModalType] = useState(null); // null | 'move' | 'tags' | 'description'
```

**Step 2: Import EditModal (assumed created in Task 6)**

```jsx
import EditModal from "./EditModal";
```

**Step 3: Add move modal JSX before the closing div**

```jsx
{modalType === 'move' && (
  <EditModal
    title="移动到文件夹"
    onClose={() => setModalType(null)}
    onConfirm={() => {
      // TODO: call API
      setModalType(null);
    }}
    confirmLabel="确认移动"
  >
    <div className="edit-modal-folders">
      {(folders || []).map((f) => (
        <label key={f.name} className="edit-modal-folder-item">
          <input
            type="radio"
            name="targetFolder"
            value={f.name}
            defaultChecked={f.name === selectedFolder}
          />
          <span>{f.name === "_unsorted" ? "未分类" : f.name}</span>
        </label>
      ))}
    </div>
  </EditModal>
)}
```

**Step 4: Wire the menu items to open modal**

In the row menu, change the `onClick` for "移动到..." to:

```jsx
onClick={(e) => {
  e.stopPropagation();
  setMenuOpen(null);
  setActiveScript(s);
  setModalType('move');
}}
```

In the batch bar "移动到..." button:

```jsx
onClick={() => setModalType('move')}
```

**Step 5: Add CSS for folder list in modal**

In `FilesPanel.css` (or EditModal.css):

```css
.edit-modal-folders {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.edit-modal-folder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}

.edit-modal-folder-item:hover {
  background: rgba(255,255,255,0.05);
}

.edit-modal-folder-item input {
  accent-color: #6C5CE7;
}
```

**Step 6: Test the move modal opens from both row menu and batch bar**

**Step 7: Commit**

```bash
git add frontend/src/components/FilesPanel.jsx
git commit -m "feat(files): wire move modal in FilesPanel"
```

---

## Task 8: Wire tag modal and description modal in FilesPanel

**Files:**
- Modify: `frontend/src/components/FilesPanel.jsx`
- Modify: `frontend/src/components/FilesPanel.css`

**Step 1: Add tag modal state and handler**

Add in the component:

```jsx
const [tagInput, setTagInput] = useState("");
const [scriptTags, setScriptTags] = useState([]);

// open tag modal — init tags from active script or merge from batch
const openTagModal = (scripts) => {
  if (scripts.length === 1) {
    setScriptTags([...(scripts[0].tags || [])]);
  } else {
    setScriptTags([]);
  }
  setModalType('tags');
};
```

**Step 2: Add tag modal JSX**

```jsx
{modalType === 'tags' && (
  <EditModal
    title="编辑标签"
    onClose={() => setModalType(null)}
    onConfirm={() => {
      // TODO: call API with scriptTags
      setModalType(null);
    }}
    confirmLabel="保存"
  >
    <div className="edit-modal-tags">
      <div className="edit-modal-tag-list">
        {scriptTags.map((tag) => (
          <span key={tag} className="edit-modal-tag">
            {tag}
            <button
              onClick={() => setScriptTags((t) => t.filter((x) => x !== tag))}
              className="edit-modal-tag-remove"
            >×</button>
          </span>
        ))}
      </div>
      <input
        className="edit-modal-tag-input"
        type="text"
        placeholder="输入标签后按回车添加"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && tagInput.trim()) {
            e.preventDefault();
            if (!scriptTags.includes(tagInput.trim())) {
              setScriptTags((t) => [...t, tagInput.trim()]);
            }
            setTagInput("");
          }
        }}
      />
    </div>
  </EditModal>
)}
```

**Step 3: Add description modal JSX**

```jsx
const [descValue, setDescValue] = useState("");
const openDescModal = (script) => {
  setDescValue(script?.description || "");
  setActiveScript(script);
  setModalType('description');
};

{modalType === 'description' && (
  <EditModal
    title="编辑描述"
    onClose={() => setModalType(null)}
    onConfirm={() => {
      // TODO: call API with descValue
      setModalType(null);
    }}
    confirmLabel="保存"
  >
    <textarea
      className="edit-modal-textarea"
      rows={4}
      value={descValue}
      onChange={(e) => setDescValue(e.target.value)}
      placeholder="输入脚本描述..."
    />
  </EditModal>
)}
```

**Step 4: Wire menu items**

For row menu:
```jsx
onClick={(e) => {
  e.stopPropagation();
  setMenuOpen(null);
  setActiveScript(s);
  if (action === "move") setModalType('move');
  else if (action === "editTags") { setScriptTags([...(s.tags || [])]); setModalType('tags'); }
  else if (action === "editDescription") { setDescValue(s.description || ""); setModalType('description'); }
}}
```

**Step 5: Add CSS for tag chips and textarea**

```css
.edit-modal-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.edit-modal-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(108, 92, 231, 0.2);
  color: #C4B5FD;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.edit-modal-tag-remove {
  background: none;
  border: none;
  color: #C4B5FD;
  cursor: pointer;
  padding: 0;
  font-size: 14px;
  line-height: 1;
}

.edit-modal-tag-input {
  width: 100%;
  background: #0F1117;
  border: 1px solid #2A2D3A;
  border-radius: 6px;
  color: #E8E8F0;
  padding: 8px 10px;
  font-size: 13px;
  box-sizing: border-box;
}

.edit-modal-tag-input:focus {
  outline: none;
  border-color: #6C5CE7;
}

.edit-modal-textarea {
  width: 100%;
  background: #0F1117;
  border: 1px solid #2A2D3A;
  border-radius: 6px;
  color: #E8E8F0;
  padding: 10px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}

.edit-modal-textarea:focus {
  outline: none;
  border-color: #6C5CE7;
}
```

**Step 6: Commit**

```bash
git add frontend/src/components/FilesPanel.jsx frontend/src/components/FilesPanel.css
git commit -m "feat(files): wire tag and description modals in FilesPanel"
```

---

## Task 9: Remove batch selection from ScriptCard

**Files:**
- Modify: `frontend/src/components/ScriptCard.jsx`
- Modify: `frontend/src/components/ScriptCard.css`

**Step 1: Remove selectable-related props and state**

Remove from props: `selectable`, `isSelected`, `onSelectToggle`

Remove from component:
- `const [menuOpen, setMenuOpen] = useState(false);`
- `const menuRef = useRef(null);`
- `const menuBtnRef = useRef(null);`
- The outside-click useEffect for menu
- The checkbox div rendering
- `handleCheckboxClick`
- `handleCardClick` simplifies to just `onClick?.()`
- `handleMenuToggle` → `handleMenuBtnClick` (just toggles menu)

**Step 2: Simplify card click**

```jsx
const handleCardClick = () => {
  onClick?.();
};
```

**Step 3: Simplify menu toggle handler**

```jsx
const handleMenuBtnClick = (e) => {
  e.stopPropagation();
  setMenuOpen((prev) => !prev);
};
```

**Step 4: Remove checkbox div and simplify top section**

Remove entirely:
```jsx
{selectable && (
  <div className="script-card-checkbox" onClick={handleCheckboxClick}>
    ...
  </div>
)}
```

**Step 5: Remove checkbox CSS from ScriptCard.css**

Remove: `.script-card-checkbox`, `.script-card-checkbox-inner`, and all related styles.

**Step 6: Update ScriptList to remove selectable prop**

In `ScriptList.jsx`, remove `selectable={true}` prop from ScriptCard instances.

**Step 7: Verify ScriptList renders without checkboxes**

**Step 8: Commit**

```bash
git add frontend/src/components/ScriptCard.jsx frontend/src/components/ScriptCard.css frontend/src/components/ScriptList.jsx
git commit -m "refactor(scripts): remove batch selection from ScriptCard"
```

---

## Task 10: Connect FilesPanel to backend API

**Files:**
- Read: `frontend/src/api.js` or `frontend/src/App.jsx` to find API layer
- Modify: `frontend/src/components/FilesPanel.jsx`
- Modify: `backend/local_app.py` (if batch endpoints don't exist)

**Step 1: Find the API client functions**

Run: `grep -n "move\|tag\|description\|batch" frontend/src/api.js 2>/dev/null || grep -rn "move\|tag\|description" frontend/src/*.js | grep -i "fetch\|axios\|post\|get"`

**Step 2: Add API calls in FilesPanel modals**

In the move modal confirm:
```jsx
onConfirm={async () => {
  const formData = new FormData(e.target.form || document.querySelector(".edit-modal-folders"));
  const target = formData.get("targetFolder");
  if (!target) return;
  setLoading(true);
  try {
    await api.post(`/scripts/move`, { script_names: [activeScript?.name], target_folder: target });
    setModalType(null);
    onRefresh?.();
  } catch (err) {
    alert("移动失败: " + err.message);
  } finally {
    setLoading(false);
  }
}}
```

**Step 3: If API endpoints don't exist, add them to backend/local_app.py**

(Do this only if grep in Step 1 finds no existing endpoints.)

**Step 4: Commit**

```bash
git add backend/local_app.py  # if changed
git add frontend/src/components/FilesPanel.jsx
git commit -m "feat(files): connect FilesPanel to backend API"
```

---

## Task 11: Test the complete flow manually

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Navigate to Files page, test:**
- [ ] Checkbox column appears in table header and rows
- [ ] Clicking checkbox selects/deselects rows
- [ ] Header checkbox selects/deselects all
- [ ] Selecting any row shows the floating batch action bar
- [ ] Clicking `···` on a row shows the menu (move/tags/description)
- [ ] Each menu item opens the correct modal
- [ ] Move modal shows folder list and calls API on confirm
- [ ] Tag modal allows adding/removing tags
- [ ] Description modal allows editing description
- [ ] Batch bar "移动到..." opens move modal
- [ ] Batch bar "编辑标签" opens tag modal (merged tags for batch)
- [ ] Batch bar "编辑描述" opens description modal
- [ ] Cancel in batch bar clears selection and hides bar

**Step 3: Navigate to Scripts page, test:**
- [ ] No checkbox on any card
- [ ] Clicking a card selects it (shows selected state)
- [ ] "更多操作" menu still works on each card

**Step 4: Commit**

```bash
git add -A
git commit -m "test: manual testing of FilesPanel and ScriptList changes"
```
