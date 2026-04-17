import { fetchApi } from '@libs/fetch';
import { load } from 'cheerio';
import { Plugin } from '@/types/plugin';
import { NovelStatus } from '@libs/novelStatus';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { storage } from '@libs/storage';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const decodeBase64ToBytes = (encoded: string): number[] => {
  const normalized = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s+/g, '');
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : normalized + '='.repeat(4 - (normalized.length % 4));
  const bytes: number[] = [];

  for (let i = 0; i < padded.length; i += 4) {
    const c1 = BASE64_ALPHABET.indexOf(padded.charAt(i));
    const c2 = BASE64_ALPHABET.indexOf(padded.charAt(i + 1));
    const c3Char = padded.charAt(i + 2);
    const c4Char = padded.charAt(i + 3);
    const c3 = c3Char === '=' ? 0 : BASE64_ALPHABET.indexOf(c3Char);
    const c4 = c4Char === '=' ? 0 : BASE64_ALPHABET.indexOf(c4Char);

    if (
      c1 < 0 ||
      c2 < 0 ||
      (c3Char !== '=' && c3 < 0) ||
      (c4Char !== '=' && c4 < 0)
    ) {
      continue;
    }

    const bitStream = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    bytes.push((bitStream >> 16) & 255);
    if (c3Char !== '=') {
      bytes.push((bitStream >> 8) & 255);
    }
    if (c4Char !== '=') {
      bytes.push(bitStream & 255);
    }
  }

  return bytes;
};

const utf8BytesToString = (bytes: number[]): string => {
  let out = '';
  let i = 0;

  while (i < bytes.length) {
    const c = bytes[i++];

    if (c < 128) {
      out += String.fromCharCode(c);
    } else if (c < 224) {
      out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
    } else if (c < 240) {
      out += String.fromCharCode(
        ((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63),
      );
    } else {
      let codePoint =
        ((c & 7) << 18) |
        ((bytes[i++] & 63) << 12) |
        ((bytes[i++] & 63) << 6) |
        (bytes[i++] & 63);
      codePoint -= 65536;
      out += String.fromCharCode(
        55296 + (codePoint >> 10),
        56320 + (codePoint & 1023),
      );
    }
  }

  return out;
};

const decodeBase64Utf8 = (encoded: string) =>
  utf8BytesToString(decodeBase64ToBytes(encoded));

const decodeXorChunk = (encoded: string, key: string): string => {
  const input = decodeBase64ToBytes(encoded);
  if (!key) {
    return utf8BytesToString(input);
  }

  const output: number[] = [];
  for (let i = 0; i < input.length; i++) {
    output.push(input[i] ^ key.charCodeAt(i % key.length));
  }
  return utf8BytesToString(output);
};

const parseProtectedChunks = (raw: string): string[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    // fallback to single-chunk payload
  }

  return [raw];
};

const decodeProtectedContent = (
  mode: string,
  key: string,
  chunks: string[],
): string => {
  if (!chunks.length) {
    return '';
  }

  const sortedChunks = [...chunks].sort((a, b) => {
    const ai = Number.parseInt(a.substring(0, 4), 10);
    const bi = Number.parseInt(b.substring(0, 4), 10);
    if (Number.isNaN(ai) || Number.isNaN(bi)) {
      return 0;
    }
    return ai - bi;
  });

  let content = '';

  for (const chunk of sortedChunks) {
    const payload = /^\d{4}/.test(chunk) ? chunk.substring(4) : chunk;

    if (mode === 'xor_shuffle') {
      content += decodeXorChunk(payload, key);
    } else if (mode === 'base64_reverse') {
      content += decodeBase64Utf8(payload.split('').reverse().join(''));
    } else {
      content += decodeBase64Utf8(payload);
    }
  }

  return content.replace(
    /\[note(\d+)]/gi,
    '<span id="anchor-note$1" class="note-icon none-print inline note-tooltip" data-tooltip-content="#note$1 .note-content" data-note-id="note$1"><i class="fas fa-sticky-note"></i></span><a id="anchor-note$1" class="inline-print none" href="#note$1">[note]</a>',
  );
};

