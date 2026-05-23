/* eslint-disable no-useless-escape */

import { load as parseHTML } from 'cheerio';
import { fetchApi, fetchText } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { NovelStatus } from '@libs/novelStatus';
import { defaultCover } from '@libs/defaultCover';
import { storage } from '@libs/storage';
import { get, set, setFromResponse, removeSessionCookies } from '@libs/cookie';
import { decodeHtmlEntities } from '@libs/utils';
import { ABT_HOSTS, looksLikeExternalUrl, detectHostFromUrl } from './external-url';
import { filters } from './filters';
import { normalizeChapterHtml, wrapWithParagraphs } from './content-normalization';

const SITE = 'https://sangtacviet.app';

const GH_UPDATE =
  'https://raw.githubusercontent.com/sangtacviet/sangtacviet.github.io/main/update.json';

const DOMAIN_URLS = [
  'https://sangtacviet.app',
  'https://sangtacviet.pro',
  'https://dns1.stv-appdomain-00000001.org',
];
const DOMAINS = Object.fromEntries(DOMAIN_URLS.map(u => [new URL(u).host, u]));

class STVChapterError extends Error {
  public errorCode: number;
  public raw: any;
  constructor(code: number, detail: any) {
    super(
      `${STVChapterError.getMessage(code)} (code ${code})\n` +
        STVChapterError.stringifyJson(detail),
    );
    this.name = 'STVChapterError';
    this.errorCode = code;
    this.raw = detail;
    Object.setPrototypeOf(this, STVChapterError.prototype);
  }
  get shouldStopRetry(): boolean {
    switch (this.errorCode) {
      case 0:
      case 1:
      case 12:
      case 13:
      case 15:
      case 18:
      case 19:
      case 21:
      case 101:
        return true;
      default:
        return false;
    }
  }
  static stringifyJson(data: any) {
    try {
      return JSON.stringify(data);
    } catch {
      return `${data}`;
    }
  }
  static getMessage(code: number | string) {
    code = code.toString();
    switch (code) {
      case '1':
        return 'Chương không có nội dung.';
      case '5':
        return 'Lỗi không xác định.';
      case '7':
        return 'Bạn đang tải chương quá nhanh. Hãy thử lại sau vài giây.';
      case '12':
        return 'Bạn chưa mua chương ở sfacg. Đăng nhập để tiếp tục.';
      case '13':
        return 'Bạn chưa đăng nhập.';
      case '15':
        return 'Đang đặt location chuyển hướng.';
      case '18':
        return 'Yêu cầu chuyển hướng.';
      case '19':
        return 'Có lỗi không xác định. Yêu cầu chuyển hướng';
      case '21':
        return 'Bạn cần xác nhận captcha. Hãy thử lại sau vài giây.';
      case '101':
        return 'Truyện này không phải novel (type=manga)';
      default:
        return 'Unexpected response.';
    }
  }
}

class SangTacVietPlugin implements Plugin.PluginBase {
  id = 'sangtacviet';
  name = 'Sáng Tác Việt';
  icon = 'src/vi/sangtacviet/icon.png';
  customJS = 'src/vi/sangtacviet/custom.js';
  private _captchaVerifiedPath: string | null = null;

  get site() {
    return DOMAINS[this.selectedDomain] || SITE;
  }
  version = '1.0.21';
  webStorageUtilized = true;

  pluginSettings: Plugin.PluginSettings = {
    selectedDomain: {
      type: 'Select',
      label: 'Tên miền',
      value: 'sangtacviet.app',
      options: Object.keys(DOMAINS).map(h => ({ label: h, value: h })),
    },
    translateEnabled: {
      type: 'Switch',
      label: 'Dịch truyện (Mở/Tắt)',
      value: true,
    },
    translateEngine: {
      type: 'Select',
      label: 'Công cụ dịch (Tiếng Việt)',
      value: 'convert',
      options: [
        { label: 'Convert', value: 'convert' },
        { label: 'Bing', value: 'bing' },
        { label: 'Google', value: 'google' },
      ],
    },
    autoRetry: {
      type: 'Switch',
      label:
        'Tự động thử lại khi tải chương thất bại (Tối đa 10 lần, cách nhau 1 giây)',
      value: false,
    },
  };

  constructor() {
    const ps = this.pluginSettings;
    for (const key in ps) {
      if (storage.get(key) === undefined) {
        storage.set(key, ps[key].value);
      }
    }
  }

