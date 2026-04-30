/* eslint-disable no-useless-escape */

import { load as parseHTML } from 'cheerio';
import { fetchApi, fetchText } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { NovelStatus } from '@libs/novelStatus';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { defaultCover } from '@libs/defaultCover';
import { storage } from '@libs/storage';
import { get, set, setFromResponse, removeSessionCookies } from '@libs/cookie';

const SITE = 'https://sangtacviet.app';

const GH_UPDATE =
  'https://raw.githubusercontent.com/sangtacviet/sangtacviet.github.io/main/update.json';

const DOMAINS: Record<string, string> = {
  'sangtacviet.app': 'https://sangtacviet.app',
  'sangtacviet.pro': 'https://sangtacviet.pro',
  'dns1.stv-appdomain-00000001.org': 'https://dns1.stv-appdomain-00000001.org',
};

// ── External-URL
const HOST_PATTERNS: Record<string, string[]> = {
  uukanshu: [
    'uukanshu\\.(?:com|net)/b/(\\d+)/(\\d+)?(.html)?',
    'sj\\.uukanshu\\.(?:com|net)//?book(?:_amp)?\\.aspx\\?id=(\\d+)',
    'sj\\.uukanshu\\.(?:com|net)//?read\\.aspx?tid=(\\d+)&sid=(\\d+)',
    'zhaoshuyuan\\.(?:com|net)/b/(\\d+)/(\\d+)?(.html)?',
    'zhaoshuyuan\\.(?:com|net)//?book(?:_amp)?\\.aspx\\?id=(\\d+)',
    'zhaoshuyuan\\.(?:com|net)//?read\\.aspx?tid=(\\d+)&sid=(\\d+)',
  ],
  '69shu': [
    '69shuba\\.com/(?:txt|book/)?(\\d+)/?(\\d+)?',
    '69shuba\\.cx/(?:txt|book/)?(\\d+)/?(\\d+)?',
    '69xinshu\\.com/(?:txt|book/)?(\\d+)/?(\\d+)?',
    '69shu\\.pro/(?:txt|book/)?(\\d+)/?(\\d+)?',
    '69shu\\.[a-z]{3,4}/(?:txt|book/)?(\\d+)/?(\\d+)?',
    '69shuba\\.[a-z]{3,4}/(?:txt|book/)?(\\d+)/?(\\d+)?',
  ],
  '69shuorg': ['69shu\\.org/book[_/](\\d+)/(\\d+)?'],
  xiaoqiangwx: ['xiaoqiangwx\\.org/(?:\\d+|book)/(\\d+)/?(\\d+)?(.html)?'],
  cuiweijux: ['cuiweijux\\.com/files/article/html/\\d+/(\\d+)/(\\d+)?(.html)?'],
  biquge: [
    'biquge\\.com\\.cn/book/(\\d+)/(\\d+)?(.html)?',
    'sobiquge\\.com/book/(\\d+)/',
    '81zw\\.org/books/(\\d+)/',
  ],
  trxs: ['trxs\\.cc/tongren/(\\d+)/?(\\d+)?(.html)?'],
  ikshu8: ['ikshu8\\.com/book/(\\d+)/?(\\d+)?(.html)?'],
  shulinw: ['shulinw\\.com/(?:shu/|yuedu/|book/|\\d+/|modules/article/articleinfo\\.php\\?id=)(\\d+)(?:/)?(\\d*)(.html)?'],
  wuxia1: ['wuxia1\\.com/(?:shu/|yuedu/|book/|\\d+/|modules/article/articleinfo\\.php\\?id=)(\\d+)(?:/)?(\\d*)(.html)?'],
  shu05: ['shu05\\.com/\\d+[/_](\\d+)/(\\d*)(.html)?'],
  kuhu168: ['kuhu168\\.com/\\d+[/_](\\d+)/(\\d*)(.html)?'],
  '2kxs': ['2kxs\\.org/\\d+[/_](\\d+)/(\\d*)(.html)?'],
  yikanxiaoshuo: ['yikanxiaoshuo\\.com/\\d+[/_](\\d+)/(\\d*)(.html)?'],
  '8zwdu': ['8zwdu\\.com/\\d+[/_](\\d+)/(\\d*)(.html)?'],
  kanmaoxian: ['kanmaoxian\\.com/(?:book|\\d+)/(\\d+)/?(\\d*)(.html)?'],
  kayegenet: ['kayege\\.net/(?:book|\\d+)[/_](\\d+)/?(\\d*)(.html)?'],
  '4gxsw': ['4gxsw\\.com/(?:book|html/\\d+)/(\\d+)/?(\\d*)(.html)?'],
  qinqinxsw: ['qinqinxsw\\.com/(?:book|\\d+)[/_](\\d+)/?(\\d*)(.html)?'],
  read8: ['read8\\.net/(?:dushu)/(\\d+)/(\\d*)(.html)?'],
  ciweimao: ['ciweimao\\.com/book/(\\d+)'],
  wkkshu: ['wkkshu\\.com/(?:xs/\\d+/|\\d+_)(\\d+)/(\\d*)(.html)?'],
  '168kanshu': ['168kanshu\\.com/(?:xs/\\d+/|\\d+_)(\\d+)/(\\d*)(.html)?'],
  wanbentxt: ['wanbentxt\\.com/(\\d+)/([\\d_]*)(.html)?'],
  '38kanshu': ['mijiashe\\.com/(\\d+)/([\\d_]*)(.html)?'],
  duanqingsi: ['duanqingsi\\.com/(\\d+)/([\\d_]*)(.html)?'],
  faloo: [
    '\\.faloo\\.com/[pfboklithtm]+/(\\d+)(?:\\.html|/(\\d+)\\.html)?',
    '\\.faloo\\.com/(\\d+)\\.html',
    '\\.faloo\\.com/(\\d+)_(\\d+)\\.html',
  ],
  qiuxiaoshuo: ['qiuxiaoshuo\\.com/(?:book|read)[/-](\\d+)[/-]?(\\d*)'],
  dibaqu123: ['dibaqu123\\.com/\\d+/(\\d+)/?(\\d*)(.html)?'],
  jiacuan: ['jiacuan\\.com/\\d+/(\\d+)/(\\d*)(.html)?'],
  shubaow: ['shubaow\\.net/\\d+[_/](\\d+)/(\\d*)(.html)?'],
  biqugeinfo: ['biquge\\.info/\\d+_(\\d+)/(\\d*)(.html)?'],
  shumilou: ['shumilou\\.net/\\d+/(\\d+)/(\\d*)(.html)?'],
  xbiquge: ['xbiquge\\.cc/book/(\\d+)/(\\d*)(.html)?'],
  paoshu8: ['paoshu8\\.com/\\d+_(\\d+)/(\\d*)(.html)?'],
  duokan8: ['duokan8\\.com/\\d+_(\\d+)/(\\d*)(.html)?'],
  biqugecom: ['biquge\\.com/\\d+_(\\d+)/(\\d*)(.html)?'],
  hetushu: ['hetushu\\.com/book/(\\d+)/(\\d*)(.html)?'],
  nofff: ['nofff\\.com/(\\d+)/(\\d*)/?'],
  uuxs: ['uuxs\\.tw/ls/\\d+_(\\d+)/(\\d*)(.html)?'],
  ranwenla: ['ranwen\\.la/files/article/\\d+/(\\d+)/(\\d*)(.html)?'],
  '66wx': ['66wx\\.com/(\\d+)_\\d+/read(\\d*)(.html)?'],
  biqugexs: ['biqugexs\\.com/\\d+_(\\d+)/(\\d*)(.html)?'],
  '230book': ['230book\\.[comnet]{3}/book/(\\d+)/(\\d*)(.html)?'],
  biqubu: ['biqubu\\.com/book_(\\d+)/(\\d*)(.html)?'],
  '521danmei': [
    '521danmei\\.org/read/(\\d+)/(\\d*)/?',
    '521danmei\\.org/book/(\\d+)\\.html',
  ],
  bxwxorg: [
    'bxwxorg\\.com/read/(\\d+)/(\\d*)(.html)?',
    'bxwxorg\\.com/book/(\\d+)\\.html',
  ],
  qidian: ['qidian\\.com/(?:book|info)/(\\d+)'],
  zwdu: ['zwdu\\.com/book/(\\d+)/(\\d*)(.html)?'],
  zongheng: [
    'book\\.zongheng\\.com/chapter/(\\d+)/(\\d*)(.html)?',
    'book\\.zongheng\\.com/book/(\\d+)(?:\\.html)?',
  ],
  biqugese: [
    'biquge\\.se/(\\d+)/(\\d*)(.html)?',
    'biqugse\\.com/(\\d+)/(\\d*)(.html)?',
  ],
  qiushubang: ['qiushubang\\.com/(\\d+)/(\\d*)(.html)?'],
  xinshuhaige: ['xinshuhaige\\.com/(\\d+)/(\\d*)(.html)?'],
  oldtimescc: ['oldtimescc\\.cc/go/(\\d+)/(\\d*)(.html)?'],
  wuwuxs: ['wuwuxs\\.com/\\d+_(\\d+)/(\\d*)(.html)?'],
  hs313: ['hs313\\.net/book/(\\d+)/(\\d*)(.html)?'],
  shuchong: ['shuchong\\.info/chapter/(\\d+)/(\\d*)(.html)?'],
  shucw: ['shucw\\.com/html/\\d+/(\\d+)/(\\d*)(.html)?'],
  shumizu: ['shumizu\\.com/\\d+/(\\d+)/(\\d*)(.html)?'],
  tadu: ['tadu\\.com/book/(\\d+)/?(\\d*)/?'],
  ptwxz: [
    'ptwxz\\.com/bookinfo/\\d+/(\\d+)\\.html',
    'ptwxz\\.com/html/\\d+/(\\d+)/(\\d+)\\.html',
    'ptwxz\\.com/html/\\d+/(\\d+)/',
  ],
  x81zw: ['x81zw\\.com/book/\\d+/(\\d+)/(\\d*)(.html)?'],
  linovel: ['linovel\\.net/book/(\\d+)\\.html'],
  wenku8: ['wenku8\\.net/novel/\\d+/(\\d+)/(\\d*)\\.htm'],
  youyoukanshu: [
    'youyoukanshu\\.com/book/(\\d+)\\.html',
    'youyoukanshu\\.com/book/(\\d+)/(\\d*)(.html)?',
  ],
  biqubao: ['biqubao\\.com/book/(\\d+)/(\\d*)(.html)?'],
  biqugele: ['biqugele\\.com/txt/(\\d+)/(\\d*)(.html)?'],
  biqugebz: ['biquge\\.bz/(\\d+)/(\\d*)(.html)?'],
  biquge5200: ['biquge5200\\.cc/\\d+_(\\d+)/(\\d*)(.html)?'],
  sfacg: [
    'sfacg\\.com/(?:Novel|b|i)/(\\d+)/?',
    'sfacg\\.com/Novel/(\\d+)/MainIndex/',
  ],
  shubao45: ['shubao45\\.com/\\d+_(\\d+)/(\\d*)(.html)?'],
  kujiang: ['kujiang\\.com/book/(\\d+)'],
  yushubo: [
    'yushubo\\.com/book_(\\d+)',
    'yushubo\\.net/book_(\\d+)',
    'yushugu\\.com/book_(\\d+)',
    'yushugu\\.com/list_other_(\\d+)',
    'yushugu\\.com/read_(\\d+)_(\\d+)\\.html',
  ],
  xklxsw: ['xklxsw\\.com/book/(\\d+)/'],
  fanqie: ['fanqienovel\\.com/page/(\\d+)'],
  xsbiquge: ['xsbiquge\\.net/\\d+_(\\d+)/(\\d*)(.html)?'],
  jjwxc: [
    'jjwxc\\.net//?onebook\\.php\\?novelid=(\\d+)',
    'jjwxc\\.net//?book2/(\\d+)/?',
  ],
  qimao: ['qimao\\.com/shuku/(\\d+)/'],
  ddxs: ['ddxs\\.com/([a-z0-9A-Z\\-_]+)/(\\d+)?'],
  quanben5: ['quanben5\\.com/n/([a-z0-9A-Z\\-_]+)/'],
  idejian: ['idejian\\.com/book/([0-9]+)/'],
};

