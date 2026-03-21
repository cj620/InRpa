# Runtime Environment Diagnostic Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the "依赖安装" card in Settings into a full "运行环境" diagnostic panel showing Python, Node, venv, Playwright, cloud backend, and AI API status.

**Architecture:** Each environment check runs as an independent IPC handler in Electron main.js, exposed via preload.js to the React frontend. Frontend parallelizes all checks on mount and displays live status per item.

**Tech Stack:** Electron IPC, React state, subprocess spawns, HTTP fetch

---

## Task 1: Add IPC handlers for environment checks in main.js

**File:** `electron/main.js`

**Step 1: Add `check-env` IPC handler for all environment checks**

After line 157 (end of `check-playwright` handler), add:

```js
// Environment status check
ipcMain.handle("check-env", async () => {
  const baseDir = path.join(__dirname, "..");
  const venvPython = process.platform === "win32"
    ? path.join(baseDir, ".venv", "Scripts", "python.exe")
    : path.join(baseDir, ".venv", "bin", "python3");

  const results = {};

  // Helper: run command and return stdout trimmed
  function runCmd(args) {
    return new Promise((resolve) => {
      const proc = spawn(args[0], args.slice(1), {
        cwd: baseDir,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d) => { stdout += d.toString(); });
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("close", (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
      proc.on("error", (err) => resolve({ code: -1, stdout: "", stderr: err.message }));
    });
  }

  // 1. Python version
  try {
    const py = await runCmd([venvPython, "--version"]);
    if (py.code === 0) {
      const match = py.stdout.match(/Python (\d+\.\d+\.\d+)/);
      results.python = { ok: true, version: match ? match[1] : py.stdout };
    } else {
      results.python = { ok: false, error: "Python not found" };
    }
  } catch { results.python = { ok: false, error: "Failed" }; }

  // 2. Node version
  try {
    const node = await runCmd(["node", "--version"]);
    if (node.code === 0) {
      results.node = { ok: true, version: node.stdout.replace("v", "") };
    } else {
      results.node = { ok: false, error: "Node not found" };
    }
  } catch { results.node = { ok: false, error: "Failed" }; }

  // 3. .venv exists and python executable works
  try {
    const venvTest = await runCmd([venvPython, "-c", "print('ok')"]);
    results.venv = { ok: venvTest.code === 0 && venvTest.stdout === "ok" };
    if (!results.venv.ok) results.venv.error = "venv python not executable";
  } catch { results.venv = { ok: false, error: "Failed" }; }

  // 4. Playwright
  try {
    const pwScript = `
