const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('teampulse', {
  login: (email, password) => ipcRenderer.invoke('login', { email, password }),
  logout: () => ipcRenderer.invoke('logout'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  onClockStatus: (callback) => {
    ipcRenderer.on('clock-status', (_event, data) => callback(data));
  },
});
