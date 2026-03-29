import { fetchApi } from '@libs/fetch';
import { Parser } from 'htmlparser2';
import { Plugin } from '@/types/plugin';
import { NovelStatus } from '@libs/novelStatus';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';

const HAKO_MIRRORS = ['https://ln.hako.vn', 'https://docln.sbs'] as const;

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

    if (c1 < 0 || c2 < 0 || (c3Char !== '=' && c3 < 0) || (c4Char !== '=' && c4 < 0)) {
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

class HakoPlugin implements Plugin.PagePlugin {
  // change id
  id = 'ln.hako.vn';
  name = 'Hako Novel';
  icon = 'src/vi/hakolightnovel/icon.png';
  site = 'https://ln.hako.vn';
  version = '1.1.4';

  private fetchHtmlFromMirrors(
    path: string,
    validator?: (html: string) => boolean,
  ): Promise<string> {
    const hosts = [this.site, ...HAKO_MIRRORS.filter(host => host !== this.site)];
    let fallbackHtml = '';

    const tryHost = (index: number): Promise<string> => {
      if (index >= hosts.length) {
        return Promise.resolve(fallbackHtml);
      }

      return fetchApi(hosts[index] + path)
        .then(res => (res.ok ? res.text() : ''))
        .catch(() => '')
        .then(html => {
          if (html && !fallbackHtml) {
            fallbackHtml = html;
          }

          if (html && (!validator || validator(html))) {
            return html;
          }

          return tryHost(index + 1);
        });
    };

    return tryHost(0);
  }

  parseNovels(url: string) {
    return fetchApi(url)
      .then(res => res.text())
      .then(html => {
        const novels: Plugin.NovelItem[] = [];
        let tempNovel = {} as Plugin.NovelItem;
        let isGettingUrl = false;
        let isParsingNovel = false;
        const parser = new Parser({
          onopentag(name, attribs) {
            if (attribs['class']?.includes('thumb-item-flow')) {
              isParsingNovel = true;
            }
            if (isParsingNovel) {
              if (attribs['class']?.includes('series-title')) {
                isGettingUrl = true;
              }
              if (attribs['class']?.includes('img-in-ratio')) {
                tempNovel.cover = attribs['data-bg'];
              }
              if (isGettingUrl && name === 'a') {
                tempNovel.name = attribs['title'];
                tempNovel.path = attribs['href'];
                novels.push(tempNovel);
                tempNovel = {} as Plugin.NovelItem; // re-assign new reference
                isGettingUrl = false;
                isParsingNovel = false;
              }
            }
          },
        });
        parser.write(html);
        parser.end();
        return novels;
      });
  }
  popularNovels(
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

  parseNovel(
    novelPath: string,
  ): Promise<Plugin.SourceNovel & { totalPages: number }> {
    const novel: Plugin.SourceNovel & { totalPages: number } = {
      path: novelPath,
      name: '',
      author: '',
      artist: '',
      summary: '',
      genres: '',
      status: '',
      totalPages: 1,
    };
    return this.fetchHtmlFromMirrors(
      novelPath,
      html => loadCheerio(html)('.volume-list .list-chapters li').length > 0,
    )
      .then(html => {
        const $ = loadCheerio(html);

        novel.name = $('.series-name').first().text().trim();
        novel.summary =
          $('.summary-content').first().text().replace(/\s+\n/g, '\n').trim() ||
          '';

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
          const label = item
            .find('.info-name')
            .first()
            .text()
            .toLowerCase()
            .trim();
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
        return novel;
      });
  }
  async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
    if (page !== '1') {
      return { chapters: [] };
    }

    const novel = await this.parseNovel(novelPath);
    return {
      chapters: novel.chapters || [],
    };
  }
  parseChapter(chapterPath: string): Promise<string> {
    return this.fetchHtmlFromMirrors(
      chapterPath,
      html => loadCheerio(html)('div#chapter-content').length > 0,
    )
      .then(html => {
        const $ = loadCheerio(html);
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

        chapterContainer.find('p.none,script,style,iframe').remove();

        const chapterText = (chapterContainer.html() || '')
          .replace(/<p id="\d+">/g, '<p>')
          .replace(/\[note\d+]/gi, '')
          .replace(/&nbsp;/g, '');

        return chapterText || 'Không tìm thấy nội dung';
      });
  }
  searchNovels(
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
        { label: 'Convert', value: 'convert' },
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
      value: 'top',
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
