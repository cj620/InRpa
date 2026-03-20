# StatusBar AI 状态展示 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI model name and connection status display to the bottom status bar, powered by a shared Settings Context.

**Architecture:** Create a SettingsContext that loads settings from the backend on mount and exposes an update function. Both SettingsPanel and StatusBar consume this context. StatusBar shows model name + status dot in the left section, clickable to navigate to settings.

**Tech Stack:** React 19 Context API, existing FastAPI `GET/PUT /api/settings` endpoints, existing `api.js` fetch helpers.

---

### Task 1: Create SettingsContext

**Files:**
- Create: `frontend/src/contexts/SettingsContext.jsx`

**Step 1: Create the context file**

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchSettings, updateSettings as apiUpdateSettings } from "../api";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings()
      .then((data) => setSettings(data))
      .catch((err) => console.error("Failed to load settings:", err))
      .finally(() => setLoading(false));
  }, []);

  const updateSettingsAndSync = useCallback(async (partial) => {
    const data = await apiUpdateSettings(partial);
    setSettings(data);
    return data;
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, setSettings, updateSettings: updateSettingsAndSync }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
```

**Step 2: Verify file created**

Run: `ls frontend/src/contexts/SettingsContext.jsx`
Expected: file exists

**Step 3: Commit**

```bash
git add frontend/src/contexts/SettingsContext.jsx
git commit -m "feat: add SettingsContext for shared settings state"
```

---

### Task 2: Wire SettingsProvider into App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add import and wrap app with SettingsProvider**

At top of `App.jsx`, add import:
```jsx
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
```

Wrap the return JSX: the entire `<div className="app">...</div>` should be wrapped in `<SettingsProvider>...</SettingsProvider>`.

**Step 2: Replace the local theme-loading logic**

Currently `App.jsx` has:
```jsx
const [theme, setTheme] = useState("dark");
// ...
useEffect(() => {
  fetchSettings().then((data) => {
    if (data?.theme) setTheme(data.theme);
  }).catch(() => {});
}, []);
```

Replace this with consuming the context. Since `App` is the component that renders `<SettingsProvider>`, we need to extract the inner app into a child component that can use the hook, OR keep theme state in App and sync from context in StatusBar only.

**Simplest approach:** Keep App's existing theme logic as-is (it already works). The SettingsProvider wraps everything so StatusBar and SettingsPanel can consume it. The theme state stays in App because it also controls DOM `dataset.theme`. Don't over-refactor.

Changes to `App.jsx`:
1. Add import for `SettingsProvider`
2. Wrap return value in `<SettingsProvider>`
3. Pass `onNavigate={handlePageChange}` to `<StatusBar>`
4. Remove `fetchSettings` and `updateSettings` from the import of `./api` (SettingsPanel will use context instead — but keep them for now since theme loading still uses fetchSettings directly)

```jsx
// In the return:
return (
  <SettingsProvider>
    <div className="app">
      {/* ... existing JSX ... */}
      <StatusBar
        connected={connected}
        scripts={scripts}
        statuses={statuses}
        onNavigate={handlePageChange}
      />
    </div>
  </SettingsProvider>
);
```

**Step 3: Verify app still loads**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: wire SettingsProvider into App and pass onNavigate to StatusBar"
```

---

### Task 3: Update StatusBar to show AI model status

**Files:**
- Modify: `frontend/src/components/StatusBar.jsx`
- Modify: `frontend/src/components/StatusBar.css`

**Step 1: Update StatusBar.jsx**

```jsx
import React from "react";
import { useSettings } from "../contexts/SettingsContext";
import "./StatusBar.css";

export default function StatusBar({ connected, scripts, statuses, onNavigate }) {
  const { settings } = useSettings();
  const runningCount = Object.values(statuses).filter((s) => s === "running").length;

  const aiModel = settings?.ai?.model;
  const aiKey = settings?.ai?.api_key;
  const hasKey = aiKey && aiKey.length > 0;

  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span className={`statusbar-dot ${connected ? "connected" : ""}`} />
        <span className="statusbar-text">
          {connected ? "Connected" : "Disconnected"}
        </span>
        <span className="statusbar-separator" />
        <span
          className="statusbar-ai"
          onClick={() => onNavigate?.("settings")}
          title="打开 AI 设置"
        >
          <svg className="statusbar-ai-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="9" cy="16" r="1" />
            <circle cx="15" cy="16" r="1" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span className="statusbar-ai-model">
            {hasKey ? (aiModel || "未设置模型") : "未配置"}
          </span>
          <span className={`statusbar-dot-small ${hasKey ? "configured" : ""}`} />
        </span>
      </div>
      <div className="statusbar-right">
        <span className="statusbar-text">
          {runningCount > 0 ? `${runningCount} running / ` : ""}
          {scripts.length} scripts
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Update StatusBar.css**

Add the following styles after the existing `.statusbar-text` rule:

```css
.statusbar-separator {
  width: 1px;
  height: 12px;
  background: var(--border);
  margin: 0 4px;
}

.statusbar-ai {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  transition: background 0.15s;
}

.statusbar-ai:hover {
  background: var(--bg-hover);
}

.statusbar-ai-icon {
  opacity: 0.7;
  flex-shrink: 0;
}

.statusbar-ai-model {
  color: var(--text-secondary);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
}

.statusbar-dot-small {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-secondary);
  opacity: 0.5;
  transition: background 0.3s, opacity 0.3s;
}

