const { contextBridge, ipcRenderer } = require("electron");
window.preloadOK = true;
console.log("[preload] running, electron version:", process.versions.electron);

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