  get selectedDomain(): string {
    return (storage.get('selectedDomain') as string) || 'sangtacviet.app';
  }

  get translateEnabled(): boolean {
    return Boolean(storage.get('translateEnabled'));
  }

  get translateEngine(): string {
    return (storage.get('translateEngine') as string) || 'convert';
  }

  get autoRetry() {
    return storage.get('autoRetry') as boolean;
  }

  async applyTranslationCookies(origin: string): Promise<void> {
    let transmode: string;
    let foreignlang: string;

    if (!this.translateEnabled) {
      transmode = 'chinese';
      foreignlang = 'vi';
    } else {
      switch (this.translateEngine) {
        case 'bing':
          transmode = 'tfms';
          foreignlang = 'vi';
          break;
        case 'google':
          transmode = 'name';
          foreignlang = 'gg_vi';
          break;
        case 'convert':
        default:
          transmode = 'name';
          foreignlang = 'vi';
          break;
      }
    }

    await set(origin, { name: 'transmode', value: transmode });
    await set(origin, { name: 'foreignlang', value: foreignlang });
  }

  private async _cookieHeader(origin: string): Promise<Record<string, string>> {
    const jar = await get(origin);
    const parts: string[] = [];
    for (const k in jar) {
      const c = jar[k];
      const v = typeof c === 'string' ? c : c && c.value;
      if (v) parts.push(k + '=' + v);
    }
    return parts.length ? { Cookie: parts.join('; ') } : {};
  }

  parseNovelsFromHTML(html: string): Plugin.NovelItem[] {
    const novels: Plugin.NovelItem[] = [];
    const $ = parseHTML(html);
    $('a.booksearch').each((_, el) => {
      const href = $(el).attr('href') || '';
      const name = $(el).find('.searchbooktitle').text().trim();
      const cover = $(el).find('img').attr('src') || defaultCover;
      if (href && name) {
        novels.push({ name, cover, path: href });
      }
    });
    return novels;
  }

  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const { filters } = options;
    let sort = options.showLatestNovels ? 'update' : 'view';
    let minc = '0';
    let category = '';
    let type = '';
    let step = '';
    let host = '';
    let tag = '';

    if (filters) {
      if (filters.sort?.value) sort = filters.sort.value;
      minc = filters.minc?.value || '0';
      category = filters.category?.value || '';
      type = filters.type?.value || '';
      step = filters.step?.value || '';
      host = filters.host?.value || '';
      tag = filters.tag?.value?.join(',') || '';
    }

    const url = new URL(`${this.site}/io/searchtp/searchBooks`);
    url.searchParams.set('find', '');
    url.searchParams.set('minc', minc);
    url.searchParams.set('sort', sort);
    url.searchParams.set('tag', tag);
    if (category) url.searchParams.set('category', category);
    if (type) url.searchParams.set('type', type);
    if (step) url.searchParams.set('step', step);
    if (host) url.searchParams.set('host', host);
    url.searchParams.set('p', String(pageNo));

    const html = await fetchText(url.toString());
    return this.parseNovelsFromHTML(html);
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    // Extract host and bookid from path: /truyen/{host}/{sty}/{bookid}/
    const pathParts = novelPath.replace(/^\/|\/$/g, '').split('/');
    const bookHost = pathParts[1] || '';
    const bookId = pathParts[3] || '';

