# Runtime Env Refresh Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a refresh button in the "Runtime Environment" card header to re-run environment checks on demand.

**Architecture:** Small UI-only change to SettingsPanel.抽取 RefreshIcon 组件，在 card header 绝对定位按钮，点击触发 checkEnv 流程。

**Tech Stack:** React (JSX), CSS

---

### Task 1: Add RefreshIcon component and CSS

**Files:**
- Modify: `frontend/src/components/SettingsPanel.jsx:1-100`
- Modify: `frontend/src/components/SettingsPanel.css:506-528`

**Step 1: Add RefreshIcon component after SpinnerIcon (line ~48)**

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

**Step 2: Add CSS for refresh button (after .sp-env-dot styles, line ~527)**

```css
/* ── Refresh Button ─────────────────────────────────────── */

.sp-refresh-btn {
  position: absolute;
  right: 0;
  top: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.sp-refresh-btn:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.sp-refresh-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@keyframes sp-refresh-spin {
  to {
    transform: rotate(360deg);
  }
}

.sp-refresh-icon--spinning {
  animation: sp-refresh-spin 0.8s linear infinite;
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/SettingsPanel.jsx frontend/src/components/SettingsPanel.css
git commit -m "feat(settings): add RefreshIcon component and CSS"
```

---

### Task 2: Wire refresh button to card header and logic

**Files:**
- Modify: `frontend/src/components/SettingsPanel.jsx:166-215`, `474-501`

**Step 1: Add isEnvRefreshing state (after envStatus state, line ~173)**

```jsx
const [isEnvRefreshing, setIsEnvRefreshing] = useState(false);
```

**Step 2: Extract checkEnv logic into a named function (after envStatus useEffect, line ~215)**

```jsx
const runEnvCheck = () => {
  if (!window.electronAPI?.checkEnv) return;
  setIsEnvRefreshing(true);
  setEnvStatus({
    python: { status: "checking" },
    node: { status: "checking" },
    venv: { status: "checking" },
    playwright: { status: "checking" },
    cloudBackend: { status: "checking" },
    aiApi: { status: "idle" },
  });
  window.electronAPI.checkEnv().then((results) => {
    setEnvStatus({
      python:   { status: results.python?.ok ? "ok" : "error",   version: results.python?.version,   error: results.python?.error },
      node:     { status: results.node?.ok ? "ok" : "error",     version: results.node?.version,     error: results.node?.error },
      venv:     { status: results.venv?.ok ? "ok" : "error",     error: results.venv?.error },
      playwright: { status: results.playwright?.ok ? "ok" : "error", version: results.playwright?.version, chromium: results.playwright?.chromium, error: results.playwright?.error },
      cloudBackend: { status: results.cloudBackend?.ok ? "ok" : "error", statusCode: results.cloudBackend?.status, error: results.cloudBackend?.error },
      aiApi: { status: "idle" },
    });
    setIsEnvRefreshing(false);
  }).catch(() => {
    setEnvStatus({
      python:   { status: "error", error: "检查失败" },
      node:     { status: "error", error: "检查失败" },
      venv:     { status: "error", error: "检查失败" },
      playwright: { status: "error", error: "检查失败" },
      cloudBackend: { status: "error", error: "检查失败" },
      aiApi:    { status: "idle" },
    });
    setIsEnvRefreshing(false);
  });
};
```

**Step 3: Update the initial useEffect to call runEnvCheck instead of inline code (line ~185)**

Replace the entire checkEnv useEffect body with:
```jsx
useEffect(() => {
  runEnvCheck();
}, []);
```

**Step 4: Add refresh button inside the Runtime Environment card, after the card-header div (around line 476)**

In the JSX for Card 4 (Runtime Environment), add the button inside the card-header wrapper:

```jsx
<div className="sp-card-header">
  运行环境
  <button
    type="button"
    className="sp-refresh-btn"
    onClick={runEnvCheck}
    disabled={isEnvRefreshing}
    title="重新检测"
  >
    <RefreshIcon spinning={isEnvRefreshing} />
  </button>
</div>
```

Note: The parent `sp-card-header` needs `position: relative` in CSS. Add it if not present.

**Step 5: Run and verify**

Start dev server: `npm run dev:frontend`
Navigate to Settings → verify "运行环境" card has a refresh icon in top-right of header
Click it → all env items show checking state → results update
Click while checking → button is disabled

**Step 6: Commit**

```bash
git add frontend/src/components/SettingsPanel.jsx frontend/src/components/SettingsPanel.css
git commit -m "feat(settings): wire refresh button to runEnvCheck"
```

---

### Task 3: Add position:relative to sp-card-header

**Files:**
- Modify: `frontend/src/components/SettingsPanel.css:47-54`

**Step 1: Update sp-card-header CSS**

```css
.sp-card-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  position: relative; /* ← add this */
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/SettingsPanel.css
git commit -m "style(settings): add position:relative to sp-card-header for refresh btn positioning"
```