// Hosts whose first capture is alphanumeric and must be resolved to a numeric
// bookid via /index.php?sajax=tryaddabtrecord (mirrors `isAbtHost()`).
const ABT_HOSTS = new Set(['ddxs', 'quanben5', 'colamanga']);

function looksLikeExternalUrl(s: string): boolean {
  const t = s.toLowerCase();
  return t.startsWith('http://') || t.startsWith('https://');
}

function detectHostFromUrl(
  input: string,
): { host: string; bookid: string; chapterid?: string } | null {
  for (const host in HOST_PATTERNS) {
    for (const pat of HOST_PATTERNS[host]) {
      const m = new RegExp(pat, 'i').exec(input);
      if (!m) continue;
      if (m[2] !== undefined && m[2] !== m[1] && /^[\d_\-]+$/.test(m[2])) {
        if (m[1]) return { host, bookid: m[1], chapterid: m[2] };
      }
      if (m[1]) return { host, bookid: m[1] };
    }
  }
  return null;
}

// ── Webfont glyph decode ─────────────────────────────
// prettier-ignore
const GLYPH_MAP: Record<string, string> = {};
([
  [0xE01B,'A'],[0xE01E,'y'],[0xE05F,'3'],[0xE063,'z'],[0xE06B,'K'],[0xE06C,'t'],
  [0xE089,'l'],[0xE0D5,'S'],[0xE0D6,'T'],[0xE100,'o'],[0xE101,'P'],[0xE116,'4'],
  [0xE122,'W'],[0xE124,'Z'],[0xE14B,'J'],[0xE160,'e'],[0xE184,'O'],[0xE186,'D'],
  [0xE1A4,'f'],[0xE1AD,'e'],[0xE1B4,'k'],[0xE1B8,'f'],[0xE1BF,'n'],[0xE1C0,'Y'],
  [0xE1C1,'1'],[0xE1D8,'K'],[0xE1E4,'M'],[0xE1EA,'Y'],[0xE215,'C'],[0xE218,'A'],
  [0xE22B,'h'],[0xE240,'x'],[0xE248,'v'],[0xE257,'G'],[0xE27E,'b'],[0xE2A9,'B'],
  [0xE2C5,'s'],[0xE2C7,'t'],[0xE2CA,'G'],[0xE2E3,'k'],[0xE2F8,'q'],[0xE30F,'F'],
  [0xE311,'u'],[0xE32F,'E'],[0xE334,'2'],[0xE34A,'I'],[0xE37C,'R'],[0xE38F,'v'],
  [0xE39B,'X'],[0xE3B0,'l'],[0xE3B7,'7'],[0xE3F1,'l'],[0xE41B,'o'],[0xE41C,'H'],
  [0xE426,'S'],[0xE427,'J'],[0xE43E,'6'],[0xE44E,'X'],[0xE46A,'b'],[0xE477,'y'],
  [0xE49A,'c'],[0xE4A3,'8'],[0xE4AE,'2'],[0xE4CC,'s'],[0xE4D3,'5'],[0xE4DB,'L'],
  [0xE4DF,'N'],[0xE4EC,'5'],[0xE4F3,'r'],[0xE519,'0'],[0xE51F,'g'],[0xE550,'E'],
  [0xE557,'h'],[0xE566,'N'],[0xE571,'F'],[0xE57B,'O'],[0xE5BD,'C'],[0xE5C1,'d'],
  [0xE5C9,'8'],[0xE5D1,'x'],[0xE5DC,'m'],[0xE5E1,'9'],[0xE5F0,'u'],[0xE5FA,'m'],
  [0xE5FF,'a'],[0xE603,'U'],[0xE62A,'w'],[0xE636,'P'],[0xE63E,'D'],[0xE648,'6'],
  [0xE65B,'H'],[0xE65D,'z'],[0xE660,'9'],[0xE68D,'1'],[0xE691,'M'],[0xE6A4,'q'],
  [0xE6A5,'c'],[0xE6D7,'W'],[0xE6E0,'R'],[0xE6F1,'T'],[0xE6F3,'a'],[0xE6F5,'g'],
  [0xE705,'w'],[0xE71A,'3'],[0xE735,'Z'],[0xE74F,'Q'],[0xE762,'r'],[0xE765,'n'],
  [0xE775,'V'],[0xE77A,'d'],[0xE77D,'L'],[0xE77E,'4'],[0xE7C7,'U'],[0xE7E5,'0'],
  [0xE7F6,'7'],[0xE902,'A'],[0xE915,'O'],[0xE91F,'e'],[0xE946,'a'],[0xE95D,'2'],
  [0xE97B,'f'],[0xE9A8,'y'],[0xE9CC,'P'],[0xE9D5,'o'],[0xE9D7,'r'],[0xE9F8,'O'],
  [0xE9F9,'K'],[0xEA15,'e'],[0xEA20,'Y'],[0xEA24,'N'],[0xEA2D,'v'],[0xEA2E,'R'],
  [0xEA2F,'C'],[0xEA43,'4'],[0xEA47,'l'],[0xEA65,'S'],[0xEA75,'M'],[0xEA76,'H'],
  [0xEA77,'u'],[0xEA82,'o'],[0xEAA1,'k'],[0xEAA4,'a'],[0xEAA5,'x'],[0xEAA6,'z'],
  [0xEAB2,'6'],[0xEAB4,'t'],[0xEABB,'y'],[0xEAC5,'w'],[0xEACF,'b'],[0xEAD5,'L'],
  [0xEAE3,'A'],[0xEAED,'F'],[0xEB02,'s'],[0xEB06,'s'],[0xEB0E,'C'],[0xEB0F,'R'],
  [0xEB18,'w'],[0xEB27,'D'],[0xEB62,'l'],[0xEB63,'9'],[0xEB75,'h'],[0xEB85,'X'],
  [0xEBEC,'k'],[0xEBF6,'N'],[0xEC0F,'q'],[0xEC19,'J'],[0xEC50,'7'],[0xEC6D,'g'],
  [0xEC75,'d'],[0xEC85,'n'],[0xECAD,'V'],[0xECB4,'S'],[0xECD4,'L'],[0xECDB,'Z'],
  [0xECE6,'E'],[0xECF8,'U'],[0xED07,'V'],[0xED2C,'Q'],[0xED35,'l'],[0xED37,'J'],
  [0xED48,'W'],[0xED64,'5'],[0xED71,'2'],[0xED72,'v'],[0xED8C,'E'],[0xEDEB,'Y'],
  [0xEDEC,'5'],[0xEDED,'m'],[0xEE01,'c'],[0xEE09,'Q'],[0xEE0C,'n'],[0xEE0F,'u'],
  [0xEE47,'W'],[0xEE5C,'P'],[0xEE69,'b'],[0xEE8D,'0'],[0xEEA1,'X'],[0xEEBB,'F'],
  [0xEEC1,'I'],[0xEECC,'B'],[0xEECF,'c'],[0xEEDA,'1'],[0xEEDB,'D'],[0xEEE3,'G'],
  [0xEF1F,'8'],[0xEF26,'K'],[0xEF35,'x'],[0xEF37,'6'],[0xEF3A,'d'],[0xEF57,'H'],
  [0xEF5A,'U'],[0xEF61,'G'],[0xEF91,'8'],[0xEF94,'T'],[0xEFC8,'m'],[0xEFD4,'1'],
  [0xEFD7,'Z'],[0xEFDA,'h'],[0xEFEE,'3'],[0xEFEF,'4'],[0xEFF6,'3'],[0xF00A,'q'],
  [0xF019,'T'],[0xF050,'B'],[0xF065,'0'],[0xF073,'7'],[0xF096,'z'],[0xF0A6,'t'],
  [0xF0BA,'r'],[0xF0BD,'M'],[0xF0C0,'g'],[0xF7A0,'0'],[0xF7A1,'1'],[0xF7A2,'2'],
  [0xF7A3,'3'],[0xF7A4,'4'],[0xF7A5,'5'],[0xF7A6,'6'],[0xF7A7,'7'],[0xF7A8,'8'],
  [0xF7A9,'9'],[0xF8FF,'*'],
] as [number, string][]).forEach(([code, ch]) => {
  GLYPH_MAP[String.fromCharCode(code)] = ch;
});

