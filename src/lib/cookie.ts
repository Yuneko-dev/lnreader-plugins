// Placeholder for cookie management functions. These functions are not implemented yet,
// but they can be used in the LNReader-Extended application.

type Cookie = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  version?: string;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
};

type Cookies = Record<string, Cookie>;

function set(url: string, cookie: Cookie) {
  return Promise.resolve(true);
}

function get(url: string): Promise<Cookies> {
  return Promise.resolve({});
}

function setFromResponse(url: string, cookie: string) {
  return Promise.resolve(true);
}

function flush() {
  return Promise.resolve();
}

export { set, get, setFromResponse, flush };