from playwright.sync_api import sync_playwright
import json
try:
    p = sync_playwright().start()
    info = {"version": p._playwright.version, "chromium": p.chromium.name}
    p.stop()
    print(json.dumps({"ok": True, **info}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
`;
    const pw = await runCmd([venvPython, "-c", pwScript]);
    if (pw.code === 0) {
      try {
        const pwInfo = JSON.parse(pw.stdout);
        results.playwright = pwInfo;
      } catch {
        results.playwright = { ok: false, error: "Parse error" };
      }
    } else {
      results.playwright = { ok: false, error: pw.stderr || "Failed" };
    }
  } catch { results.playwright = { ok: false, error: "Failed" }; }

  // 5. Cloud backend connectivity
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch("http://localhost:8000/health", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    results.cloudBackend = { ok: resp.ok, status: resp.status };
  } catch (e) {
    clearTimeout(timeout);
    results.cloudBackend = { ok: false, error: e.name === "AbortError" ? "Timeout" : e.message };
  }

  return results;
});
```

**Step 2: Run to verify no syntax errors**

Run: `cd /Users/mima0000/Desktop/AI/InRpa && node -c electron/main.js`
Expected: No output (syntax OK)

**Step 3: Commit**

```bash
git add electron/main.js
git commit -m "feat(electron): add check-env IPC handler for environment diagnostics"
```

---

## Task 2: Expose `checkEnv` in preload.js

**File:** `electron/preload.js`

**Step 1: Add `checkEnv` to electronAPI**

After line 11 (`checkPlaywright`), add:

```js
checkEnv: () => ipcRenderer.invoke("check-env"),
```

The full exposed API should be:

```js
contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  installPlaywright: () => ipcRenderer.invoke("install-playwright"),
  checkPlaywright: () => ipcRenderer.invoke("check-playwright"),
  checkEnv: () => ipcRenderer.invoke("check-env"),
  onPlaywrightInstallOutput: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("playwright-install-output", handler);
    return () => ipcRenderer.removeListener("playwright-install-output", handler);
  },
});
```

**Step 2: Commit**

```bash
git add electron/preload.js
git commit -m "feat(preload): expose checkEnv IPC method"
```

---

## Task 3: Rewrite SettingsPanel.jsx — replace "依赖安装" card with "运行环境" card

**File:** `frontend/src/components/SettingsPanel.jsx`

### 3A: Update imports and state

**In state declarations (around line 155), replace:**
```js
const [installState, setInstallState] = useState("idle"); // idle | installing | success | error | installed
const [installLog, setInstallLog] = useState("");
const [playwrightInfo, setPlaywrightInfo] = useState(null); // { version, chromium }
```

**With:**
```js
const [envStatus, setEnvStatus] = useState({
  python:   { status: "idle" },    // idle | checking | ok | error
  node:     { status: "idle" },
  venv:     { status: "idle" },
  playwright: { status: "idle" },
  cloudBackend: { status: "idle" },
  aiApi:    { status: "idle" },
});
```

### 3B: Remove old useEffect for checkPlaywright

**Delete the useEffect at lines 167-176:**
```js
useEffect(() => {
  if (installState !== "idle") return;
  if (!window.electronAPI?.checkPlaywright) return;
  window.electronAPI.checkPlaywright().then((result) => {
    if (result.installed) {
      setInstallState("installed");
      setPlaywrightInfo({ version: result.version, chromium: result.chromium });
    }
  });
}, [installState]);
```

**Replace with new useEffect for checkEnv:**
```js
useEffect(() => {
  if (!window.electronAPI?.checkEnv) return;
  // Set all to checking
  setEnvStatus({
    python: { status: "checking" },
    node: { status: "checking" },
    venv: { status: "checking" },
    playwright: { status: "checking" },
    cloudBackend: { status: "checking" },
    aiApi: { status: "idle" }, // AI API requires manual trigger
  });
  window.electronAPI.checkEnv().then((results) => {
    setEnvStatus({
      python:   { status: results.python.ok ? "ok" : "error",   version: results.python.version,   error: results.python.error },
      node:     { status: results.node.ok ? "ok" : "error",     version: results.node.version,     error: results.node.error },
      venv:     { status: results.venv.ok ? "ok" : "error",     error: results.venv.error },
      playwright: { status: results.playwright?.ok ? "ok" : "error", version: results.playwright?.version, chromium: results.playwright?.chromium, error: results.playwright?.error },
      cloudBackend: { status: results.cloudBackend.ok ? "ok" : "error", statusCode: results.cloudBackend.status, error: results.cloudBackend.error },
      aiApi: { status: "idle" },
    });
  });
}, []);
```

### 3C: Remove install handlers (keep installPlaywright for re-use)

**Delete `handleInstallPlaywright` function (lines 244-273).** The install functionality can be re-added later if needed — for now, focus on read-only diagnostics.

### 3D: Add status icon helper

Add this helper function after the existing icon components (after `ChevronIcon`):

```js
function EnvStatusIcon({ status }) {
  if (status === "checking") {
    return <span className="sp-env-spinner"><SpinnerIcon /></span>;
  }
  if (status === "ok") {
    return <span className="sp-env-check"><CheckIcon /></span>;
  }
  if (status === "error") {
    return <span className="sp-env-x"><XIcon /></span>;
  }
  return <span className="sp-env-idle">○</span>;
}
```

### 3E: Replace the Playwright card with the Environment card

**Replace the entire Card 4 (lines 465-508):**
```jsx
        {/* Card 4: Runtime Environment */}
        <div className="sp-card">
          <div className="sp-card-header">运行环境</div>
          {[
            { key: "python",       label: "Python",       value: envStatus.python.version,   extra: null },
            { key: "node",         label: "Node.js",      value: envStatus.node.version,     extra: null },
            { key: "venv",         label: ".venv",        value: envStatus.venv.ok ? "正常" : null, extra: null },
            { key: "playwright",   label: "Playwright",   value: envStatus.playwright.version, extra: envStatus.playwright.chromium },
            { key: "cloudBackend", label: "云端后端 :8000", value: envStatus.cloudBackend.ok ? `HTTP ${envStatus.cloudBackend.statusCode}` : null, extra: null },
            { key: "aiApi",        label: "AI API",        value: envStatus.aiApi.status === "ok" ? "正常" : null, extra: null },
          ].map(({ key, label, value, extra }) => (
            <div key={key} className="sp-field sp-field--row">
              <label className="sp-label">{label}</label>
              <EnvStatusIcon status={envStatus[key].status} />
              <span className={`sp-env-value ${envStatus[key].status === "error" ? "sp-env-value--error" : ""}`}>
                {envStatus[key].status === "checking" && "检测中..."}
                {envStatus[key].status === "idle" && (value || "—")}
                {envStatus[key].status === "ok" && (value || "正常")}
                {envStatus[key].status === "error" && (envStatus[key].error || "错误")}
                {extra && <span style={{ opacity: 0.6 }}> · {extra}</span>}
              </span>
            </div>
          ))}
        </div>
```

**Step 4: Commit**

```bash
git add frontend/src/components/SettingsPanel.jsx
git commit -m "feat(settings): replace 依赖安装 card with 运行环境 diagnostics"
```

---

## Task 4: Add CSS styling for environment status components

**File:** `frontend/src/components/SettingsPanel.css`

**Add the following styles:**

```css
.sp-env-spinner { display: inline-flex; margin-right: 6px; color: var(--text-secondary); }
.sp-env-check   { display: inline-flex; margin-right: 6px; color: var(--accent); }
.sp-env-x       { display: inline-flex; margin-right: 6px; color: var(--error); }
.sp-env-idle    { display: inline-block; margin-right: 6px; color: var(--text-secondary); }

.sp-env-value { font-size: 13px; }
.sp-env-value--error { color: var(--error); }
```

**Step 2: Commit**

```bash
git add frontend/src/components/SettingsPanel.css
git commit -m "style(settings): add environment status CSS"
```

---

## Task 5: End-to-end test

**Step 1:** Start the app

Run: `npm run dev`

**Step 2:** Open Settings panel

Navigate to the Settings view in the Electron app.

**Step 3:** Verify the "运行环境" card appears

Check that the card shows Python, Node, .venv, Playwright, 云端后端, AI API rows with status indicators.

**Expected:**
- Each row shows a status icon (spinner for checking, check for ok, X for error)
- Python/Node show version numbers
- Playwright shows version + Chromium
- Cloud backend shows HTTP status or error

**Step 4: Verify Playwright is correctly detected as installed**

The Playwright row should show `✓` with version and Chromium info — not show an install button.

**Step 5: Commit final**

```bash
git add -A
git commit -m "feat: complete runtime environment diagnostics in settings"
```