function decodeGlyphs(text: string): string {
  let out = '';
  for (const ch of text) {
    out += GLYPH_MAP[ch] ?? ch;
  }
  return out;
}

// ── Content normalization  ─────────────────
function looksLikeInterlinear(text: string): boolean {
  return /<i\b[^>]*\b(?:t|v|p)\s*=\s*['"][^'"]*['"][^>]*>/i.test(text);
}

function normalizeInterlinear(raw: string): string {
  let t = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/<br\s*\/?>\s*/gi, '\n').replace(/<\/br\s*>/gi, '\n');
  t = t.replace(/<\/i>\s*\n+\s*(?=[,.;:!?%\)\]\}\u3002\uff0c\u3001\uff01\uff1f\uff1b\uff1a\u201d\u2019\u300d\u300f\u3011\u300b])/gi, '</i>');
  const marker = '__STV_GAP__';
  t = t.replace(/<\/i>\s*<i\b/gi, '</i>' + marker + '<i');
  t = t.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, '$1');
  t = t.replace(/<\/?(p|div|article|section|li|tr|h[1-6]|blockquote|ul|ol)[^>]*>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '').replace(/[<>]/g, '');
  t = t.replace(/&nbsp;/gi, ' ').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');
  t = t.replace(new RegExp(marker, 'g'), ' ');
  t = t.replace(/[\t\f\v ]+/g, ' ');
  t = t.replace(/ +([,.;:!?%\)\]\}\u3002\uff0c\u3001\uff01\uff1f\uff1b\uff1a\u201d\u2019\u300d\u300f\u3011\u300b])/g, '$1');
  t = t.replace(/\n+([,.;:!?%\)\]\}\u3002\uff0c\u3001\uff01\uff1f\uff1b\uff1a\u201d\u2019\u300d\u300f\u3011\u300b])/g, '$1');
  t = t.replace(/[ ]*\n[ ]*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t ? t.replace(/\n/g, '<br>') : '';
}

