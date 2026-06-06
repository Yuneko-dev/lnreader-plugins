import * as vm from 'vm';

export function evaluateStaticArray(
  configCode: string,
  scriptCode: string,
): any[] {
  if (!scriptCode) return [];
  try {
    const sandbox: any = {
      Response: { success: (data: any) => data, error: () => [] },
      BASE_URL: '',
      localCookie: { getCookie: () => '' },
      Log: { log: () => {} },
      Console: { log: () => {} },
      fetch: () => ({
        ok: false,
        status: 404,
        text: () => '',
        html: () => null,
        json: () => ({}),
      }),
      setTimeout: () => {},
      clearTimeout: () => {},
    };
    vm.createContext(sandbox);
    const code = `
            ${configCode}
            ${scriptCode.replace(/load\(.*?\);?/g, '')}
            execute();
        `;
    const result = vm.runInContext(code, sandbox);
    if (Array.isArray(result)) return result;
    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        if (parsed && Array.isArray(parsed.data)) return parsed.data;
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    if (result && Array.isArray(result.data)) return result.data;
    return [];
  } catch (e) {
    console.warn('Failed to statically evaluate script:', e);
    return [];
  }
}
