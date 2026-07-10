import { load as loadCheerio } from 'cheerio';
import { fetchApi, fetchText } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { defaultCover } from '@libs/defaultCover';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { NovelStatus } from '@libs/novelStatus';
import { storage } from '@libs/storage';
import {
  Buffer,
  NodeCrypto,
  getUserAgent,
  encodeHtmlEntities,
} from '@libs/utils';
import { get, setFromResponse } from '@libs/cookie';

const supportedLanguages: Record<string, string> = {
  af: 'Afrikaans',
  sq: 'Albanian',
  ar: 'Arabic',
  be: 'Belarusian',
  bn: 'Bengali',
  bg: 'Bulgarian',
  ca: 'Catalan',
  zh: 'Chinese',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  hr: 'Croatian',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  eo: 'Esperanto',
  et: 'Estonian',
  fi: 'Finnish',
  fr: 'French',
  gl: 'Galician',
  ka: 'Georgian',
  de: 'German',
  el: 'Greek',
  gu: 'Gujarati',
  ht: 'Haitian Creole',
  he: 'Hebrew',
  hi: 'Hindi',
  hu: 'Hungarian',
  is: 'Icelandic',
  id: 'Indonesian',
  ga: 'Irish',
  it: 'Italian',
  ja: 'Japanese',
  kn: 'Kannada',
  ko: 'Korean',
  lv: 'Latvian',
  lt: 'Lithuanian',
  mk: 'Macedonian',
  mr: 'Marathi',
  ms: 'Malay',
  mt: 'Maltese',
  no: 'Norwegian',
  fa: 'Persian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sr: 'Serbian',
  sk: 'Slovak',
  sl: 'Slovenian',
  es: 'Spanish',
  sw: 'Swahili',
  sv: 'Swedish',
  tl: 'Tagalog',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
  cy: 'Welsh',
};

const pluginSettingTranslate: Plugin.SelectSetting = {
  label: 'Language',
  type: 'Select',
  options: Object.keys(supportedLanguages).map(key => ({
    value: key,
    label: supportedLanguages[key],
  })),
  value: 'en',
};

// https://t.me/s/newtoki_url
const SITE = 'https://toki28.com';

class NewtokiPlugin implements Plugin.PluginBase {
  id = 'newtoki.novel';
  name = 'Newtoki';
  icon = 'src/kr/newtoki/icon.png';
  site = SITE;
  version = '1.0.7';

  imageRequestInit: Plugin.ImageRequestInit = {
    headers: {
      Referer: SITE + '/',
    },
  };

  pluginSettings: Plugin.PluginSettings = {
    newtoki_translate: {
      value: false,
      label: 'Translate Titles & Summaries (Google Translate)',
      type: 'Switch',
    },
    newtoki_translateLang: pluginSettingTranslate,
  };

