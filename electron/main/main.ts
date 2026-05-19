import { app, BrowserWindow, Menu, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAllHandlers } from './ipc/index.js';

app.commandLine.appendSwitch('disable-features', 'PartitionedCookies');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
export let customSession: Electron.Session;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      session: customSession,
      preload: process.env.VITE_DEV_SERVER_URL
        ? path.resolve(__dirname, '../../preload/preload.cjs')
        : path.join(__dirname, '../preload/preload.cjs'),
    },
  });

  if (!app.isPackaged) {
    mainWindow.webContents.toggleDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function spawnBrowserTab() {
  if (!mainWindow) return;
  if (BrowserWindow.getFocusedWindow() !== mainWindow) return;

  const browserHtml = process.env.VITE_DEV_SERVER_URL
    ? path.resolve(__dirname, '../../browser/index.html')
    : path.join(__dirname, '../browser/index.html');

  const tab = new BrowserWindow({
    parent: mainWindow,
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      session: customSession,
      webviewTag: true,
    },
  });

  tab.loadFile(browserHtml);
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Spawn New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => spawnBrowserTab(),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  customSession = session.fromPartition('persist:lnreader_plugins');

  app.configureHostResolver({
    enableBuiltInResolver: true,
    secureDnsMode: 'secure',
    enableAdditionalDnsQueryTypes: true,
    secureDnsServers: ['https://cloudflare-dns.com/dns-query'],
  });

  registerAllHandlers();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
