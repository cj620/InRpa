# Theme Switcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three switchable themes (Dark, Light, Cream) with smooth transitions, dual entry points (sidebar toggle + settings panel), and backend persistence.

**Architecture:** CSS variables + `data-theme` attribute on `<html>`. Two new CSS rule blocks (`[data-theme="light"]`, `[data-theme="cream"]`) override `:root` variables. Theme state managed in `App.jsx` and passed via props. Persisted via existing backend settings API.

**Tech Stack:** React 19, CSS custom properties, FastAPI settings endpoint

**Design doc:** `docs/plans/2026-03-20-theme-switcher-design.md`

---

## Task 1: Add `theme` field to backend settings

**Files:**
- Modify: `backend/settings.py:13-26` (DEFAULT_SETTINGS)
- Test: `tests/test_settings.py`

**Step 1: Write the failing test**

Add to `tests/test_settings.py`:

```python
@pytest.mark.asyncio
async def test_theme_in_default_settings():
    """Default settings should include theme field."""
    result = settings_mod.load_settings()
    assert result["theme"] == "dark"


@pytest.mark.asyncio
async def test_update_theme_setting():
    """PUT /api/settings should persist theme choice."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/settings", json={"theme": "light"})
    assert resp.status_code == 200
    assert resp.json()["theme"] == "light"
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_settings.py::test_theme_in_default_settings tests/test_settings.py::test_update_theme_setting -v`
Expected: FAIL — `"theme"` key missing from defaults

**Step 3: Add theme to DEFAULT_SETTINGS**

In `backend/settings.py`, add `"theme"` to `DEFAULT_SETTINGS`:

```python
DEFAULT_SETTINGS = {
    "ai": {
        "provider": "openai",
        "api_url": "https://api.openai.com/v1",
        "api_key": "",
        "model": "gpt-4o"
    },
    "editor": {
        "font_size": 14,
        "tab_size": 4,
        "word_wrap": True
    },
    "scripts_dir": "./scripts",
    "theme": "dark"
}
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_settings.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/settings.py tests/test_settings.py
git commit -m "feat: add theme field to backend settings defaults"
```

---

## Task 2: Add Light and Cream CSS theme variables

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: Add `[data-theme="light"]` and `[data-theme="cream"]` variable blocks**

After the existing `:root { ... }` block (line 25), add:

```css
[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-card: #F5F5F7;
  --bg-hover: #E8E8EC;
  --bg-terminal: #F0F0F2;

  --accent: #6C5CE7;
  --accent-light: #5A4BD1;

  --text-primary: #1A1A2E;
  --text-secondary: #6B6B80;

  --border: rgba(0, 0, 0, 0.08);
}

[data-theme="cream"] {
  --bg-primary: #F8F7F5;
  --bg-card: #EEECEA;
  --bg-hover: #E5E3E0;
  --bg-terminal: #EDEAE7;

  --accent: #6C5CE7;
  --accent-light: #5A4BD1;

  --text-primary: #2C2C2C;
  --text-secondary: #7A7872;

  --border: rgba(0, 0, 0, 0.06);
}
```

**Step 2: Add smooth transition to body**

In the existing `body` rule, add transition:

```css
body {
  font-family: var(--font-ui);
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  -webkit-app-region: no-drag;
  user-select: none;
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

**Step 3: Update scrollbar colors for light themes**

Replace the existing scrollbar-thumb rules with CSS-variable-driven versions:

```css
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.1));
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-hover, rgba(255, 255, 255, 0.2));
  border-radius: 3px;
}
```

And add scrollbar variables to each theme block:

- `:root` — add `--scrollbar-thumb: rgba(255,255,255,0.1); --scrollbar-hover: rgba(255,255,255,0.2);`
- `[data-theme="light"]` — add `--scrollbar-thumb: rgba(0,0,0,0.15); --scrollbar-hover: rgba(0,0,0,0.25);`
- `[data-theme="cream"]` — add `--scrollbar-thumb: rgba(0,0,0,0.1); --scrollbar-hover: rgba(0,0,0,0.18);`

**Step 4: Verify manually**

Open browser devtools, set `document.documentElement.dataset.theme = "light"` — all colors should switch. Same for `"cream"`. Remove attribute to return to dark.

**Step 5: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add light and cream theme CSS variables"
```

---

## Task 3: Wire theme state in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add theme state and DOM sync**

Add to `App.jsx` after existing state declarations (~line 21):

```jsx
const [theme, setTheme] = useState("dark");
```

Add a `useEffect` that syncs theme to DOM and loads from settings:

```jsx
// Apply theme to DOM whenever it changes
useEffect(() => {
  if (theme === "dark") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}, [theme]);
```

**Step 2: Initialize theme from settings on load**

Modify the existing `loadScripts` callback or add a separate effect. The simplest approach: read theme from the settings fetch. Since `SettingsPanel` already fetches settings independently, we add a lightweight theme-only init in App:

```jsx
// Load theme from backend on mount
useEffect(() => {
  fetchSettings().then((data) => {
    if (data?.theme) setTheme(data.theme);
  }).catch(() => {});
}, []);
```

Import `fetchSettings` — it's already imported via `api.js` but needs to be added to the import:

```jsx
import { fetchScripts, runScript, stopScript, fetchSettings, updateSettings } from "./api";
```

**Step 3: Create theme change handler**

```jsx
const handleThemeChange = useCallback((newTheme) => {
  setTheme(newTheme);
  updateSettings({ theme: newTheme }).catch((err) =>
    console.error("Failed to save theme:", err)
  );
}, []);
```

