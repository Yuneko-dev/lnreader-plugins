import { fetchText } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';
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

class JukaNovelPlugin implements Plugin.PluginBase {
  id = 'jukanovel';
  name = 'JukaNovel';
  icon = 'src/multi/jukanovel/icon.png';
  site = 'https://jukaza.site';
  version = '1.0.0';

  pluginSettings: Plugin.PluginSettings = {
    preferRaw: {
      value: false,
      label: 'Ưu tiên hiển thị nội dung gốc (Raw)',
      type: 'Switch',
    },
  };

  get preferRaw() {
    return storage.get('preferRaw') as boolean;
  }

  async popularNovels(
    pageNo: number,
    { filters }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];
    let url = `${this.site}/kham-pha?page=${pageNo}`;

    if (filters) {
      url += `&sort=${filters.sort.value}`;
      url += `&origin=${encodeURIComponent(filters.origin.value)}`;
      url += `&is_full=${filters.status.value}`;
      url += `&tags=${filters.tags.value.join(',')}`;
      url += `&exclude_tags=${filters.exclude_tags.value.join(',')}`;
    }

    const response = await fetchText(url);
    const $ = loadCheerio(response);
    this.checkLogin($);
    return this.parseNovels($);
  }
  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const response = await fetchText(`${this.site}${novelPath}`);
    const $ = loadCheerio(response);
    this.checkLogin($);
    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: $('h1').text().trim() || 'Untitled',
      cover: $('[class*="aspect"]').find('img').attr('src') || defaultCover,
      author:
        $('.text-sm.text-paper-muted.font-mono').text().trim() || 'Unknown',
      status: $('.flex-1')
        .find('div')
        .find('span')
        .text()
        .trim()
        .split('/')[0]
        .includes('Hoàn Thành')
        ? NovelStatus.Completed
        : NovelStatus.Ongoing,
      genres: $('.flex.flex-wrap')
        .find('a')
        .map((i, el) => $(el).text().trim())
        .get()
        .join(','),
      summary: $('#novel-description').text().trim(),
    };

    const chapters: Plugin.ChapterItem[] = [];

    $('#chapter-list-container li').each((i: number, el: any) => {
      const li = $(el);
      const a = li.find('a');
      const path = a.attr('href');
      const nameVi = a.find('span.font-medium').attr('data-vi');
      const status = a.find('div').find('span').find('span').text().trim();
      const chapterName = nameVi || a.find('span.font-medium').text().trim();
      const chapterNumber = li.attr('data-chapter');

      if (path) {
        chapters.push({
          name: `[${status}] ${chapterName}`,
          path: path.replace(this.site, ''),
          chapterNumber: chapterNumber ? parseInt(chapterNumber) : undefined,
        });
      }
    });

    novel.chapters = chapters;
    return novel;
  }
  async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
    const novel = await this.parseNovel(novelPath);
    return {
      chapters: novel.chapters || [],
    };
  }
  async parseChapter(chapterPath: string): Promise<string> {
    const response = await fetchText(`${this.site}${chapterPath}`);
    const $ = loadCheerio(response);
    this.checkLogin($);
    const scriptContent = $('script:contains("__READER_DATA__")').html() || '';
    const match = scriptContent.match(/window\.__READER_DATA__\s*=\s*(.*?});/);
    if (!match) return 'Không tìm thấy dữ liệu chương.';

    try {
      const readerData = JSON.parse(match[1]);
      const chapterContent = this.decryptJukaNovel(readerData);
      return chapterContent;
    } catch (e) {
      return 'Lỗi xử lý dữ liệu chương.';
    }
  }
  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const response = await fetchText(
      `${this.site}/kham-pha?q=${searchTerm}&page=${pageNo}`,
    );
    const $ = loadCheerio(response);
    this.checkLogin($);
    return this.parseNovels($);
  }

  decryptJukaNovel(readerData: any): string {
    const n = readerData.cipherKey || '';
    const chapter = readerData.chapter || {};

    if (!n || !chapter) return '';

    const contentCipher = (e: string) => {
      if (!e) return null;
      try {
        const r = decodeBase64ToBytes(e);
        const i = n.length;
        let a = '';
        for (let o = 0; o < r.length; o++) {
          a += String.fromCharCode(r[o] ^ n.charCodeAt(o % i));
        }
        return decodeBase64Utf8(a);
      } catch (error) {
        return null;
      }
    };

    let content: string | null = null;
    if (this.preferRaw) {
      content = contentCipher(chapter.raw_content);
    } else {
      content =
        contentCipher(chapter.published_content) ||
        contentCipher(chapter.translated_content) ||
        contentCipher(chapter.raw_content);
    }

    if (!content) return '';
    const notes: string[] = [];
    content = content.replace(
      /<span class="ann-marker"[^>]*>.*?<span class="ann-bubble">(.*?)<\/span><\/span>/gs,
      (match, noteContent) => {
        const noteId = notes.length + 1;
        notes.push(noteContent);
        return ` <span id="anchor-note-${noteId}" class="note-icon none-print inline note-tooltip" data-tooltip-content="#note${noteId} .note-content" data-note-id="note${noteId}"><i class="fas fa-sticky-note"></i></span><a class="inline-print none" href="#note${noteId}">[note]</a>`;
      },
    );
    if (
      content.indexOf('<p>') !== -1 ||
      content.indexOf('<img') !== -1 ||
      content.indexOf('<div') !== -1
    ) {
    } else {
      content = content
        .replace(/\t/g, '<br>')
        .split(/\n\n+/)
        .filter(block => block.trim())
        .map(block => {
          const lines = block.split('\n').filter(l => l.trim());
          return `<p>${lines.join('<br>')}</p>`;
        })
        .join('');
    }

    content = content
      .replace(/src="\/\//g, 'src="https://')
      .replace(
        /<p>\s*(\*\*\*|[=\-_*~]{7,}|---)\s*<\/p>/g,
        '<p style="text-align:center; text-indent:0">* * *</p>',
      );

    if (notes.length > 0) {
      content +=
        '<br><p style="text-align: center; font-weight: bold;">Ghi chú</p><br>';
      let notesHtml = '\n<div class="note-reg">';
      notes.forEach((note, index) => {
        const noteId = index + 1;
        notesHtml += `<div id="note${noteId}" class="none"><div class="note-content"><a href="#anchor-note-${noteId}">[^]</a> ${note}</div></div>`;
      });
      notesHtml += '</div>';
      content += notesHtml;
    }
    content = '<div>' + content + '</div>';
    return content;
  }

  filters = {
    sort: {
      type: FilterTypes.Picker,
      label: 'Sắp xếp',
      value: 'new_update',
      options: [
        { label: 'Mới Cập Nhật', value: 'new_update' },
        { label: 'Lượt Xem (Ngày)', value: 'view_day' },
        { label: 'Lượt Xem (Tuần)', value: 'view_week' },
        { label: 'Lượt Xem (Tháng)', value: 'view_month' },
        { label: 'Tổng Lượt Xem', value: 'view_total' },
        { label: 'Đánh Giá (Sao)', value: 'rating' },
        { label: 'Truyện Mới Đăng', value: 'new_novel' },
      ],
    },
    origin: {
      type: FilterTypes.Picker,
      label: 'Quốc Gia',
      value: 'Toàn bộ',
      options: [
        { label: 'Toàn bộ', value: 'Toàn bộ' },
        { label: 'Hàn Quốc', value: 'Hàn Quốc' },
        { label: 'Nhật Bản', value: 'Nhật Bản' },
      ],
    },
    status: {
      type: FilterTypes.Picker,
      label: 'Trình trạng dịch',
      value: '0',
      options: [
        { label: 'Toàn bộ', value: '0' },
        { label: 'Đã dịch FULL', value: '1' },
      ],
    },
    tags: {
      type: FilterTypes.CheckboxGroup,
      label: 'Thể Loại (Bao gồm)',
      value: [],
      options: [
        { label: 'Academy', value: 'Academy' },
        { label: 'Action', value: 'Action' },
        { label: 'Adventure', value: 'Adventure' },
        { label: 'Comedy', value: 'Comedy' },
        { label: 'Drama', value: 'Drama' },
        { label: 'Ecchi', value: 'Ecchi' },
        { label: 'Fantasy', value: 'Fantasy' },
        { label: 'Gender Bender', value: 'Gender Bender' },
        { label: 'Harem', value: 'Harem' },
        { label: 'Historical', value: 'Historical' },
        { label: 'Horror', value: 'Horror' },
        { label: 'Josei', value: 'Josei' },
        { label: 'Martial Arts', value: 'Martial Arts' },
        { label: 'Mature', value: 'Mature' },
        { label: 'Mecha', value: 'Mecha' },
        { label: 'Mystery', value: 'Mystery' },
        { label: 'Psychological', value: 'Psychological' },
        { label: 'Romance', value: 'Romance' },
        { label: 'School Life', value: 'School Life' },
        { label: 'Sci-fi', value: 'Sci-fi' },
        { label: 'Seinen', value: 'Seinen' },
        { label: 'Shoujo', value: 'Shoujo' },
        { label: 'Shoujo Ai', value: 'Shoujo Ai' },
        { label: 'Shounen', value: 'Shounen' },
        { label: 'Slice of Life', value: 'Slice of Life' },
        { label: 'Sports', value: 'Sports' },
        { label: 'Supernatural', value: 'Supernatural' },
        { label: 'Tragedy', value: 'Tragedy' },
        { label: 'Wuxia', value: 'Wuxia' },
        { label: 'Xianxia', value: 'Xianxia' },
        { label: 'Xuanhuan', value: 'Xuanhuan' },
        { label: 'Yuri', value: 'Yuri' },
      ],
    },
    exclude_tags: {
      type: FilterTypes.CheckboxGroup,
      label: 'Thể Loại (Loại trừ)',
      value: [],
      options: [
        { label: 'Academy', value: 'Academy' },
        { label: 'Action', value: 'Action' },
        { label: 'Adventure', value: 'Adventure' },
        { label: 'Comedy', value: 'Comedy' },
        { label: 'Drama', value: 'Drama' },
        { label: 'Ecchi', value: 'Ecchi' },
        { label: 'Fantasy', value: 'Fantasy' },
        { label: 'Gender Bender', value: 'Gender Bender' },
        { label: 'Harem', value: 'Harem' },
        { label: 'Historical', value: 'Historical' },
        { label: 'Horror', value: 'Horror' },
        { label: 'Josei', value: 'Josei' },
        { label: 'Martial Arts', value: 'Martial Arts' },
        { label: 'Mature', value: 'Mature' },
        { label: 'Mecha', value: 'Mecha' },
        { label: 'Mystery', value: 'Mystery' },
        { label: 'Psychological', value: 'Psychological' },
        { label: 'Romance', value: 'Romance' },
        { label: 'School Life', value: 'School Life' },
        { label: 'Sci-fi', value: 'Sci-fi' },
        { label: 'Seinen', value: 'Seinen' },
        { label: 'Shoujo', value: 'Shoujo' },
        { label: 'Shoujo Ai', value: 'Shoujo Ai' },
        { label: 'Shounen', value: 'Shounen' },
        { label: 'Slice of Life', value: 'Slice of Life' },
        { label: 'Sports', value: 'Sports' },
        { label: 'Supernatural', value: 'Supernatural' },
        { label: 'Tragedy', value: 'Tragedy' },
        { label: 'Wuxia', value: 'Wuxia' },
        { label: 'Xianxia', value: 'Xianxia' },
        { label: 'Xuanhuan', value: 'Xuanhuan' },
        { label: 'Yuri', value: 'Yuri' },
      ],
    },
  } satisfies Filters;

  checkLogin($: any): void {
    if ($('form[action*="/login"].space-y-5').length) {
      throw new Error('Vui lòng đăng nhập ở WebView rồi thử lại !');
    }
  }

  parseNovels($: any): Plugin.NovelItem[] {
    const novels: Plugin.NovelItem[] = [];
    $('.flex-1 a.group').each((i: number, el: any) => {
      const h3 = $(el).find('h3');
      const name = h3.text().trim();
      const path = $(el).attr('href');
      const cover = $(el).find('img').attr('src');

      if (name && path) {
        novels.push({
          name,
          path: path.replace(this.site, ''),
          cover: cover || defaultCover,
        });
      }
    });
    return novels;
  }
}

export default new JukaNovelPlugin();
