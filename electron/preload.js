const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),

  installPlaywright: () => ipcRenderer.invoke("install-playwright"),

  onPlaywrightInstallOutput: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("playwright-install-output", handler);
    return () => ipcRenderer.removeListener("playwright-install-output", handler);
  },
});
