import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { load as loadCheerio, Cheerio, CheerioAPI } from 'cheerio';
import { storage } from '@libs/storage';
import { defaultCover } from '@libs/defaultCover';
import { NodeCrypto, Buffer, encodeHtmlEntities } from '@libs/utils';

// -- POLYFILLS START --
const Response = {
  success: (data: any, next?: any) => ({ data, next }),
  error: (data: any) => {
    throw new Error(data);
  },
};

class VBookDOMWrapper {
  constructor(
    private $: CheerioAPI,
    private context: Cheerio<any>,
  ) {}
  select(selector: string) {
    return new VBookDOMWrapper(this.$, this.context.find(selector));
  }
  first() {
    return new VBookDOMWrapper(this.$, this.context.first());
  }
  last() {
    return new VBookDOMWrapper(this.$, this.context.last());
  }
  get(index: number) {
    return new VBookDOMWrapper(this.$, this.context.eq(index));
  }
  parent() {
    return new VBookDOMWrapper(this.$, this.context.parent());
  }
  children() {
    return new VBookDOMWrapper(this.$, this.context.children());
  }
  nextElementSibling() {
    return new VBookDOMWrapper(this.$, this.context.next());
  }
  previousElementSibling() {
    return new VBookDOMWrapper(this.$, this.context.prev());
  }
  text() {
    return this.context.text();
  }
  html() {
    return this.context.html() || '';
  }
  outerHtml() {
    return this.$.html(this.context);
  }
  attr(name: string) {
    return this.context.attr(name) || '';
  }
  remove() {
    this.context.remove();
    return this;
  }
  size() {
    return this.context.length;
  }
  *[Symbol.iterator]() {
    const $ = this.$;
    const elements = this.context.toArray();
    for (let i = 0; i < elements.length; i++) {
      yield new VBookDOMWrapper($, $(elements[i]));
    }
  }
  forEach(callback: (el: VBookDOMWrapper, i: number) => void) {
    const $ = this.$;
    this.context.each(function (i, _el) {
      callback(new VBookDOMWrapper($, $(this)), i);
    });
  }
  map(callback: (el: VBookDOMWrapper, i: number) => any) {
    const result: any[] = [];
    this.forEach((el, i) => result.push(callback(el, i)));
    return result;
  }
}

async function __vbook_forEach(iterable: any, callback: any) {
  if (!iterable) return;
  let i = 0;
  for (const item of iterable) {
    await callback(item, i++);
  }
}

async function __vbook_map(iterable: any, callback: any) {
  if (!iterable) return [];
  const result = [];
  let i = 0;
  for (const item of iterable) {
    result.push(await callback(item, i++));
  }
  return result;
}

const Html = {
  parse: (htmlString: string) => {
    const $ = loadCheerio(htmlString);
    return new VBookDOMWrapper($, $.root());
  },
};

const localStorage = {
  setItem: (key: string, value: string) => storage.set(key, value),
  getItem: (key: string) => storage.get(key) || null,
  removeItem: (key: string) => storage.delete(key),
};

const cacheStorageMap = new Map<string, string>();
const cacheStorage = {
  setItem: (key: string, value: string) => cacheStorageMap.set(key, value),
  getItem: (key: string) => cacheStorageMap.get(key) || null,
  removeItem: (key: string) => cacheStorageMap.delete(key),
};

let currentCookie = '';
const localCookie = {
  setCookie: (value: string) => {
    currentCookie = value;
  },
  getCookie: () => currentCookie,
};

async function vbookFetch(url: string, options: any = {}) {
  let finalUrl = url;
  if (options.queries) {
    const params = new URLSearchParams(
      options.queries as Record<string, string>,
    );
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + params.toString();
  }

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    const contentType =
      options.headers?.['Content-Type'] || options.headers?.['content-type'];
    if (contentType && contentType.includes('application/json')) {
      body = JSON.stringify(body);
    } else {
      body = new URLSearchParams(body as Record<string, string>).toString();
    }
  }

  const init: any = {
    method: options.method || 'GET',
    headers: options.headers,
    body: body,
  };

  let timeout;

  if (options.timeout) {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), options.timeout);
    init.signal = controller.signal;
    // init.signal = AbortSignal.timeout(options.timeout);
  }

  const res = await fetchApi(finalUrl, init);

  if (timeout) clearTimeout(timeout);

  let _text: string | null = null;
  const getText = async () => {
    if (_text === null) _text = await res.text();
    return _text;
  };

  return {
    ok: res.ok,
    status: res.status,
    text: async () => await getText(),
    html: async () => Html.parse(await getText()),
    json: async () => JSON.parse(await getText()),
    base64: async () => {
      const b = await res.clone().arrayBuffer();
      return Buffer.from(b).toString('base64');
    },
  };
}

