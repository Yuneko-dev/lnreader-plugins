import { ipcMain } from 'electron';
import { customSession } from '../main';

const settings = {
  useUserAgent: false,
  userAgent:
    'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
};

export const getSettings = () => settings;

/** Returns the UA that fetch-handler will actually send with requests. */
export function getEffectiveUserAgent(): string {
  return settings.useUserAgent
    ? settings.userAgent
    : customSession.getUserAgent();
}

ipcMain.handle('settings:get', () => ({ ...settings }));
ipcMain.handle('settings:set', (_e, newSettings: any) => {
  Object.assign(settings, newSettings);
  return { ...settings };
});
ipcMain.handle('settings:get-user-agent', () => getEffectiveUserAgent());
