// ptzIP desktop shell: loads the ptzIP web app and runs the read-only discovery
// companion natively (UDP/multicast ONVIF, HTTP identification, TCP checks) with automatic pairing.
const { app, BrowserWindow, utilityProcess, shell, ipcMain } = require('electron');
const { checkRelease } = require('./updates.cjs');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const APP_URL = process.env.PTZIP_URL || 'https://ptzip.lovable.app';
const origin = new URL(APP_URL).origin;
const token = crypto.randomBytes(24).toString('hex');
process.env.PTZIP_TOKEN = token;
let helper;
let updateRequest;
let lastUpdate;
ipcMain.handle('ptzip:check-updates', async event => {
  if (new URL(event.senderFrame.url).origin !== origin || event.senderFrame !== event.sender.mainFrame) throw Error('Not allowed.');
  if (lastUpdate && Date.now() - lastUpdate.time < 60000) return lastUpdate.result;
  updateRequest ??= checkRelease(app.getVersion(), process.platform).then(result => {
    lastUpdate = { time: Date.now(), result }; return result;
  }).finally(() => { updateRequest = null; });
  return updateRequest;
});
// macOS: bundled sender that pins camera-search broadcasts to each adapter (see electron/native).
const bcast = path.join(process.resourcesPath || '', 'ptzip-bcast');
function startHelper() {
  helper = utilityProcess.fork(path.join(__dirname, '..', 'public', 'downloads', 'ptzip-helper.cjs'), [origin], {
    env: { ...process.env, PTZIP_TOKEN: token, ...(fs.existsSync(bcast) ? { PTZIP_BCAST: bcast } : {}) }, stdio: 'inherit',
  });
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600, title: 'ptzIP', backgroundColor: '#101317',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, additionalArguments: [`--ptzip-token=${token}`, `--ptzip-version=${app.getVersion()}`] },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.loadURL(APP_URL);
}
app.whenReady().then(() => { startHelper(); createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('quit', () => { try { helper?.kill(); } catch {} });