    const headers = {
      'x-stv-transport': 'app',
      'x-requested-with': 'com.sangtacviet.mobilereader',
      Referer: `${this.site}/truyen/${bookHost}/${pathParts[2]}/${bookId}/`,
    };

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: 'Không có tiêu đề',
    };

    // Step 1: Fetch novel info via JSON API
    if (bookHost && bookId) {
      const infoUrl = new URL(`${this.site}/mobile/bookinfo.php`);
      infoUrl.searchParams.set('host', bookHost);
      infoUrl.searchParams.set('hid', bookId);
      const infoRes = await fetchApi(infoUrl.toString(), { headers });
      const infoJson = await infoRes.json();

      if (infoJson.code === 100 && infoJson.book) {
        const book = infoJson.book;
        novel.name = (book.tname || book.name || 'Không có tiêu đề').trim();
        novel.author = (book.hauthor || book.author || '').trim();
        novel.summary = (book.info || '')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/\t/g, '\n')
          .trim();
        novel.genres = (book.category || '').trim();
        novel.cover = book.thumb
          ? book.thumb.startsWith('http')
            ? book.thumb
            : `${this.site}${book.thumb}`
          : defaultCover;

        const st = String(book.status || '')
          .trim()
          .toLowerCase();
        if (st === '0' || st === 'hoàn thành')
          novel.status = NovelStatus.Completed;
        else if (st === '1' || st === 'còn tiếp')
          novel.status = NovelStatus.Ongoing;
        else if (st === '2' || st === 'tạm ngưng')
          novel.status = NovelStatus.OnHiatus;
        else novel.status = NovelStatus.Unknown;
      } else {
        // Fallback to HTML scraping if JSON API fails
        const res = await fetchApi(this.site + novelPath, { headers });
        const html = await res.text();
        const $ = parseHTML(html);
        novel.name =
          $('meta[property="og:novel:book_name"]').attr('content') ||
          $('#book_name2').text().trim() ||
          'Không có tiêu đề';
        novel.cover =
          $('meta[property="og:image"]').attr('content') || defaultCover;
        novel.author =
          $('meta[property="og:novel:author"]').attr('content') ||
          $('h2').first().text().trim();
        novel.summary = (
          $('meta[property="og:description"]').attr('content') ||
          $('.textzoom').text().trim()
        ).replace(/\\n/g, '\n');
        novel.genres = (
          $('meta[property="og:novel:category"]').attr('content') || ''
        ).trim();
        const statusText = (
          $('meta[property="og:novel:status"]').attr('content') || ''
        ).trim();
        if (statusText === 'Hoàn thành') novel.status = NovelStatus.Completed;
        else if (statusText === 'Còn tiếp') novel.status = NovelStatus.Ongoing;
        else if (statusText === 'Tạm ngưng')
          novel.status = NovelStatus.OnHiatus;
        else novel.status = NovelStatus.Unknown;
      }
    }

    // Step 2: Fetch chapter list
    if (bookHost && bookId) {
      const chapUrl = new URL(`${this.site}/index.php`);
      chapUrl.searchParams.set('ngmar', 'chapterlist');
      chapUrl.searchParams.set('h', bookHost);
      chapUrl.searchParams.set('bookid', bookId);
      chapUrl.searchParams.set('sajax', 'getchapterlist');
      const chapRes = await fetchApi(chapUrl.toString(), { headers });
      const chapJson = (await chapRes.json()) as {
        code: number;
        enckey?: string; // Unknown purpose
        data: string;
        oridata?: string;
        unlocked?: null | Record<string, any>;
        unvip?: number;
        val?: number;
      };
      if (chapJson.code === 1 && chapJson.data) {
        const chapters: Plugin.ChapterItem[] = [];
        const seen: Record<string, boolean> = {};
        const rows = chapJson.data.split('-//-');
        // idk
        if (bookHost === 'uukanshu') {
          chapters.reverse();
        }
        let chapterNum = 0;
        rows.forEach(row => {
          const trimmed = row.trim();
          if (!trimmed) return;
          const cols = trimmed.split('-/-');
          if (cols.length < 3) return;
          const chapId = cols[1].trim();
          const chapName = cols[2].trim();
          if (!chapId || !chapName) return;
          const dedup = chapId + '|' + chapName;
          if (seen[dedup]) return;
          seen[dedup] = true;
          chapterNum++;
          const check_vip = cols[3];
          const isVip =
            check_vip &&
            check_vip !== 'unvip' &&
            check_vip !== 'unvip\n' &&
            !(chapJson.unlocked && chapJson.unlocked[chapId as string]);
          chapters.push({
            name: isVip ? `[VIP] ${chapName}` : chapName,
            path: `/truyen/${bookHost}/${cols[0]}/${bookId}/${chapId}/`,
            chapterNumber: chapterNum,
          });
        });
        novel.chapters = chapters;
      } else if (chapJson.code === 2) {
        throw new Error('Truyện đã bị xóa hoặc không có nội dung');
      } else {
        throw new Error(`Lỗi không xác định: ${JSON.stringify(chapJson)}`);
      }
    }

    novel.genres = `${bookHost},${novel.genres
      ?.split(',')
      .map(g => g.trim())
      .filter(g => g)
      .join(',')}`;

    novel.summary = decodeHtmlEntities(novel.summary || '');

    return novel;
  }

  extractCookiesFromHtml(html: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    // Inline JS the page ships looks like: document.cookie = "_ac=...; path=/";
    const re = /document\.cookie\s*=\s*["']([^"';]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const idx = m[1].indexOf('=');
      if (idx <= 0) continue;
      const key = m[1].substring(0, idx).trim();
      const value = m[1].substring(idx + 1).trim();
      if (key && value) cookies[key] = value;
    }
    return cookies;
  }

  parseLooseJson(text: string): {
    code?: string | number;
    data?: string;
    chaptername?: string;
    bookhost?: string;
    err?: string;
  } | null {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      const idx = text.indexOf('{');
      if (idx < 0) return null;
      try {
        return JSON.parse(text.substring(idx));
      } catch {
        return null;
      }
    }
  }

  // @ts-expect-error - public method with auto-retry wrapper
  async parseChapter(chapterPath: string): Promise<string> {
    const maxRetries = this.autoRetry ? 10 : 1;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await this._parseChapter(chapterPath);
      } catch (err) {
        if (err instanceof STVChapterError && err.shouldStopRetry) {
          throw err;
        }
        attempt++;
        if (attempt >= maxRetries) {
          throw err;
        }
        console.warn(`Failed to load chapter (attempt ${attempt}):`, err);
        await new Promise(res => setTimeout(res, 1000));
      }
    }
  }

  private async _parseChapter(chapterPath: string): Promise<string> {
    // Path: /truyen/{host}/{sty}/{bookid}/{chapterId}/
    const pathParts = chapterPath.replace(/^\/|\/$/g, '').split('/');
    const bookHost = pathParts[1] || '';
    const bookId = pathParts[3] || '';
    const chapterId = pathParts[4] || '';
    const referer = `${this.site}${chapterPath}`;

    const origin = new URL(this.site).origin;

    // If this is a retry after captcha verification (refetch from custom.js),
    // skip Steps 0+1 to preserve the captcha-verified session.
    const isPostCaptcha = this._captchaVerifiedPath === chapterPath;
    this._captchaVerifiedPath = null; // consume the flag

    if (!isPostCaptcha) {
      // Step 0: clear session cookies but preserve translation preference.
      const existingJar = await get(origin);
      for (const k in existingJar) {
        await set(origin, { name: k, value: '' });
      }
      await removeSessionCookies();

      // Set translation cookies BEFORE Step 1 so the server sees them
      // on the very first request (session creation).
      await this.applyTranslationCookies(origin);
      await set(origin, { name: 'cookieenabled', value: 'true' });

      // Step 1: prime the session — sends translation cookies with the GET.
      try {
        const pageRes = await fetchApi(referer, {
          headers: { ...(await this._cookieHeader(origin)) },
        });
        const html = await pageRes.text();
        const firstCookies = this.extractCookiesFromHtml(html);
        for (const k in firstCookies) {
          await set(origin, {
            name: k,
            value: firstCookies[k],
          });
        }
        if (pageRes.headers.get('set-cookie')) {
          await setFromResponse(origin, pageRes.headers.get('set-cookie')!);
        }
      } catch {
        // continue — server may still recognise the WebView's cookie jar
      }

      // Re-apply translation cookies in case Step 1's Set-Cookie overwrote them.
      await this.applyTranslationCookies(origin);
    }

    const apiUrl = new URL(`${this.site}/index.php`);
    apiUrl.searchParams.set('bookid', bookId);
    apiUrl.searchParams.set('h', bookHost);
    apiUrl.searchParams.set('c', chapterId);
    apiUrl.searchParams.set('ngmar', 'readc');
    apiUrl.searchParams.set('sajax', 'readchapter');
    apiUrl.searchParams.set('sty', '1');
    apiUrl.searchParams.set('exts', '');

    // Steps 2+3: probe + fetch in a retry loop (same session).
    // The JS reference retries up to 10 times within the same session,
    // sleeping 1s between attempts when the server returns code 5/7.
    const maxInnerRetries = this.autoRetry ? 10 : 1;
    let data: ReturnType<typeof this.parseLooseJson> = null;
    for (let attempt = 0; attempt < maxInnerRetries; attempt++) {
      // Step 2: probe POST that rotates `_ac`.
      try {
        const jar = await get(origin);
        const acValue =
          (jar._ac &&
            (typeof jar._ac === 'string' ? jar._ac : jar._ac.value)) ||
          '';
        const probeRes = await fetchApi(apiUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XmlHttpRequest',
            Origin: origin,
            Referer: referer,
            ...(await this._cookieHeader(origin)),
          },
          body: acValue,
        });
        await probeRes.text();
        if (probeRes.headers.get('set-cookie')) {
          await setFromResponse(origin, probeRes.headers.get('set-cookie')!);
        }
      } catch {
        // probe is best-effort; carry on
      }

      // Step 3: actual chapter fetch using the rotated cookies.
      const chapRes = await fetchApi(apiUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Origin: origin,
          Referer: referer,
          ...(await this._cookieHeader(origin)),
        },
        body: '',
      });
      if (chapRes.headers.get('set-cookie')) {
        await setFromResponse(origin, chapRes.headers.get('set-cookie')!);
      }
      data = this.parseLooseJson(await chapRes.text());
      const code = data && String(data.code);
      if (code === '0') break;
      // Stop codes: don't retry
      if (
        code === '1' ||
        code === '12' ||
        code === '13' ||
        code === '15' ||
        code === '18' ||
        code === '19' ||
        code === '21' ||
        code === '101'
      ) {
        break;
      }
      // code 5/7 etc → retry after 1s
      if (attempt < maxInnerRetries - 1) {
        await new Promise<void>(res => setTimeout(res, 1000));
      }
    }
    if (!data) {
      throw new Error(
        'Bạn đang tải chương quá nhanh. Hãy thử lại sau vài giây.\nReason: null',
      );
    }
    if (String(data.code) === '0' && data.data) {
      const host = data.bookhost || bookHost;
      const rawData = String(data.data)
        .replace('@Bạn đang đọc bản lưu trong hệ thống', '')
        .replace(
          'Bạn đang xem văn bản gốc chưa dịch, có thể kéo xuống cuối trang để chọn bản dịch.',
          '',
        );
      const content = normalizeChapterHtml(host, rawData);
      const title = data.chaptername?.trim();
      return (title ? `<h2>${title}</h2>` : '') + wrapWithParagraphs(content);
    } else {
      console.warn('Unexpected chapter API response', data);
      switch (String(data.code)) {
        case '21': {
          this._captchaVerifiedPath = chapterPath;
          return "<div id='captcha-placeholder'></div><meta id='no-cache-marker'/><meta id='no-prefetch-marker'/>";
        }
        default: {
          throw new STVChapterError(Number(data.code), data);
        }
      }
    }
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const trimmed = searchTerm.trim();
    if (pageNo === 1 && looksLikeExternalUrl(trimmed)) {
      const detected = detectHostFromUrl(trimmed);
      if (detected) {
        let bookid = detected.bookid;
        if (ABT_HOSTS.has(detected.host)) {
          try {
            const abtUrl = new URL(`${this.site}/index.php`);
            abtUrl.searchParams.set('sajax', 'tryaddabtrecord');
            abtUrl.searchParams.set('host', detected.host);
            abtUrl.searchParams.set('abtbookid', bookid);
            const txt = (await fetchText(abtUrl.toString())).trim();
            const num = /^[0-9]+/.exec(txt);
            if (!num) return [];
            bookid = num[0];
          } catch {
            return [];
          }
        }
        const path = `/truyen/${detected.host}/1/${bookid}/`;
        let name = `${detected.host} | ${bookid}`;
        let cover: string = defaultCover;
        try {
          const infoUrl = new URL(`${this.site}/mobile/bookinfo.php`);
          infoUrl.searchParams.set('host', detected.host);
          infoUrl.searchParams.set('hid', bookid);
          const infoRes = await fetchApi(infoUrl.toString(), {
            headers: {
              'x-stv-transport': 'app',
              'x-requested-with': 'com.sangtacviet.mobilereader',
              Referer: `${this.site}${path}`,
            },
          });
          const infoJson = await infoRes.json();
          if (infoJson?.code === 100 && infoJson.book) {
            const b = infoJson.book;
            name = (b.tname || b.name || name).trim();
            if (b.thumb) {
              cover = b.thumb.startsWith('http')
                ? b.thumb
                : `${this.site}${b.thumb}`;
            }
          }
        } catch {
          // best-effort enrichment; fall back to placeholder name/cover
        }
        return [{ name, cover, path }];
      }
    }
    const url = new URL(`${this.site}/io/searchtp/searchBooks`);
    url.searchParams.set('find', searchTerm);
    url.searchParams.set('minc', '0');
    url.searchParams.set('sort', '');
    url.searchParams.set('tag', '');
    url.searchParams.set('p', String(pageNo));
    const html = await fetchText(url.toString());
    return this.parseNovelsFromHTML(html);
  }

  resolveUrl(path: string, isNovel?: boolean): string {
    return this.site + path;
  }

  filters = filters;
}

export default new SangTacVietPlugin();