const parseDmyToIso = (value: string): string | undefined => {
  const matched = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!matched) {
    return undefined;
  }

  const day = Number(matched[1]);
  const month = Number(matched[2]) - 1;
  const year = Number(matched[3]);
  const date = new Date(year, month, day);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

class HakoPlugin implements Plugin.PluginBase {
  id = 'ln.hako.vn';
  name = 'Hako Novel';
  icon = 'src/vi/hakolightnovel/icon.png';
  version = '1.1.39';

  pluginSettings = {
    usingDocln: {
      value: '',
      label: 'Sử dụng tên miền docln.sbs (nếu ln.hako.vn bị lỗi)',
      type: 'Switch',
    },
    showAllChapters: {
      value: '',
      label:
        'Hiển thị tất cả chương, không chia theo Volume. Tương thích với LNReader gốc.',
      type: 'Switch',
    },
    showChapterComments: {
      value: '',
      label: 'Hiển thị bình luận ở cuối mỗi chương (thử nghiệm)',
      type: 'Switch',
    },
  };

  get site() {
    return this.usingDocln ? 'https://docln.sbs' : 'https://ln.hako.vn';
  }

  get usingDocln() {
    return storage.get('usingDocln') as boolean;
  }

  get showAllChapters() {
    return storage.get('showAllChapters') as boolean;
  }

  get showChapterComments() {
    return storage.get('showChapterComments') as boolean;
  }

  private async fetchHtmlFromMirrors(
    path: string,
    validator?: (html: string) => boolean,
  ): Promise<string> {
    const res = await fetchApi(this.site + path);
    console.log(`Fetched ${this.site + path} - Status: ${res.status}`);
    const html = res.ok ? await res.text() : '';
    // Idk why hako returns 403 but fetchjs return 200???
    const $ = load(html);
    // Check class: error-page, error-name, error-note
    const errorPage = $('.error-page');
    const errorName = errorPage.find('.error-name')?.first()?.text()?.trim();
    const errorNote = errorPage.find('.error-note')?.first().text()?.trim();
    if (errorPage?.length || errorName?.length || errorNote?.length) {
      throw new Error(`Hako error: ${errorName} - ${errorNote}`);
    }
    if (html && (!validator || validator(html))) {
      return html;
    } else {
      throw new Error('Failed to fetch valid HTML from ' + this.site);
    }
  }

  async parseNovels(url: string) {
    const html = await fetchApi(url).then(res => res.text());
    const $ = load(html);
    const novels: Plugin.NovelItem[] = [];

    $('.thumb-item-flow').each((_, ele) => {
      const name = $(ele).find('.series-title a').attr('title') || '';
      const path = $(ele).find('.series-title a').attr('href') || '';
      const cover = $(ele).find('.img-in-ratio').attr('data-bg') || '';

      if (name && path) {
        novels.push({ name, path, cover });
      }
    });

    return novels;
  }
  async popularNovels(
    pageNo: number,
    { filters }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    let link = this.site + '/danh-sach';
    if (filters) {
      if (filters.alphabet.value) {
        link += '/' + filters.alphabet.value;
      }
      const params = new URLSearchParams();
      for (const novelType of filters.type.value) {
        params.append(novelType, '1');
      }
      for (const status of filters.status.value) {
        params.append(status, '1');
      }
      params.append('sapxep', filters.sort.value);
      link += '?' + params.toString() + '&page=' + pageNo;
    } else {
      link += '?page=' + pageNo;
    }
    return this.parseNovels(link);
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: '',
      author: '',
      artist: '',
      summary: '',
      genres: '',
      status: '',
    };
    const html = await this.fetchHtmlFromMirrors(
      novelPath,
      html => load(html)('.volume-list .list-chapters li').length > 0,
    );

    const $ = load(html);

    novel.name = $('.series-name').first().text().trim();
    novel.summary = $('.summary-content p')
      .map(function () {
        return $(this).text().trim();
      })
      .get()
      .join('\n');