  private defaultHeaders(): Record<string, string> {
    return {
      'Referer': this.site,
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
  }

  get settingTranslate() {
    return storage.get('newtoki_translate');
  }

  get settingTranslateLang() {
    return storage.get('newtoki_translateLang') || 'en';
  }

  async translateService(
    text: string,
    targetLang?: string,
    sourceLang = 'auto',
  ): Promise<string> {
    if (!text) return text;
    const lang = (targetLang || this.settingTranslateLang).trim();
    if (lang === sourceLang) return text;

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${lang}&dt=t&q=${encodeURIComponent(
        text,
      )}&_t=${Date.now()}_${lang}`;
      const res = await fetchApi(url);
      const json = await res.json();
      if (json && json[0]) {
        return json[0].map((item: any) => item[0]).join('');
      }
    } catch (e) {
      // ignore error
    }
    return text;
  }

  isKorean(text: string): boolean {
    return /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text);
  }

  // --- Base64url helpers ---
  private base64urlEncode(buf: Uint8Array): string {
    return Buffer.from(buf)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private base64urlDecode(str: string): Uint8Array {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    return Buffer.from(s, 'base64');
  }

  private textToParagraphs(text: string): string {
    return text
      .split(/\n{2,}/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0)
      .map((p: string) => `<p>${encodeHtmlEntities(p)}</p>`)
      .join('');
  }

  private hmacSha256(key: string, message: string): string {
    const hmac = NodeCrypto.createHmac('sha256', key);
    hmac.update(message);
    return this.base64urlEncode(new Uint8Array(hmac.digest()));
  }

  // --- XOR decrypt payload ---
  private xorDecrypt(payload: string, key: string): string {
    const payloadBytes = this.base64urlDecode(payload);
    const keyBytes = this.base64urlDecode(key);
    const result = new Uint8Array(payloadBytes.length);
    for (let i = 0; i < payloadBytes.length; i++) {
      result[i] = payloadBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return new TextDecoder('utf-8').decode(result);
  }

  // --- Novel list parsing ---
  private parseNovelList($: any): Plugin.NovelItem[] {
    const novels: Plugin.NovelItem[] = [];

    $('a.novel-card').each((_i: number, el: any) => {
      const $el = $(el);
      const path = $el.attr('href') || '';
      const name = $el.find('.nv-title').text().trim();
      const cover = $el.find('.nv-thumb img').attr('src') || defaultCover;

      if (name && path) {
        novels.push({ name, path, cover });
      }
    });

    return novels;
  }

  get filters(): Filters {
    const translate = this.settingTranslate;
    const getLabel = (kr: string, en: string) =>
      translate ? `${kr} (${en})` : kr;

    return {
      sort: {
        type: FilterTypes.Picker,
        label: getLabel('정렬', 'Sort'),
        value: '',
        options: [
          { label: getLabel('최신순', 'Latest'), value: '' },
          { label: getLabel('북마크순', 'Bookmarks'), value: 'bookmarks' },
          { label: getLabel('조회순', 'Views'), value: 'views' },
        ],
      },
      genre: {
        type: FilterTypes.Picker,
        label: getLabel('장르', 'Genre'),
        value: '',
        options: [
          { label: getLabel('전체', 'All'), value: '' },
          { label: getLabel('판타지', 'Fantasy'), value: '판타지' },
          { label: getLabel('무협', 'Martial Arts'), value: '무협' },
          { label: getLabel('19금', 'Adult (19+)'), value: '19금' },
          { label: getLabel('현대', 'Modern'), value: '현대' },
          { label: getLabel('로맨스', 'Romance'), value: '로맨스' },
          {
            label: getLabel('로맨스 판타지', 'Romance Fantasy'),
            value: '로맨스 판타지',
          },
          { label: 'BL', value: 'BL' },
          { label: getLabel('라노벨', 'Light Novel'), value: '라노벨' },
          { label: getLabel('기타', 'Other'), value: '기타' },
        ],
      },
      platform: {
        type: FilterTypes.Picker,
        label: getLabel('플랫폼', 'Platform'),
        value: '',
        options: [
          { label: getLabel('전체', 'All'), value: '' },
          {
            label: getLabel('직접 업로드', 'Direct Upload'),
            value: '직접 업로드',
          },
          { label: getLabel('노벨피아', 'Novelpia'), value: '노벨피아' },
          { label: getLabel('북토끼', 'Booktoki'), value: '북토끼' },
          { label: getLabel('문피아', 'Munpia'), value: '문피아' },
          { label: getLabel('조아라', 'Joara'), value: '조아라' },
          {
            label: getLabel('카카오페이지', 'KakaoPage'),
            value: '카카오페이지',
          },
          {
            label: getLabel('네이버 시리즈', 'Naver Series'),
            value: '네이버 시리즈',
          },
          { label: getLabel('리디북스', 'Ridibooks'), value: '리디북스' },
          { label: getLabel('기타', 'Other'), value: '기타' },
        ],
      },
    } satisfies Filters;
  }

  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions<Filters>,
  ): Promise<Plugin.NovelItem[]> {
    const { filters } = options;

    const url = new URL(`${this.site}/novel`);

    if (pageNo > 1) {
      url.searchParams.set('page', pageNo.toString());
    }

    if (options.showLatestNovels) {
      // Latest mode - no sort param needed, default is latest
    } else if (filters) {
      if (filters.sort?.value) {
        url.searchParams.set('sort', filters.sort.value as string);
      }
      if (filters.genre?.value) {
        url.searchParams.set('g', filters.genre.value as string);
      }
      if (filters.platform?.value) {
        url.searchParams.set('p', filters.platform.value as string);
      }
    }

    const body = await fetchText(url.toString(), {
      headers: this.defaultHeaders(),
    });
    if (!body) {
      throw new Error(
        'This website is using Cloudflare to protect against malicious bots. Use WebView to bypass it.',
      );
    }
    const $ = loadCheerio(body);

    const novels = this.parseNovelList($);

    if (this.settingTranslate && novels.length > 0) {
      let content = '';
      for (const novel of novels) {
        content += novel.name + '\n';
      }
      content = await this.translateService(content);
      const translatedNames = content.split('\n');
      for (let i = 0; i < novels.length; i++) {
        novels[i].name = translatedNames[i] || novels[i].name;
      }
    }

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const url = `${this.site}${novelPath}`;
    const body = await fetchText(url, { headers: this.defaultHeaders() });
    if (!body) {
      throw new Error(
        'This website is using Cloudflare to protect against malicious bots. Use WebView to bypass it.',
      );
    }
    const $ = loadCheerio(body);

    // Parse novel info
    let name = $('section.novel-detail .nd-info h1').text().trim();
    const cover =
      $('section.novel-detail .nd-thumb img').attr('src') || defaultCover;
    const authorText = $('section.novel-detail .nd-meta span')
      .first()
      .text()
      .trim();
    let summary = $('section.novel-detail .nd-desc').text().trim();
    let genres = $('section.novel-detail .hero-v2-tags a')
      .map((_i: number, el: any) => $(el).text().replace('#', '').trim())
      .get()
      .join(',');

    // Parse chapters
    const chapters: Plugin.ChapterItem[] = [];
    $('ul.novel-eps > li').each((_i: number, el: any) => {
      const $el = $(el);
      const chapterLink = $el.find('a');
      const chapterPath = chapterLink.attr('href') || '';
      const chapterName = $el.find('.ne-title').text().trim();
      const releaseTime = $el.find('.ne-date').text().trim();
      const epNum = $el.attr('data-ep');

      if (chapterPath) {
        chapters.push({
          name: chapterName || `${epNum}화`,
          path: chapterPath,
          releaseTime: this.convertDate(releaseTime),
          chapterNumber: epNum ? parseInt(epNum) : undefined,
        });
      }
    });

    // Chapters are listed newest-first on the page, reverse for correct order
    chapters.reverse();

    if (this.settingTranslate) {
      if (genres) {
        const trans = await this.translateService(
          `${name}\n${genres}\n${summary}`,
        );
        const arr = trans.split('\n');
        name = arr[0] || name;
        genres = arr[1] || genres;
        summary = arr.slice(2).join('\n') || summary;
      } else {
        const trans = await this.translateService(`${name}\n${summary}`);
        const arr = trans.split('\n');
        name = arr[0] || name;
        summary = arr.slice(1).join('\n') || summary;
      }

      if (chapters.length > 0) {
        let chapterNames = '';
        for (const ch of chapters) {
          chapterNames += ch.name + '\n';
        }
        const translated = await this.translateService(
          chapterNames,
          undefined,
          'ko',
        );
        const translatedArr = translated.split('\n');
        for (let i = 0; i < chapters.length; i++) {
          chapters[i].name = translatedArr[i]?.trim() || chapters[i].name;
        }
      }
    }

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name,
      author: authorText,
      summary,
      genres,
      cover,
      status: NovelStatus.Unknown,
      chapters,
    };

    return novel;
  }

  // Format: "yy. mm. dd."
  convertDate(date: string) {
    const [yy, mm, dd] = date.split('.').map(s => s.trim());
    if (!dd || !mm || !yy) return null;
    return `20${yy}-${mm}-${dd}`;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = `${this.site}${chapterPath}`;
    const userAgent = getUserAgent();

    const pageHtml = await fetchText(url, {
      headers: { ...this.defaultHeaders(), 'User-Agent': userAgent },
    });

    const tokenMatch =
      pageHtml.match(
        /\\"token\\":\\"(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)\\"/,
      ) ||
      pageHtml.match(
        /"token":"(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)"/,
      );
    if (!tokenMatch) {
      throw new Error('Unable to load content (token not found).');
    }
    const token = tokenMatch[1];

    const pathMatch = chapterPath.match(/\/novel\/(\d+)\/(\d+)/);
    if (!pathMatch) {
      throw new Error('Invalid chapter path.');
    }
    const novelId = pathMatch[1];
    const episodeId = pathMatch[2];

    let nvCookie = '';

    const nvRes = await fetchApi(`${this.site}/api/nv-issue`, {
      method: 'POST',
      headers: {
        ...this.defaultHeaders(),
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
      },
    });

    const setCookieHeader = nvRes.headers?.get?.('set-cookie') || '';

    if (setCookieHeader) {
      const nvFromHeader = setCookieHeader.match(/nv=([A-Za-z0-9_.-]+)/);
      if (nvFromHeader) {
        nvCookie = nvFromHeader[1];
      }
      await setFromResponse(this.site, setCookieHeader);
    }

    if (!nvCookie) {
      const cookiesAfter = await get(this.site);
      nvCookie = cookiesAfter.nv?.value || '';
    }

    if (!nvCookie) {
      throw new Error('Unable to load content (nv cookie not found).');
    }

    // Generate nonce
    const nonceBytes = NodeCrypto.randomBytes(24);
    const nonce = this.base64urlEncode(nonceBytes);

    const proofMessage = `${token}.${nonce}.${userAgent}`;
    const proof = this.hmacSha256(nvCookie, proofMessage);
    const contentRes = await fetchApi(`${this.site}/api/novel-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'x-novel-client': 'shadow-v2',
        'Origin': this.site,
        'Referer': url,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
      },
      body: JSON.stringify({ novelId, episodeId, token, nonce, proof }),
    });

    const contentJson = await contentRes.json();

    if (!contentJson.ok || contentJson.empty || !contentJson.payload) {
      throw new Error('Unable to load content (json error).');
    }
    const xorKey = nvCookie.split('.')[0] || '';
    if (!xorKey) {
      throw new Error('Decryption key not available.');
    }

    const decrypted = this.xorDecrypt(contentJson.payload, xorKey);

    // Parse the decrypted content
    let chapterHtml = '';
    try {
      const parsed = JSON.parse(decrypted);
      if (parsed.kind === 'html' && typeof parsed.html === 'string') {
        chapterHtml = parsed.html;
      } else if (parsed.kind === 'text' && typeof parsed.text === 'string') {
        chapterHtml = this.textToParagraphs(parsed.text);
      } else {
        chapterHtml = this.textToParagraphs(decrypted);
      }
    } catch {
      chapterHtml = this.textToParagraphs(decrypted);
    }

    if (!chapterHtml) throw new Error('No content available.');
    return chapterHtml;
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    let finalSearchTerm = searchTerm;
    if (this.settingTranslate && searchTerm && !this.isKorean(searchTerm)) {
      finalSearchTerm = await this.translateService(searchTerm, 'ko', 'auto');
    }

    const url = `${this.site}/novel?page=${pageNo}&q=${encodeURIComponent(
      finalSearchTerm,
    )}`;

    const body = await fetchText(url, { headers: this.defaultHeaders() });
    if (!body) {
      throw new Error(
        'This website is using Cloudflare to protect against malicious bots. Use WebView to bypass it.',
      );
    }
    const $ = loadCheerio(body);

    const novels = this.parseNovelList($);

    if (this.settingTranslate && novels.length > 0) {
      let content = '';
      for (const novel of novels) {
        content += novel.name + '\n';
      }
      content = await this.translateService(content);
      const translatedNames = content.split('\n');
      for (let i = 0; i < novels.length; i++) {
        novels[i].name = translatedNames[i] || novels[i].name;
      }
    }

    return novels;
  }

  resolveUrl(path: string, isNovel?: boolean): string {
    return `${this.site}${path}`;
  }
}

export default new NewtokiPlugin();