function normalizeChapterHtml(host: string, raw: string): string {
  let text = raw || '';
  if (!text) return '';
  const h = host.toLowerCase();

  if (h === 'fanqie') {
    text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    text = text.replace(/<\/?article>/gi, '');
    text = text.replace(/\sidx="\d+"/g, '');
    if (looksLikeInterlinear(text)) return normalizeInterlinear(text);
    return text;
  }

  if (h === 'sangtac' || h === 'dich') {
    text = decodeGlyphs(text);
    if (looksLikeInterlinear(text)) return normalizeInterlinear(text);
    if (!/<\w+[^>]*>/.test(text)) {
      text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '<br>');
    }
    return text;
  }

  if (!/<\w+[^>]*>/.test(text)) {
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '<br>');
    return text;
  }
  if (looksLikeInterlinear(text)) return normalizeInterlinear(text);
  return text;
}

function wrapWithParagraphs(rawText: string): string {
  if (!rawText) return '';
  const cleanText = rawText.replace(/<br\s*\/?>/gi, '\n');
  const paragraphs = cleanText.split('\n');
  const htmlResult = paragraphs
    .map(line => line.trim())
    .filter(line => line.length > 0) 
    .map(line => `<p>${line}</p>`)
    .join('\n');
  return htmlResult;
}

