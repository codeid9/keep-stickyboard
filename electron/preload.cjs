const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("keepAPI", {
  pickKeepFolder: () => ipcRenderer.invoke("pick-keep-folder"),
  importKeep: (folderPath) => ipcRenderer.invoke("import-keep", folderPath),
  loadState: () => ipcRenderer.invoke("load-state"),
  saveState: (state) => ipcRenderer.invoke("save-state", state)
});
