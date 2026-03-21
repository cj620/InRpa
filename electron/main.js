const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");

let mainWindow;
let backendProcess;

const BACKEND_PORT = 8001;
const isDev = !app.isPackaged;

function startBackend() {
  const baseDir = path.join(__dirname, "..");
  const venvPython = process.platform === "win32"
    ? path.join(baseDir, ".venv", "Scripts", "python.exe")
    : path.join(baseDir, ".venv", "bin", "python3");
  backendProcess = spawn(venvPython, [
    "-m", "uvicorn", "backend.local_app:app",
    "--host", "127.0.0.1",
    "--port", String(BACKEND_PORT),
  ], {
    cwd: path.join(__dirname, ".."),
    stdio: ["pipe", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.on("error", (err) => {
    console.error("Failed to start backend:", err);
  });
}

function waitForPort(port, retries = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function tryConnect() {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.on("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.on("timeout", () => {
        socket.destroy();
        retry();
      });
      socket.on("error", () => {
        retry();
      });
      socket.connect(port, "127.0.0.1");
    }
    function retry() {
      attempts++;
      if (attempts >= retries) {
        reject(new Error(`Port ${port} not ready after ${retries} attempts`));
      } else {
        setTimeout(tryConnect, 500);
      }
    }
    tryConnect();
  });
}

async function createWindow() {
  const iconPath = path.join(__dirname, "../assets/logo.png");

  // Set dock icon (macOS)
  if (process.platform === "darwin") {
    app.dock.setIcon(iconPath);
  }

  // macOS uses native window frame with traffic lights, Windows uses custom frameless
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: isMac, // macOS: native frame with traffic lights; Windows: frameless
    backgroundColor: "#0F1117",
    icon: iconPath,
    titleBarStyle: isMac ? "hidden" : undefined, // macOS: hide title bar text, show traffic lights
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
  }

  // Window control IPC handlers
  ipcMain.on("window-minimize", () => mainWindow.minimize());
  ipcMain.on("window-maximize", () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on("window-close", () => mainWindow.close());

  // Check Playwright installation status
  ipcMain.handle("check-playwright", async () => {
    return new Promise((resolve) => {
      const baseDir = path.join(__dirname, "..");
      const venvPython = process.platform === "win32"
        ? path.join(baseDir, ".venv", "Scripts", "python.exe")
        : path.join(baseDir, ".venv", "bin", "python3");

      const script = `
import json
from playwright.sync_api import sync_playwright
p = sync_playwright().start()
chromium = p.chromium
info = {
    "version": p._playwright.version,
    "chromium": chromium.name
}
p.stop()
print(json.dumps(info))
`;
      const proc = spawn(venvPython, ["-c", script], {
        cwd: baseDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (data) => { stdout += data.toString(); });
      proc.stderr.on("data", (data) => { stderr += data.toString(); });
      proc.on("close", (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout.trim());
            resolve({ installed: true, version: info.version, chromium: info.chromium });
          } catch {
            resolve({ installed: false });
          }
        } else {
          resolve({ installed: false });
        }
      });
      proc.on("error", () => resolve({ installed: false }));
    });
  });

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

  // Install Playwright IPC handler
  ipcMain.handle("install-playwright", async () => {
    return new Promise((resolve) => {
      const baseDir = path.join(__dirname, "..");
      const venvPython = process.platform === "win32"
        ? path.join(baseDir, ".venv", "Scripts", "python.exe")
        : path.join(baseDir, ".venv", "bin", "python3");

      function sendOutput(data) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("playwright-install-output", data.toString());
        }
      }

      function runCommand(args, callback) {
        const proc = spawn(venvPython, args, {
          cwd: baseDir,
          stdio: ["pipe", "pipe", "pipe"],
        });
        proc.stdout.on("data", (data) => sendOutput(data.toString()));
        proc.stderr.on("data", (data) => sendOutput(data.toString()));
        proc.on("error", (err) => sendOutput(`Error: ${err.message}\n`));
        proc.on("close", (code) => callback(code));
      }

      // Step 0: ensurepip in venv (so -m pip works)
      sendOutput("> python3 -m ensurepip\n");
      runCommand(["-m", "ensurepip", "--upgrade"], (code0) => {
        if (code0 !== 0) {
          sendOutput("ensurepip failed (non-critical, continuing...)\n");
        }

        // Step 1: pip install playwright
        sendOutput("> pip install playwright\n");
        runCommand(["-m", "pip", "install", "playwright"], (code) => {
          if (code !== 0) {
            sendOutput(`pip install failed with code ${code}\n`);
            resolve({ success: false, error: "pip install failed" });
            return;
          }
          sendOutput("> playwright install chromium\n");
          // Step 2: playwright install chromium
          runCommand(["-m", "playwright", "install", "chromium"], (code2) => {
            if (code2 !== 0) {
              sendOutput(`playwright install failed with code ${code2}\n`);
              resolve({ success: false, error: "playwright install failed" });
              return;
            }
            sendOutput("Done.\n");
            resolve({ success: true });
          });
        });
      });
    });
  });
}

app.whenReady().then(async () => {
  if (!isDev) {
    startBackend();
  }
  try {
    await waitForPort(BACKEND_PORT);
    console.log("Backend is ready.");
  } catch (err) {
    console.error("Backend failed to start:", err);
  }
  await createWindow();
});

app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  app.quit();
});
