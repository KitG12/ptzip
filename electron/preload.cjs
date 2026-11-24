const { contextBridge, ipcRenderer } = require('electron');
const arg = n => (process.argv.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1] || '';
contextBridge.exposeInMainWorld('ptzipDesktop', { token: arg('ptzip-token'), version: arg('ptzip-version'), checkUpdates: () => ipcRenderer.invoke('ptzip:check-updates') });