**Step 4: Pass theme props to Sidebar and SettingsPanel**

Update Sidebar usage:
```jsx
<Sidebar activePage={activePage} onPageChange={handlePageChange} theme={theme} onThemeChange={handleThemeChange} />
```

Update SettingsPanel usage:
```jsx
<SettingsPanel theme={theme} onThemeChange={handleThemeChange} />
```

**Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: wire theme state in App with DOM sync and persistence"
```

---

## Task 4: Add theme toggle to Sidebar

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`
- Modify: `frontend/src/components/Sidebar.css`

**Step 1: Add theme icons and cycle logic to Sidebar.jsx**

Accept `theme` and `onThemeChange` props. Add a theme toggle button between settings and collapse buttons:

```jsx
const THEME_CYCLE = ["dark", "light", "cream"];
const THEME_LABELS = { dark: "暗黑", light: "明亮", cream: "奶油" };

const themeIcons = {
  dark: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  light: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  cream: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  ),
};
```

Add to `Sidebar` component signature:
```jsx
export default function Sidebar({ activePage, onPageChange, theme, onThemeChange }) {
```

Add the cycle handler:
```jsx
const cycleTheme = () => {
  const idx = THEME_CYCLE.indexOf(theme);
  const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
  onThemeChange(next);
};
```

Add the toggle button in `sidebar-bottom`, between settings and collapse:
```jsx
<button
  className="sidebar-btn sidebar-theme-toggle"
  onClick={cycleTheme}
  title={`主题: ${THEME_LABELS[theme]} — 点击切换`}
>
  <span className="sidebar-btn-icon">{themeIcons[theme]}</span>
  {expanded && <span className="sidebar-btn-label">{THEME_LABELS[theme]}</span>}
</button>
```

**Step 2: Add theme toggle styles to Sidebar.css**

```css
.sidebar-theme-toggle {
  color: var(--text-secondary);
  opacity: 0.7;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}

.sidebar-theme-toggle:hover {
  opacity: 1;
}
```

**Step 3: Verify manually**

Click the theme button in sidebar — should cycle dark → light → cream → dark with smooth color transitions.

**Step 4: Commit**

```bash
git add frontend/src/components/Sidebar.jsx frontend/src/components/Sidebar.css
git commit -m "feat: add theme cycle toggle to sidebar"
```

---

## Task 5: Add theme selector to SettingsPanel

**Files:**
- Modify: `frontend/src/components/SettingsPanel.jsx`
- Modify: `frontend/src/components/SettingsPanel.css`

**Step 1: Add theme props and selector UI to SettingsPanel.jsx**

Update component signature:
```jsx
export default function SettingsPanel({ theme, onThemeChange }) {
```

Add a theme selector in the "通用设置" card, as the first field. Use a segmented control (three buttons):

```jsx
{/* Theme selector */}
<div className="sp-field sp-field--row">
  <label className="sp-label">主题</label>
  <div className="sp-theme-selector">
    <button
      type="button"
      className={`sp-theme-option ${theme === "dark" ? "sp-theme-option--active" : ""}`}
      onClick={() => onThemeChange("dark")}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      暗黑
    </button>
    <button
      type="button"
      className={`sp-theme-option ${theme === "light" ? "sp-theme-option--active" : ""}`}
      onClick={() => onThemeChange("light")}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      明亮
    </button>
    <button
      type="button"
      className={`sp-theme-option ${theme === "cream" ? "sp-theme-option--active" : ""}`}
      onClick={() => onThemeChange("cream")}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="14" y1="2" x2="14" y2="4" />
      </svg>
      奶油
    </button>
  </div>
</div>
```

**Step 2: Add theme selector styles to SettingsPanel.css**

```css
/* Theme selector */
.sp-theme-selector {
  display: flex;
  gap: 6px;
  background: var(--bg-primary);
  padding: 3px;
  border-radius: 8px;
}

.sp-theme-option {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font-ui);
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.sp-theme-option:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.sp-theme-option--active {
  background: var(--accent);
  color: #fff;
}

.sp-theme-option--active:hover {
  background: var(--accent-light);
  color: #fff;
}
```

**Step 3: Verify manually**

Open Settings → 通用设置 → click each theme button. Should switch immediately with smooth transition. Should stay in sync with sidebar toggle.

**Step 4: Commit**

```bash
git add frontend/src/components/SettingsPanel.jsx frontend/src/components/SettingsPanel.css
git commit -m "feat: add theme selector to settings panel"
```

---

## Task 6: Run all tests and final verification

**Step 1: Run all backend tests**

Run: `pytest -v`
Expected: ALL PASS (including new theme tests)

**Step 2: Manual verification checklist**

- [ ] Dark theme: matches current appearance exactly
- [ ] Light theme: white/light-gray backgrounds, dark text, purple accent
- [ ] Cream theme: warm gray backgrounds, dark text, purple accent
- [ ] Sidebar toggle cycles correctly: dark → light → cream → dark
- [ ] Sidebar icon changes per theme (moon/sun/cup)
- [ ] Settings panel selector stays in sync with sidebar toggle
- [ ] Theme persists after page refresh (backend saves correctly)
- [ ] Smooth 0.3s color transition on switch
- [ ] Scrollbars look appropriate in each theme
- [ ] All UI components (cards, buttons, inputs, terminal) look correct in each theme

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete theme switcher with dark, light, and cream themes"
```
