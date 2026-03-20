const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");

let mainWindow;
let backendProcess;

const BACKEND_PORT = 8000;
const isDev = !app.isPackaged;

function startBackend() {
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  backendProcess = spawn(pythonCmd, [
    "-m", "uvicorn", "backend.app:app",
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

function waitForPort(port, retries = 30) {
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

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: "#0F1117",
    icon: iconPath,
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
