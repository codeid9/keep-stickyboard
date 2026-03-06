const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("keepAPI", {
  pickKeepFolder: () => ipcRenderer.invoke("keep:pickFolder"),
  importKeep: (folder) => ipcRenderer.invoke("keep:import", folder),
  loadState: () => ipcRenderer.invoke("state:load"),
  saveState: (data) => ipcRenderer.invoke("state:save", data),
});