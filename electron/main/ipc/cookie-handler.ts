import { ipcMain } from 'electron';
import { customSession } from '../main';

ipcMain.handle('cookie:set', async (_e, url: string, cookie: any) => {
  await customSession.cookies.set({
    url,
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    expirationDate: cookie.expires
      ? new Date(cookie.expires).getTime() / 1000
      : undefined,
  });
  return true;
});

ipcMain.handle('cookie:get', async (_e, url: string) => {
  const cookies = await customSession.cookies.get({ url });
  const result: Record<string, any> = {};
  for (const c of cookies) {
    result[c.name] = {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
    };
  }
  return result;
});

ipcMain.handle(
  'cookie:set-from-response',
  async (_e, url: string, header: string) => {
    const parts = header.split(';').map(p => p.trim());
    const [nameVal] = parts;
    const eqIdx = nameVal.indexOf('=');
    if (eqIdx > 0) {
      await customSession.cookies.set({
        url,
        name: nameVal.substring(0, eqIdx),
        value: nameVal.substring(eqIdx + 1),
      });
    }
    return true;
  },
);

ipcMain.handle('cookie:flush', async () => {
  await customSession.cookies.flushStore();
});

ipcMain.handle('cookie:remove-session', async () => {
  await customSession.clearStorageData({ storages: ['cookies'] });
  return true;
});
