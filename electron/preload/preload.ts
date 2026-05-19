import { contextBridge, ipcRenderer } from 'electron';

const ALLOWED_CHANNELS = [
  'fetch:request',
  'cookie:set',
  'cookie:get',
  'cookie:set-from-response',
  'cookie:flush',
  'cookie:remove-session',
  'storage:init',
  'storage:set',
  'storage:get',
  'storage:delete',
  'storage:get-all-keys',
  'storage:clear-all',
  'settings:get',
  'settings:set',
  'settings:get-user-agent',
] as const;

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => {
    if ((ALLOWED_CHANNELS as readonly string[]).includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Channel "${channel}" not allowed`));
  },
});