function decodeHTMLEntities(str: string) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
    '&nbsp;': ' ',
  };

  return str.replace(
    new RegExp(Object.keys(entities).join('|'), 'g'),
    match => entities[match as keyof typeof entities],
  );
}

class SangTacVietPlugin implements Plugin.PluginBase {
  id = 'sangtacviet';
  name = 'Sáng Tác Việt';
  icon = 'src/vi/sangtacviet/icon.png';
  get site() {
    return DOMAINS[this.selectedDomain] || SITE;
  }
  version = '1.0.11';
  webStorageUtilized = true;

  pluginSettings: Plugin.PluginSettings = {
    selectedDomain: {
      type: 'Select',
      label: 'Tên miền',
      value: 'sangtacviet.app',
      options: [
        { label: 'sangtacviet.app', value: 'sangtacviet.app' },
        { label: 'sangtacviet.pro', value: 'sangtacviet.pro' },
        { label: 'dns1.stv-appdomain-00000001.org', value: 'dns1.stv-appdomain-00000001.org' },
      ],
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

    novel.summary = decodeHTMLEntities(novel.summary || '');

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

    // Step 0: clear session cookies but preserve translation preference.
    const oldCookies = await get(origin);
    for (const k in oldCookies) {
      await set(origin, { name: k, value: '' });
    }
    await removeSessionCookies();

    // Set translation cookies BEFORE Step 1 so the server sees them
    // on the very first request (session creation).
    await this.applyTranslationCookies(origin);

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

    const apiUrl = new URL(`${this.site}/index.php`);
    apiUrl.searchParams.set('bookid', bookId);
    apiUrl.searchParams.set('h', bookHost);
    apiUrl.searchParams.set('c', chapterId);
    apiUrl.searchParams.set('ngmar', 'readc');
    apiUrl.searchParams.set('sajax', 'readchapter');
    apiUrl.searchParams.set('sty', '1');
    apiUrl.searchParams.set('exts', '');

    // Step 2: probe POST that rotates `_ac`.
    // The browser sends the current `_ac` cookie value as the POST body.
    // Sending an empty body triggers the anti-bot heuristic (code 21).
    try {
      const jar = await get(origin);
      const acValue = (jar._ac && (typeof jar._ac === 'string' ? jar._ac : jar._ac.value)) || '';
      const probeRes = await fetchApi(apiUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XmlHttpRequest',
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
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: referer,
        ...(await this._cookieHeader(origin)),
      },
      body: '',
    });
    const data = this.parseLooseJson(await chapRes.text());
    if (!data) {
      throw new Error(
        'Bạn đang tải chương quá nhanh. Hãy thử lại sau vài giây.\nReason: null',
      );
    }
    if (String(data.code) === '0' && data.data) {
      const host = data.bookhost || bookHost;
      const rawData = String(data.data)
        .replace('@Bạn đang đọc bản lưu trong hệ thống', '')
        .replace('Bạn đang xem văn bản gốc chưa dịch, có thể kéo xuống cuối trang để chọn bản dịch.', '');
      const content = normalizeChapterHtml(host, rawData);
      const title = data.chaptername?.trim();
      return (title ? `<h2>${title}</h2>` : '') + wrapWithParagraphs(content);
    } else {
      console.warn('Unexpected chapter API response', data);
      switch (String(data.code)) {
        case '7': {
          throw new Error(
            'Bạn đang tải chương quá nhanh. Hãy thử lại sau vài giây.\nReason: code 7',
          );
        }
        case '21': {
          throw new Error(
            'Bạn cần xác nhận captcha. Hãy thử lại sau vài giây.\nReason: code 21',
          );
        }
        default: {
          throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
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

  filters = {
    sort: {
      type: FilterTypes.Picker,
      label: 'Sắp xếp',
      value: 'view',
      options: [
        { label: 'Không sắp xếp', value: '' },
        { label: 'Mới nhập kho', value: 'new' },
        { label: 'Mới cập nhật', value: 'update' },
        { label: 'Lượt đọc tổng', value: 'view' },
        { label: 'Lượt đọc tuần', value: 'viewweek' },
        { label: 'Lượt đọc ngày', value: 'viewday' },
        { label: 'Lượt thích', value: 'like' },
        { label: 'Lượt theo dõi', value: 'following' },
        { label: 'Lượt đánh dấu', value: 'bookmarked' },
        { label: 'Đề cử', value: 'auto' },
      ],
    },
    minc: {
      type: FilterTypes.Picker,
      label: 'Số chương tối thiểu',
      value: '0',
      options: [
        { label: 'Tất cả', value: '0' },
        { label: '> 50', value: '50' },
        { label: '> 100', value: '100' },
        { label: '> 200', value: '200' },
        { label: '> 500', value: '500' },
        { label: '> 1000', value: '1000' },
        { label: '> 1500', value: '1500' },
        { label: '> 2000', value: '2000' },
      ],
    },
    category: {
      type: FilterTypes.Picker,
      label: 'Thể loại chính',
      value: '',
      options: [
        { label: 'Tất cả', value: '' },
        { label: 'Huyền huyễn', value: 'hh' },
        { label: 'Đô thị', value: 'dt' },
        { label: 'Ngôn tình', value: 'nt' },
        { label: 'Võng du', value: 'vd' },
        { label: 'Khoa học viễn tưởng', value: 'kh' },
        { label: 'Lịch sử', value: 'ls' },
        { label: 'Đồng nhân', value: 'dn' },
        { label: 'Dị năng', value: 'dna' },
        { label: 'Linh dị', value: 'ld' },
        { label: 'Light Novel', value: 'ln' },
      ],
    },
    type: {
      type: FilterTypes.Picker,
      label: 'Loại truyện',
      value: '',
      options: [
        { label: 'Tất cả', value: '' },
        { label: 'Truyện sáng tác', value: 'sangtac' },
        { label: 'Truyện dịch', value: 'dich' },
        { label: 'Truyện tranh', value: 'comic' },
        { label: 'Txt dịch tự động', value: 'txt' },
        { label: 'Truyện scan ảnh', value: 'scan' },
      ],
    },
    step: {
      type: FilterTypes.Picker,
      label: 'Trạng thái đăng',
      value: '',
      options: [
        { label: 'Tất cả', value: '' },
        { label: 'Hoàn thành', value: '3' },
        { label: 'Còn tiếp', value: '1' },
        { label: 'Tạm ngưng', value: '2' },
        { label: 'Không tạm ngưng', value: '5' },
      ],
    },
    host: {
      type: FilterTypes.Picker,
      label: 'Nguồn truyện',
      value: '',
      options: [
        { label: 'Tất cả', value: '' },
        { label: '[Vip] fanqie (Cà Chua)', value: 'fanqie' },
        { label: '[Vip] qidian (Khởi Điểm)', value: 'qidian' },
        { label: '[Vip] ciweimao', value: 'ciweimao' },
        { label: '[Vip] faloo (Phi Lư)', value: 'faloo' },
        { label: '[Vip] jjwxc (Tấn Giang)', value: 'jjwxc' },
        { label: '[Vip] sfacg', value: 'sfacg' },
        { label: '[Vip] zongheng (Tung Hoành)', value: 'zongheng' },
        { label: '[Free] 69shu', value: '69shu' },
        { label: '[Free] tadu', value: 'tadu' },
        { label: '[Free] qimao (7 Mèo)', value: 'qimao' },
        { label: '[Free] idejian', value: 'idejian' },
        { label: '[LN] linovel', value: 'linovel' },
        { label: '[LN] wenku8', value: 'wenku8' },
      ],
    },
    tag: {
      type: FilterTypes.CheckboxGroup,
      label: 'Nhãn',
      value: [],
      options: [
        { label: 'Đô Thị', value: 'dothi' },
        { label: 'Xuyên Qua', value: 'xuyenqua' },
        { label: 'Hệ Thống', value: 'hethong' },
        { label: 'Huyền Huyễn', value: 'huyenhuyen' },
        { label: 'Ngôn Tình', value: 'ngontinh' },
        { label: 'Đồng Nhân', value: 'dongnhan' },
        { label: 'Trùng Sinh', value: 'trungsinh' },
        { label: 'Lịch Sử', value: 'lichsu' },
        { label: 'Khoa Huyễn', value: 'khoahuyen' },
        { label: 'Tiên Hiệp', value: 'tienhiep' },
        { label: 'Võ Hiệp', value: 'vohiep' },
        { label: 'Sảng Văn', value: 'sangvan' },
        { label: 'Light Novel', value: 'lightnovel' },
        { label: 'Linh Dị', value: 'linhdi' },
        { label: 'Kỳ Huyễn', value: 'kyhuyen' },
        { label: 'Tận Thế', value: 'tanthe' },
        { label: 'Ngọt Sủng', value: 'ngotsung' },
        { label: 'Sân Trường', value: 'santruong' },
        { label: 'Nhiệt Huyết', value: 'nhiethuyet' },
        { label: 'Nhanh Xuyên', value: 'nhanhxuyen' },
      ],
    },
  } satisfies Filters;
}

export default new SangTacVietPlugin();
