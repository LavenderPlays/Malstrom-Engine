const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('malstrom', {
  engineStatus: () => ipcRenderer.invoke('engine:status'),
  installEngine: () => ipcRenderer.invoke('engine:install'),
  createProject: (name) => ipcRenderer.invoke('project:create', name),
  openProject: () => ipcRenderer.invoke('project:open'),
  loadProject: (directory) => ipcRenderer.invoke('project:load', directory),
  saveProject: (directory, game, script) => ipcRenderer.invoke('project:save', directory, game, script),
  installAsset: (asset) => ipcRenderer.invoke('asset:install', asset),
  openPath: (target) => ipcRenderer.invoke('app:open-path', target)
});