class HttpBuilder {
  constructor(
    private url: string,
    private options: any,
  ) {}
  headers(h: any) {
    this.options.headers = h;
    return this;
  }
  queries(q: any) {
    this.options.queries = q;
    return this;
  }
  async string(charset?: string) {
    const res = await vbookFetch(this.url, this.options);
    return await res.text();
  }
  async html() {
    const res = await vbookFetch(this.url, this.options);
    return await res.html();
  }
  async json() {
    const res = await vbookFetch(this.url, this.options);
    return await res.json();
  }
}

const Http = {
  get: (url: string) => new HttpBuilder(url, { method: 'GET' }),
  post: (url: string) => new HttpBuilder(url, { method: 'POST' }),
};

const Engine = {
  newBrowser: () => {
    throw new Error(
      'Engine.newBrowser (Headless Browser) is not implemented in LNReader native Polyfill.',
    );
  },
};

const UserAgent = {
  chrome: () =>
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  ios: () =>
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
  android: () =>
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
};

const Qt = {
  translate: (text: string, to: string, extras?: any) => {
    return {
      translateText: text,
      segments: [],
    };
  },
};

const Script = {
  execute: (scriptName: string, functionName: string, input: any) => {
    throw new Error(
      'Script.execute is complex to polyfill dynamically. Requires manual refactoring.',
    );
  },
};

