import { ipcMain, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const STORAGE_FILE = path.join(app.getPath('userData'), 'plugin-storage.json');
type StorageEntry = { value: any; created: number; expires?: number };
type StorageData = Record<string, Record<string, StorageEntry>>;

let data: StorageData = {};
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load() {
  try {
    data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
  } catch {
    data = {};
  }
}

/** Debounced async write to avoid blocking the main process event loop. */
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.promises.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2)).catch(() => {});
  }, 100);
}

load();

ipcMain.handle('storage:init', (_e, pluginId: string) => data[pluginId] || {});
ipcMain.handle(
  'storage:set',
  (_e, pluginId: string, key: string, value: any, expires?: number) => {
    if (!data[pluginId]) data[pluginId] = {};
    data[pluginId][key] = { value, created: Date.now(), expires };
    scheduleSave();
  },
);
ipcMain.handle('storage:get', (_e, pluginId: string, key: string) => {
  const entry = data[pluginId]?.[key];
  if (!entry) return undefined;
  if (entry.expires && Date.now() > entry.expires) {
    delete data[pluginId][key];
    scheduleSave();
    return undefined;
  }
  return entry.value;
});
ipcMain.handle('storage:delete', (_e, pluginId: string, key: string) => {
  delete data[pluginId]?.[key];
  scheduleSave();
});
ipcMain.handle('storage:get-all-keys', (_e, pluginId: string) =>
  Object.keys(data[pluginId] || {}),
);
ipcMain.handle('storage:clear-all', (_e, pluginId: string) => {
  delete data[pluginId];
  scheduleSave();
});