.statusbar-dot-small.configured {
  background: var(--status-success);
  opacity: 1;
}
```

**Step 3: Verify the `--bg-hover` CSS variable exists**

Check `frontend/src/index.css` for `--bg-hover`. If it doesn't exist, add it to all three theme blocks:
- Dark: `--bg-hover: rgba(255, 255, 255, 0.06);`
- Light: `--bg-hover: rgba(0, 0, 0, 0.06);`
- Cream: `--bg-hover: rgba(0, 0, 0, 0.06);`

**Step 4: Verify build succeeds**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add frontend/src/components/StatusBar.jsx frontend/src/components/StatusBar.css frontend/src/index.css
git commit -m "feat: add AI model name and status indicator to StatusBar"
```

---

### Task 4: Migrate SettingsPanel to use SettingsContext

**Files:**
- Modify: `frontend/src/components/SettingsPanel.jsx`

**Step 1: Import and consume context**

At top of `SettingsPanel.jsx`, add:
```jsx
import { useSettings } from "../contexts/SettingsContext";
```

**Step 2: Replace local settings loading with context**

Inside `SettingsPanel`, replace:
```jsx
const [settings, setSettings] = useState(null);
const [original, setOriginal] = useState(null);
const [loading, setLoading] = useState(true);
```

With:
```jsx
const { settings: contextSettings, loading: contextLoading, updateSettings: contextUpdateSettings } = useSettings();
const [settings, setSettings] = useState(null);
const [original, setOriginal] = useState(null);
```

**Step 3: Sync local editing state from context**

Replace the `load` callback and its `useEffect`:
```jsx
const load = useCallback(async () => { ... }, []);
useEffect(() => { load(); }, [load]);
```

With:
```jsx
useEffect(() => {
  if (contextSettings && !original) {
    setSettings({ ...contextSettings });
    setOriginal({ ...contextSettings });
  }
}, [contextSettings, original]);
```

And update the loading check:
```jsx
if ((contextLoading && !settings) || !settings) {
  return (
    <div className="settings-panel">
      <div className="sp-loading">加载设置中...</div>
    </div>
  );
}
```

**Step 4: Update handleSave to use context**

Replace `handleSave`:
```jsx
const handleSave = async () => {
  setSaving(true);
  try {
    const data = await contextUpdateSettings(settings);
    setSettings(data);
    setOriginal(data);
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  } catch (err) {
    console.error("Failed to save settings:", err);
  } finally {
    setSaving(false);
  }
};
```

**Step 5: Remove the unused fetchSettings/updateSettings import from SettingsPanel**

The import line at top of SettingsPanel:
```jsx
import { fetchSettings, updateSettings, testAIConnection } from "../api";
```
Change to:
```jsx
import { testAIConnection } from "../api";
```

**Step 6: Verify build succeeds**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add frontend/src/components/SettingsPanel.jsx
git commit -m "refactor: migrate SettingsPanel to use shared SettingsContext"
```

---

### Task 5: Manual verification

**Step 1: Start the dev environment**

Run: `npm run dev`

**Step 2: Verify StatusBar display**

- If API key is configured: StatusBar shows model name (e.g. `gpt-4o`) with green dot
- If API key is empty: StatusBar shows `未配置` with gray dot
- WebSocket connection indicator still works (green/red dot + text)
- Script count still displays correctly on the right

**Step 3: Verify click navigation**

- Click the AI model area in the StatusBar → navigates to Settings page

**Step 4: Verify settings sync**

- Go to Settings, change the model name, save
- StatusBar should immediately update to show the new model name

**Step 5: Verify theme still works**

- Switch themes in Settings or via Sidebar toggle
- StatusBar colors should adapt correctly

**Step 6: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