const CryptoJS = {
  MD5: (data: string) => ({
    toString: () => NodeCrypto.createHash('md5').update(data).digest('hex'),
  }),
  SHA256: (data: string) => ({
    toString: () => NodeCrypto.createHash('sha256').update(data).digest('hex'),
  }),
  AES: {
    encrypt: (data: any, key: any, options: any = {}) => {
      const mode = options.mode === 'ECB' ? 'ecb' : 'cbc';
      const kBuf = Buffer.isBuffer(key)
        ? key
        : Buffer.from(key?.toString() || '');
      const algo = `aes-${kBuf.length * 8}-${mode}`;
      const ivBuf = options.iv
        ? Buffer.isBuffer(options.iv)
          ? options.iv
          : Buffer.from(options.iv.toString())
        : mode === 'cbc'
          ? Buffer.alloc(16, 0)
          : null;
      const cipher = NodeCrypto.createCipheriv(algo, kBuf, ivBuf);
      cipher.setAutoPadding(options.padding !== 'NoPadding');
      const d = typeof data === 'string' ? data : data.toString();
      let encrypted = cipher.update(d, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      return { toString: () => encrypted };
    },
    decrypt: (ciphertext: any, key: any, options: any = {}) => {
      const mode = options.mode === 'ECB' ? 'ecb' : 'cbc';
      const kBuf = Buffer.isBuffer(key)
        ? key
        : Buffer.from(key?.toString() || '');
      const algo = `aes-${kBuf.length * 8}-${mode}`;
      const ivBuf = options.iv
        ? Buffer.isBuffer(options.iv)
          ? options.iv
          : Buffer.from(options.iv.toString())
        : mode === 'cbc'
          ? Buffer.alloc(16, 0)
          : null;
      const decipher = NodeCrypto.createDecipheriv(algo, kBuf, ivBuf);
      decipher.setAutoPadding(options.padding !== 'NoPadding');
      const c =
        typeof ciphertext === 'string' ? ciphertext : ciphertext.toString();
      let decrypted = decipher.update(c, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return { toString: () => decrypted };
    },
  },
  enc: {
    Hex: {
      parse: (s: string) => Buffer.from(s, 'hex'),
      stringify: (b: any) => Buffer.from(b).toString('hex'),
    },
    Utf8: {
      parse: (s: string) => Buffer.from(s, 'utf8'),
      stringify: (b: any) => Buffer.from(b).toString('utf8'),
    },
    Base64: {
      parse: (s: string) => Buffer.from(s, 'base64'),
      stringify: (b: any) => Buffer.from(b).toString('base64'),
    },
  },
  mode: { CBC: 'CBC', ECB: 'ECB' },
  pad: { Pkcs7: 'Pkcs7', NoPadding: 'NoPadding' },
};

const Log = { log: console.log };
const Console = { log: console.log };
function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
// -- POLYFILLS END --

class __PLUGIN_CLASS_NAME__ implements Plugin.PluginBase {
  id = '__PLUGIN_ID__';
  name = '__PLUGIN_NAME__';
  icon = '__PLUGIN_ICON__';
  site = '__PLUGIN_SITE__';
  version = '1.0.0';
  /* __VBOOK_CUSTOM_JS__ */

  // @ts-expect-error
  filters = __FILTERS_OBJECT__ satisfies Filters;
  // @ts-expect-error
  private tabs = __TABS_ARRAY__;
  // @ts-expect-error
  private genres = __GENRES_ARRAY__;

  private lastPageHasNext = new Map<string, boolean>();

  async popularNovels(
    pageNo: number,
    { filters }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    let targetUrl = '';

    if (filters?.genre?.value) {
      targetUrl = filters.genre.value;
    } else {
      const tabIndex = parseInt(filters?.tab?.value || '0', 10);
      targetUrl = this.tabs[tabIndex]?.input || '';
    }

    if (!targetUrl && this.tabs.length > 0) return [];

    const cacheKey = targetUrl + '-' + JSON.stringify(filters || {});
    if (pageNo > 1 && this.lastPageHasNext.get(cacheKey) === false) {
      return [];
    }

    const url = targetUrl;
    const page = String(pageNo);
    let genResult: any;
    /* __VBOOK_GEN__ */

    let resultObj = genResult;
    if (typeof genResult === 'string') {
      try {
        resultObj = JSON.parse(genResult);
      } catch (e) {}
    }

    const hasNext =
      resultObj && typeof resultObj === 'object' && resultObj.next;
    this.lastPageHasNext.set(cacheKey, !!hasNext);

    let items = resultObj?.data || resultObj || [];
    if (!Array.isArray(items)) items = [];

    return items.map((item: any) => ({
      name: item.name || item.title || 'Unknown',
      path: item.link || item.id || '',
      cover: item.cover || defaultCover,
    }));
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const url = novelPath.startsWith('http')
      ? novelPath
      : this.site + (novelPath.startsWith('/') ? '' : '/') + novelPath;
    let detailResult: any;
    /* __VBOOK_DETAIL__ */
    let tocResult: any;
    /* __VBOOK_TOC__ */

    let dRes = detailResult;
    if (typeof detailResult === 'string') {
      try { dRes = JSON.parse(detailResult); } catch (e) {}
    }
    dRes = dRes?.data || dRes || {};

    let tRes = tocResult;
    if (typeof tocResult === 'string') {
      try { tRes = JSON.parse(tocResult); } catch (e) {}
    }
    tRes = tRes?.data || tRes || [];
    if (!Array.isArray(tRes)) tRes = [];

    return {
      path: novelPath,
      name: dRes?.name || dRes?.title || 'Unknown',
      cover: dRes?.cover || defaultCover,
      summary: dRes?.description,
      author: dRes?.author,
      status: dRes?.ongoing === false ? 'Completed' : 'Ongoing',
      chapters: (() => {
        let currentSection = '';
        const chaps: any[] = [];
        tRes.forEach((c: any) => {
          if (c.type === 'section' || c.isVolume) {
            currentSection = c.name;
          } else {
            let chPath = c.url || c.link || '';
            if (chPath.startsWith(this.site))
              chPath = chPath.replace(this.site, '');
            const chName = currentSection
              ? `[${currentSection}] ${c.name}`
              : c.name;
            chaps.push({
              name: chName,
              path: chPath,
              chapterNumber: chaps.length + 1,
            });
          }
        });
        return chaps;
      })(),
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = chapterPath.startsWith('http')
      ? chapterPath
      : this.site + (chapterPath.startsWith('/') ? '' : '/') + chapterPath;
    /* __VBOOK_CHAP__ */
    return '';
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const keyword = searchTerm;
    const key = searchTerm;
    const page = String(pageNo);
    const input = [keyword, page];

    const cacheKey = 'search-' + keyword;
    if (pageNo > 1 && this.lastPageHasNext.get(cacheKey) === false) {
      return [];
    }

    let searchResult: any;
    /* __VBOOK_SEARCH__ */

    let resultObj = searchResult;
    if (typeof searchResult === 'string') {
      try {
        resultObj = JSON.parse(searchResult);
      } catch (e) {}
    }

    const hasNext =
      resultObj && typeof resultObj === 'object' && resultObj.next;
    this.lastPageHasNext.set(cacheKey, !!hasNext);

    let items = resultObj?.data || resultObj || [];
    if (!Array.isArray(items)) items = [];

    return items.map((item: any) => ({
      name: item.name || item.title || 'Unknown',
      path: item.link || item.id || '',
      cover: item.cover || defaultCover,
    }));
  }

  buildPlayerHtml(tracks: any[]): string {
    const attrs: string[] = ['id="vbook-player-container"'];
    attrs.push(`data-servers="${encodeHtmlEntities(JSON.stringify(tracks))}"`);

    return [
      `<div ${attrs.join(' ')} style="position:relative;width:100%;padding-bottom:56.25%;background:#000;">`,
      '  <div id="vbook-player-inner" style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">',
      '    <p style="color:#fff;font-family:sans-serif;">Đang tải video...</p>',
      '  </div>',
      '</div>',
      '<div id="vbook-server-selector" style="margin-top:10px;text-align:center;"></div>',
      '<meta id="no-cache-marker"/><meta id="no-prefetch-marker"/>',
    ].join('\n');
  }
}

export default new __PLUGIN_CLASS_NAME__();