    const coverEl = $('.series-cover .img-in-ratio').first();
    const coverDataBg = coverEl.attr('data-bg')?.trim();
    if (coverDataBg) {
      novel.cover = coverDataBg;
    } else {
      const style = coverEl.attr('style') || '';
      const matchedCover = style.match(/url\(['"]?(.*?)['"]?\)/i);
      if (matchedCover?.[1]) {
        novel.cover = matchedCover[1];
      }
    }

    novel.genres = $('.series-gernes .series-gerne-item')
      .map((_, element) => $(element).text().trim())
      .get()
      .filter(Boolean)
      .join(',');

    const infoItems = $('.series-information .info-item');
    novel.author = '';
    novel.artist = '';
    novel.status = '';

    infoItems.each((_, element) => {
      const item = $(element);
      const label = item.find('.info-name').first().text().toLowerCase().trim();
      const value = item
        .find('.info-value')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      if (!value) {
        return;
      }

      if (!novel.author && label.includes('tác giả')) {
        novel.author = value;
        return;
      }

      if (
        !novel.artist &&
        (label.includes('họa sĩ') ||
          label.includes('hoạ sĩ') ||
          label.includes('artist'))
      ) {
        novel.artist = value;
        return;
      }

      if (!novel.status && label.includes('tình trạng')) {
        novel.status = value;
      }
    });

    const parsedChapters: Plugin.ChapterItem[] = [];
    let num = 0;
    let part = 1;

    $('.volume-list').each((_, volumeElement) => {
      const volume = $(volumeElement)
        .find('.sect-title')
        .first()
        .text()
        .replace(/\*/g, '') // ?
        .replace(/\s+/g, ' ')
        .trim();

      $(volumeElement)
        .find('.list-chapters > li')
        .each((__, chapterElement) => {
          const chapterNode = $(chapterElement).find('.chapter-name a').first();
          const path = chapterNode.attr('href') || '';
          const name =
            chapterNode.attr('title')?.trim() ||
            chapterNode.text().replace(/\s+/g, ' ').trim();

          if (!path || !name) {
            return;
          }

          const matchedChapterNumber = name.match(
            /(?:chương|chapter)\s*(\d+(?:\.\d+)?)/i,
          );

          let chapterNumber = num + part / 10;
          if (matchedChapterNumber) {
            const parsedNumber = Number(matchedChapterNumber[1]);
            if (!Number.isNaN(parsedNumber) && parsedNumber > 0) {
              if (num === parsedNumber) {
                chapterNumber = num + part / 10;
                part += 1;
              } else {
                num = parsedNumber;
                part = 1;
                chapterNumber = parsedNumber;
              }
            }
          } else {
            part += 1;
          }

          const chapter: Plugin.ChapterItem = {
            path,
            name,
            page: volume,
            chapterNumber,
          };

          if (this.showAllChapters) {
            delete chapter.page;
            chapter.name = `[${volume}]: ${chapter.name}`;
          }

          const releaseTimeRaw = $(chapterElement)
            .find('.chapter-time')
            .first()
            .text();
          const releaseTime = parseDmyToIso(releaseTimeRaw);
          if (releaseTime) {
            chapter.releaseTime = releaseTime;
          }

          parsedChapters.push(chapter);
        });
    });

    novel.chapters = parsedChapters;
    switch (novel.status?.trim()) {
      case 'Đang tiến hành':
      case 'đang tiến hành':
        novel.status = NovelStatus.Ongoing;
        break;
      case 'Tạm ngưng':
      case 'tạm ngưng':
        novel.status = NovelStatus.OnHiatus;
        break;
      case 'Đã hoàn thành':
      case 'Hoàn thành':
      case 'đã hoàn thành':
      case 'hoàn thành':
      case 'Completed':
        novel.status = NovelStatus.Completed;
        break;
      default:
        novel.status = NovelStatus.Unknown;
    }
    novel.genres = novel.genres?.replace(/,*\s*$/, '');
    novel.name = novel.name.trim();
    novel.summary = novel.summary?.trim();

    console.log(novel);
    return novel;
  }
  async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
    const novel = await this.parseNovel(novelPath);
    return {
      chapters: novel.chapters || [],
    };
  }
  async parseChapter(chapterPath: string): Promise<string> {
    const html = await this.fetchHtmlFromMirrors(
      chapterPath,
      html => load(html)('div#chapter-content').length > 0,
    );

    const $ = load(html);
    const chapterContainer = $('div#chapter-content').first();

    if (!chapterContainer.length) {
      return 'Không tìm thấy nội dung';
    }

    const protectedContent = chapterContainer
      .find('#chapter-c-protected')
      .first();

    if (protectedContent.length) {
      const mode = protectedContent.attr('data-s') || '';
      const key = protectedContent.attr('data-k') || '';
      const chunks = parseProtectedChunks(
        protectedContent.attr('data-c') || '',
      );
      const decodedContent = decodeProtectedContent(mode, key, chunks);

      if (decodedContent.trim()) {
        protectedContent.replaceWith(decodedContent);
      } else {
        protectedContent.remove();
      }
    }

    $('a').each((_, el) => {
      // console.log('Processing link:', $(el).attr('href'), $(el).html());
      const href = $(el).attr('href');
      if (href && href.startsWith("/")) {
        if ($(el).attr('target')) {
          $(el).remove();
        } else {
          $(el).attr('href', '#skip-link');
        }
      }
    });

    chapterContainer
      .find(
        'p.none,script,style,iframe,[style*="display: none"],[style*="display:none"]',
      )
      .remove();

    const chapterText = (chapterContainer.html() || '')
      .replace(/<p id="\d+">/g, '<p>')
      // .replace(/\[note\d+]/gi, '')
      .replace(/&nbsp;/g, '')
      // .replace(/\[Lên trên\]/gi, '🔼')
      .trim();

    if (!chapterText) {
      return '';
    }

    if (this.showChapterComments) {
      // Comment
      const commentSection = $('#chapter-comments').first();
      // Báo cáo bình luận không phù hợp
      commentSection.find('#fbcmt_root > span').remove();
      // Bạn phải đăng nhập hoặc tạo tài khoản để bình luận
      commentSection.find('.ln-comment_sign-in').remove();
      // Comment form (login)
      commentSection
        .find('.ln-comment > header, .ln-comment > script')
        .remove();
      commentSection.find('#ln-comment-submit').remove();
      // Other buttons
      commentSection.find('.do-like').remove();
      commentSection.find('.do-reply').remove();
      commentSection.find('.my-auto').remove();
      commentSection.find('.fas.fa-chevron-down').remove();
      commentSection.find('.ln-comment-page').remove();
      commentSection.find('.comment_see_more').remove();

      // Remove loading svg
      commentSection.find('.loading').remove();

      return `<div>\n${chapterText}\n</div>\n${styleHtmlComment}\n${commentSection.prop('outerHTML')}`;
    } else {
      return `<div>\n${chapterText}\n</div>`;
    }
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const url =
      this.site + '/tim-kiem?keywords=' + searchTerm + '&page=' + pageNo;
    return this.parseNovels(url);
  }
  imageRequestInit: Plugin.ImageRequestInit = {
    headers: {
      Referer: this.site,
    },
  };
  filters = {
    alphabet: {
      type: FilterTypes.Picker,
      value: '',
      label: 'Chữ cái',
      options: [
        { label: 'Tất cả', value: '' },
        { label: 'Khác', value: 'khac' },
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
        { label: 'D', value: 'd' },
        { label: 'E', value: 'e' },
        { label: 'F', value: 'f' },
        { label: 'G', value: 'g' },
        { label: 'H', value: 'h' },
        { label: 'I', value: 'i' },
        { label: 'J', value: 'j' },
        { label: 'K', value: 'k' },
        { label: 'L', value: 'l' },
        { label: 'M', value: 'm' },
        { label: 'N', value: 'n' },
        { label: 'O', value: 'o' },
        { label: 'P', value: 'p' },
        { label: 'Q', value: 'q' },
        { label: 'R', value: 'r' },
        { label: 'S', value: 's' },
        { label: 'T', value: 't' },
        { label: 'U', value: 'u' },
        { label: 'V', value: 'v' },
        { label: 'W', value: 'w' },
        { label: 'X', value: 'x' },
        { label: 'Y', value: 'y' },
        { label: 'Z', value: 'z' },
      ],
    },
    type: {
      type: FilterTypes.CheckboxGroup,
      label: 'Phân loại',
      value: [],
      options: [
        { label: 'Truyện dịch', value: 'truyendich' },
        { label: 'Truyện sáng tác', value: 'sangtac' },
        { label: 'Truyện AI dịch (Convert)', value: 'convert' },
      ],
    },
    status: {
      type: FilterTypes.CheckboxGroup,
      label: 'Tình trạng',
      value: [],
      options: [
        { label: 'Đang tiến hành', value: 'dangtienhanh' },
        { label: 'Tạm ngưng', value: 'tamngung' },
        { label: 'Đã hoàn thành', value: 'hoanthanh' },
      ],
    },
    sort: {
      type: FilterTypes.Picker,
      label: 'Sắp xếp',
      value: 'topthang',
      options: [
        { label: 'A-Z', value: 'tentruyen' },
        { label: 'Z-A', value: 'tentruyenza' },
        { label: 'Mới cập nhật', value: 'capnhat' },
        { label: 'Truyện mới', value: 'truyenmoi' },
        { label: 'Theo dõi', value: 'theodoi' },
        { label: 'Top toàn thời gian', value: 'top' },
        { label: 'Top tháng', value: 'topthang' },
        { label: 'Số từ', value: 'sotu' },
      ],
    },
  } satisfies Filters;
}

export default new HakoPlugin();

const styleHtmlComment = String.raw`<style>
  /*! CSS Used from: https://docln.sbs/css/interface.css?id=70c0734ea97768947523088b73fef963 */
  *,
  :after,
  :before {
    box-sizing: border-box;
  }
  header,
  main,
  section {
    display: block;
  }
  h3 {
    margin-bottom: 0.5rem;
    margin-top: 0;
  }
  a {
    color: #007bff;
  }
  a:hover {
    color: #0056b3;
    text-decoration: underline;
  }
  img {
    border-style: none;
  }
  img {
    vertical-align: middle;
  }
  .align-top {
    vertical-align: top !important;
  }
  .align-middle {
    vertical-align: middle !important;
  }
  .align-bottom {
    vertical-align: bottom !important;
  }
  .rounded-sm {
    border-radius: 0.2rem !important;
  }
  .flex-wrap {
    flex-wrap: wrap !important;
  }
  .my-1 {
    margin-top: 0.25rem !important;
  }
  .mx-1 {
    margin-right: 0.25rem !important;
  }
  .my-1 {
    margin-bottom: 0.25rem !important;
  }
  .mx-1 {
    margin-left: 0.25rem !important;
  }
  .mt-3 {
    margin-top: 0.75rem !important;
  }
  .pt-0 {
    padding-top: 0 !important;
  }
  .pt-1 {
    padding-top: 0.25rem !important;
  }
  .pb-1 {
    padding-bottom: 0.25rem !important;
  }
  .px-2 {
    padding-right: 0.5rem !important;
  }
  .px-2 {
    padding-left: 0.5rem !important;
  }
  .my-auto {
    margin-top: auto !important;
  }
  .my-auto {
    margin-bottom: auto !important;
  }
  .clear:after,
  .clear:before {
    content: ' ';
    display: table;
  }
  .clear:after {
    clear: both;
  }
  a {
    -webkit-text-decoration-skip: objects;
    background-color: transparent;
    color: inherit;
    text-decoration: none;
  }
  a:hover {
    color: #10b18e;
    outline-width: 0;
    text-decoration: none;
  }
  h3 {
    font-size: 22px;
    font-size: 1.375rem;
    line-height: 30px;
    line-height: 1.875rem;
    margin: 0;
  }
  .basic-section .sect-title {
    font-size: 18px;
    font-size: 1.125rem;
    line-height: 26px;
    line-height: 1.625rem;
  }
  h3 {
    color: #333;
    font-weight: 700;
    margin-bottom: 0.2em;
  }
  .flex {
    display: flex;
  }
  .flex-wrap {
    flex-wrap: wrap;
  }
  .long-text a:hover {
    color: #08c !important;
    text-decoration: underline;
  }
  .long-text a {
    color: #0095df;
    cursor: pointer;
  }
  .basic-section {
    background-color: hsla(0, 0%, 100%, 0.9);
    border-color: #e4e5e7 #dadbdd hsla(214, 4%, 80%, 0.8);
    border-radius: 4px;
    border-style: solid;
    border-width: 1px;
    overflow: hidden;
  }
  .basic-section .sect-header {
    background-color: #f4f5f6;
    border-bottom: 1px solid #dadbdd;
    padding: 10px;
  }
  .basic-section {
    margin-bottom: 20px;
  }
  .basic-section .sect-header {
    font-weight: 700;
  }
  .basic-section .sect-title {
    display: inline-block;
    margin-left: 0;
    padding-right: 0;
  }
  section.basic-section main {
    padding: 10px;
  }
  @media only screen and (max-width: 999px) {
    .basic-section .sect-title {
      font-size: 16px;
      font-size: 1rem;
      line-height: 22px;
      line-height: 1.375rem;
    }
  }
  #chapter-comments .tab-list .sect-title {
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-weight: 700;
    margin-right: 10px;
    color: #111111;
    transition: 0.25s;
    -webkit-transition: 0.25s;
    -moz-transition: 0.25s;
    -o-transition: 0.25s;
  }
  .ln-comment header {
    padding: 0 10px;
  }
  .ln-comment .ln-comment-body {
    border-radius: 4px;
    padding: 10px;
    color: #111111;
  }
  .ln-comment-reply {
    margin-left: 50px;
  }
  .ln-comment-reply .ln-comment-item:last-child {
    padding-bottom: 0;
  }
  .ln-comment-item {
    position: relative;
  }
  .ln-comment-item.deleted {
    font-size: 14px;
    font-size: 0.875rem;
    line-height: 20px;
    line-height: 1.25rem;
  }
  .ln-comment-item.deleted .ln-comment-content {
    margin: 0;
    padding: 0;
  }
  .disabled {
    cursor: not-allowed;
    opacity: 0.5;
    pointer-events: none;
  }
  .ln-comment-content {
    word-wrap: break-word;
    margin-bottom: 10px;
  }
  .fetch_reply {
    cursor: pointer;
    display: inline-block;
    font-weight: 700;
    margin-top: 10px;
  }
  @media only screen and (max-width: 787px) {
    .ln-comment-item {
      font-size: 13px;
      font-size: 0.8125rem;
      line-height: 19px;
      line-height: 1.1875rem;
    }
    .ln-comment-content {
      padding-right: 0;
    }
    .ln-comment-reply {
      margin-left: 0;
    }
    .ln-comment-reply .ln-comment-item {
      padding-left: 40px;
    }
    .fetch_reply {
      font-size: 13px;
      font-size: 0.8125rem;
      line-height: 19px;
      line-height: 1.1875rem;
      margin-left: 40px;
    }
  }
  /*! CSS Used from: https://docln.sbs/css/tailwind.css?id=8382c63ca8598a8d4b529d17a613c1c0 */
  *,
  :after,
  :before {
    border: 0 solid #e5e7eb;
    box-sizing: border-box;
  }
  :after,
  :before {
    --tw-content: '';
  }
  h3 {
    font-size: inherit;
    font-weight: inherit;
  }
  .none {
    /* hard code for note */
    color: #007bff;
  }
  h3 {
    margin: 0;
  }
  :disabled {
    cursor: default;
  }
  img {
    display: block;
    vertical-align: middle;
  }
  img {
    height: auto;
    max-width: 100%;
  }
  *,
  :after,
  :before {
    --tw-border-spacing-x: 0;
    --tw-border-spacing-y: 0;
    --tw-translate-x: 0;
    --tw-translate-y: 0;
    --tw-rotate: 0;
    --tw-skew-x: 0;
    --tw-skew-y: 0;
    --tw-scale-x: 1;
    --tw-scale-y: 1;
    --tw-scroll-snap-strictness: proximity;
    --tw-ring-offset-width: 0px;
    --tw-ring-offset-color: #fff;
    --tw-ring-color: rgba(59, 130, 246, 0.5);
    --tw-ring-offset-shadow: 0 0 #0000;
    --tw-ring-shadow: 0 0 #0000;
    --tw-shadow: 0 0 #0000;
    --tw-shadow-colored: 0 0 #0000;
  }
  .mx-1 {
    margin-left: 0.25rem;
    margin-right: 0.25rem;
  }
  .my-1 {
    margin-bottom: 0.25rem;
    margin-top: 0.25rem;
  }
  .my-auto {
    margin-bottom: auto;
    margin-top: auto;
  }
  .me-1 {
    margin-inline-end: 0.25rem;
  }
  .mt-3 {
    margin-top: 0.75rem;
  }
  .flex {
    display: flex;
  }
  .h-\[14px\] {
    height: 14px;
  }
  .w-\[50px\] {
    width: 50px;
  }
  .w-full {
    width: 100%;
  }
  .min-w-0 {
    min-width: 0;
  }
  .max-w-full {
    max-width: 100%;
  }
  .cursor-pointer {
    cursor: pointer;
  }
  .flex-col {
    flex-direction: column;
  }
  .flex-wrap {
    flex-wrap: wrap;
  }
  .justify-between {
    justify-content: space-between;
  }
  .gap-1 {
    gap: 0.25rem;
  }
  .gap-2 {
    gap: 0.5rem;
  }
  .gap-x-2 {
    -moz-column-gap: 0.5rem;
    column-gap: 0.5rem;
  }
  .gap-y-1 {
    row-gap: 0.25rem;
  }
  .self-center {
    align-self: center;
  }
  .rounded-full {
    border-radius: 9999px;
  }
  .rounded-md {
    border-radius: 0.375rem;
  }
  .rounded-sm {
    border-radius: 0.125rem;
  }
  .bg-\[\#49d0b2\]\/50 {
    background-color: rgba(73, 208, 178, 0.5);
  }
  .bg-\[\#e3953e\]\/50 {
    background-color: rgba(227, 149, 62, 0.5);
  }
  .bg-gray-100 {
    --tw-bg-opacity: 1;
    background-color: rgb(243 244 246 / var(--tw-bg-opacity));
  }
  .px-1\.5 {
    padding-left: 0.375rem;
    padding-right: 0.375rem;
  }
  .px-2 {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
  .py-0\.5 {
    padding-bottom: 0.125rem;
    padding-top: 0.125rem;
  }
  .pb-1 {
    padding-bottom: 0.25rem;
  }
  .pe-0 {
    padding-inline-end: 0;
  }
  .ps-1 {
    padding-inline-start: 0.25rem;
  }
  .pt-0 {
    padding-top: 0;
  }
  .pt-1 {
    padding-top: 0.25rem;
  }
  .align-top {
    vertical-align: top;
  }
  .align-middle {
    vertical-align: middle;
  }
  .align-bottom {
    vertical-align: bottom;
  }
  .text-\[10px\] {
    font-size: 10px;
  }
  .text-\[13px\] {
    font-size: 13px;
  }
  .text-lg {
    font-size: 1.125rem;
    line-height: 1.75rem;
  }
  .font-bold {
    font-weight: 700;
  }
  .font-semibold {
    font-weight: 600;
  }
  .leading-4 {
    line-height: 1rem;
  }
  .leading-6 {
    line-height: 1.5rem;
  }
  .text-\[\#36a189\] {
    --tw-text-opacity: 1;
    color: rgb(54 161 137 / var(--tw-text-opacity));
  }
  .text-\[\#9c662a\] {
    --tw-text-opacity: 1;
    color: rgb(156 102 42 / var(--tw-text-opacity));
  }
  .text-\[\#E63950\] {
    --tw-text-opacity: 1;
    color: rgb(230 57 80 / var(--tw-text-opacity));
  }
  .text-slate-500 {
    --tw-text-opacity: 1;
    color: rgb(100 116 139 / var(--tw-text-opacity));
  }
  .shadow-\[inset_0px_0px_0px_2px_\#E63950\] {
    --tw-shadow: inset 0px 0px 0px 2px #e63950;
    --tw-shadow-colored: inset 0px 0px 0px 2px var(--tw-shadow-color);
  }
  .shadow-\[inset_0px_0px_0px_2px_\#E63950\] {
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000),
      var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
  }
  @media (min-width: 768px) {
    .md\:leading-7 {
      line-height: 1.75rem;
    }
  }
  /*! CSS Used from: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.9.0/css/all.min.css */
  .fas {
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
    display: inline-block;
    font-style: normal;
    font-variant: normal;
    text-rendering: auto;
    line-height: 1;
  }
  .fa-chevron-down:before {
    content: '\f078';
  }
  .fa-thumbs-up:before {
    content: '\f164';
  }
  .fas {
    font-weight: 900;
  }
</style>`;
