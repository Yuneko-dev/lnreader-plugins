type Cookie = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
};
type Cookies = Record<string, Cookie>;

export function set(url: string, cookie: Cookie) {
  return window.electronAPI!.invoke('cookie:set', url, cookie);
}
export function get(url: string): Promise<Cookies> {
  return window.electronAPI!.invoke('cookie:get', url);
}
export function setFromResponse(url: string, cookie: string) {
  return window.electronAPI!.invoke('cookie:set-from-response', url, cookie);
}
export function flush() {
  return window.electronAPI!.invoke('cookie:flush');
}
export function removeSessionCookies() {
  return window.electronAPI!.invoke('cookie:remove-session');
}
