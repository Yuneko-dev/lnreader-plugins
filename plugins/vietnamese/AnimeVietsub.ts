import { fetchText } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';
import { encodeHtmlEntities } from '@libs/utils';
import { storage } from '@libs/storage';

const SITE = 'https://animevietsub.site';

class AnimeVietsubPlugin implements Plugin.PluginBase {
  id = 'animevietsub';
  name = 'AnimeVietsub';
  icon = 'src/vi/animevietsub/icon.png';
  site = SITE;
  version = '1.0.9';

  customJS = 'src/vi/animevietsub/player.js';

  pluginSettings: Plugin.PluginSettings = {
    enableEmbed: {
      value: false,
      label: 'Bật embed',
      type: 'Switch',
    },
  };

  get enableEmbed() {
    return storage.get('enableEmbed') as boolean;
  }

  imageRequestInit: Plugin.ImageRequestInit = {
    headers: {
      Referer: SITE + '/',
    },
  };

  filters = {
    category: {
      type: FilterTypes.Picker,
      label: 'Thể loại',
      value: 'all',
      options: [
        { label: 'Tất cả', value: 'all' },
        { label: 'Anime lẻ (Movie/OVA)', value: 'list-le' },
        { label: 'Anime bộ (TV-Series)', value: 'list-bo' },
        { label: 'Anime Trọn Bộ', value: 'list-tron-bo' },
        { label: 'Anime Đang Chiếu', value: 'list-dang-chieu' },
        { label: 'Anime Sắp Chiếu', value: 'list-sap-chieu' },
      ],
    },
    genre: {
      type: FilterTypes.CheckboxGroup,
      label: 'Thể loại',
      value: [],
      options: [
        {
          label: 'Action',
          value: '1',
        },
        {
          label: 'Adventure',
          value: '2',
        },
        {
          label: 'Boys Love',
          value: '46',
        },
        {
          label: 'Cartoon',
          value: '44',
        },
        {
          label: 'Cổ Trang',
          value: '47',
        },
        {
          label: 'Comedy',
          value: '3',
        },
        {
          label: 'Dementia',
          value: '4',
        },
        {
          label: 'Demons',
          value: '5',
        },
        {
          label: 'Drama',
          value: '6',
        },
        {
          label: 'Ecchi',
          value: '7',
        },
        {
          label: 'Fantasy',
          value: '8',
        },
        {
          label: 'Game',
          value: '9',
        },
        {
          label: 'Harem',
          value: '10',
        },
        {
          label: 'Historical',
          value: '11',
        },
        {
          label: 'Horror',
          value: '12',
        },
        {
          label: 'Josei',
          value: '13',
        },
        {
          label: 'Kids',
          value: '14',
        },
        {
          label: 'Live Action',
          value: '43',
        },
        {
          label: 'Magic',
          value: '15',
        },
        {
          label: 'Martial Arts',
          value: '16',
        },
        {
          label: 'Mecha',
          value: '17',
        },
        {
          label: 'Military',
          value: '18',
        },
        {
          label: 'Music',
          value: '19',
        },
        {
          label: 'Mystery',
          value: '20',
        },
        {
          label: 'Parody',
          value: '21',
        },
        {
          label: 'Police',
          value: '22',
        },
        {
          label: 'Psychological',
          value: '23',
        },
        {
          label: 'Romance',
          value: '24',
        },
        {
          label: 'Samurai',
          value: '25',
        },
        {
          label: 'School',
          value: '26',
        },
        {
          label: 'Sci-Fi',
          value: '27',
        },
        {
          label: 'Seinen',
          value: '28',
        },
        {
          label: 'Shoujo',
          value: '29',
        },
        {
          label: 'Shoujo Ai',
          value: '30',
        },
        {
          label: 'Shounen',
          value: '31',
        },
        {
          label: 'Shounen Ai',
          value: '32',
        },
        {
          label: 'Slice of Life',
          value: '33',
        },
        {
          label: 'Space',
          value: '34',
        },
        {
          label: 'Sports',
          value: '35',
        },
        {
          label: 'Super Power',
          value: '36',
        },
        {
          label: 'Supernatural',
          value: '37',
        },
        {
          label: 'Suspense',
          value: '45',
        },
        {
          label: 'Thriller',
          value: '38',
        },
        {
          label: 'Tokusatsu',
          value: '42',
        },
        {
          label: 'Vampire',
          value: '39',
        },
        {
          label: 'Yaoi',
          value: '40',
        },
        {
          label: 'Yuri',
          value: '41',
        },
      ],
    },
    season: {
      type: FilterTypes.Picker,
      label: 'Season - Mùa',
      value: 'all',
      options: [
        { label: 'Tất cả', value: 'all' },
        { label: 'Mùa Đông', value: 'winter' },
        { label: 'Mùa Xuân', value: 'spring' },
        { label: 'Mùa Hạ', value: 'summer' },
        { label: 'Mùa Thu', value: 'autumn' },
      ],
    },
    year: {
      type: FilterTypes.Picker,
      label: 'Năm phát hành',
      value: 'all',
      options: [
        { label: 'Tất cả', value: 'all' },
        { label: '2026', value: '2026' },
        { label: '2025', value: '2025' },
        { label: '2024', value: '2024' },
        { label: '2023', value: '2023' },
        { label: '2022', value: '2022' },
        { label: '2021', value: '2021' },
        { label: '2020', value: '2020' },
        { label: '2019', value: '2019' },
        { label: '2018', value: '2018' },
        { label: '2017', value: '2017' },
        { label: '2016', value: '2016' },
        { label: '2015', value: '2015' },
        { label: '2014', value: '2014' },
        { label: '2013', value: '2013' },
        { label: 'Cũ hơn', value: 'older-2013' },
      ],
    },
    ageRating: {
      type: FilterTypes.Picker,
      label: 'Phân loại độ tuổi',
      value: 'all',
      options: [
        { label: 'Tất cả', value: 'all' },
        {
          label: '13+ - Teens 13 or older (3)',
          value: '13+ - Teens 13 or older',
        },
        { label: 'G - Mọi lứa tuổi (235)', value: 'G - Mọi lứa tuổi' },
        { label: 'None (689)', value: 'None' },
        { label: 'PG - Trẻ em (205)', value: 'PG - Trẻ em' },
        {
          label: 'PG-13 - Teens 13 tuổi trở lên (3540)',
          value: 'PG-13 - Teens 13 tuổi trở lên',
        },
        {
          label: 'R - 17+ (bạo lực và tục tĩu) (658)',
          value: 'R - 17+ (bạo lực và tục tĩu)',
        },
        {
          label: 'R+ - Dành cho 16 tuổi trở lên (380)',
          value: 'R+ - Dành cho 16 tuổi trở lên',
        },
        {
          label: 'R+ - Dành cho 17 tuổi trở lên (5)',
          value: 'R+ - Dành cho 17 tuổi trở lên',
        },
      ],
    },
    country: {
      type: FilterTypes.Picker,
      label: 'Quốc gia',
      value: 'all',
      options: [
        { label: 'Tất cả', value: 'all' },
        { label: 'Nhật Bản', value: 'jp' },
        { label: 'Trung Quốc', value: 'cn' },
        { label: 'Mỹ', value: 'us' },
        { label: 'Hàn Quốc', value: 'kr' },
        { label: 'Việt Nam', value: 'vietnam' },
        { label: 'Đài Loan', value: 'tw' },
      ],
    },
    sort: {
      type: FilterTypes.Picker,
      label: 'Sắp xếp',
      value: 'latest',
      options: [
        { label: 'Mới nhất', value: 'latest' },
        { label: 'Tên A-Z', value: 'nameaz' },
        { label: 'Tên Z-A', value: 'nameza' },
        { label: 'Xem nhiều nhất', value: 'view' },
        { label: 'Nhiều lượt bình chọn', value: 'rating' },
      ],
    },
  } satisfies Filters;

  // ---------- helpers ----------

  private absolutePath(href: string): string {
    if (!href) return '';
    try {
      const u = new URL(href, SITE);
      if (u.origin === SITE) return u.pathname + u.search;
      return href;
    } catch {
      return href;
    }
  }

  private checkCommonBlocked($: ReturnType<typeof loadCheerio>): void {
    if ($('.verification-status, #challenge-error-text').length > 0) {
      throw new Error(
        'Đã bị chặn bởi Cloudflare JS Challenge. Mở trang web trong WebView để xác minh.',
      );
    }
    if ($('.verification-section, .captcha-placeholder').length > 0) {
      throw new Error(
        'Đã bị chặn bởi Cloudflare Turnstile. Mở trang web trong WebView để xác minh.',
      );
    }
    if ($('.map-title, .map-notice-caution, #verify-form').length > 0) {
      throw new Error(
        'Bạn đang sử dụng VPN hoặc Proxy. Mở trang web trong WebView, trả lời câu hỏi xác minh rồi thử lại.',
      );
    }
  }

  private parseListHtml(html: string): Plugin.NovelItem[] {
    const novels: Plugin.NovelItem[] = [];
    const $ = loadCheerio(html);
    this.checkCommonBlocked($);
    const seen = new Set<string>();

    $('.TPostMv').each((_, el) => {
      const $el = $(el);
      const $a = $el.find('article a').first();
      const href = $a.attr('href') || '';
      if (!href || !/\/phim\//.test(href)) return;
      const path = this.absolutePath(href);
      if (seen.has(path)) return;
      seen.add(path);
      const name =
        $el.find('h2.Title').first().text().trim() ||
        $el.find('.TPMvCn .Title').first().text().trim() ||
        $a.attr('title') ||
        '';
      const cover =
        $el.find('img').first().attr('src') ||
        $el.find('img').first().attr('data-src') ||
        defaultCover;
      if (name) {
        novels.push({ name, path, cover });
      }
    });

    if (novels.length === 0) {
      $('.e-item, .row-display').each((_, el) => {
        const $el = $(el);
        const $a = $el.find('a.thumb, h3.title-item a, a').first();
        const href = $a.attr('href') || '';
        if (!href || !/\/phim\//.test(href)) return;
        const path = this.absolutePath(href);
        if (seen.has(path)) return;
        seen.add(path);
        const name =
          $el.find('h3.title-item').text().trim() || $a.attr('title') || '';
        const cover = $el.find('img').first().attr('src') || defaultCover;
        if (name) {
          novels.push({ name, path, cover });
        }
      });
    }

    return novels;
  }

  // ---------- popularNovels ----------

  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    // Build filters into URL parameters
    const category = filters.category.value || 'all';
    const genreList =
      filters.genre.value.length > 0 ? filters.genre.value.join('-') : 'all';
    const season = filters.season.value || 'all';
    const year = filters.year.value || 'all';
    const studio = 'all'; // Not implemented in filters
    const age = encodeURIComponent(filters.ageRating.value || 'all');
    const country = filters.country.value || 'all';
    const page = pageNo > 1 ? `trang-${pageNo}.html` : '';
    const url = new URL(
      `${SITE}/danh-sach/${category}/${genreList}/${season}/${year}/${studio}/${age}/${country}/${page}`,
    );
    url.searchParams.set('sort', filters.sort.value || 'latest');
    // Build URL
    // https://animevietsub.bz/danh-sach/category/genre_list/season/year/studio/age/country?sort=?
    const html = await fetchText(url.toString());
    if (html.includes('<title></title><div></div>')) {
      throw new Error(
        'Không tải được danh sách Anime. Hãy thử lại sau ít giây nữa.',
      );
    }
    return this.parseListHtml(html);
  }

  // ---------- searchNovels ----------

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const term = encodeURIComponent(searchTerm.trim());
    const url =
      pageNo <= 1
        ? `${SITE}/tim-kiem/${term}/F`
        : `${SITE}/tim-kiem/${term}/trang-${pageNo}.html`;
    const html = await fetchText(url);
    return this.parseListHtml(html);
  }

  // ---------- parseNovel ----------

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const url = SITE + novelPath;
    const html = await fetchText(url);
    const $ = loadCheerio(html);
    this.checkCommonBlocked($);
    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name:
        $('header.Container h1.Title').first().text().trim() ||
        $('h1.Title').first().text().trim() ||
        $('meta[property="og:title"]').attr('content') ||
        '',
      cover:
        $('meta[property="og:image"]').attr('content') ||
        $('.TPostBg img').attr('src') ||
        $('.Image img').attr('src') ||
        defaultCover,
      summary:
        $('.Description').text().trim() ||
        $('meta[property="og:description"]').attr('content') ||
        '',
    };

    const genres: string[] = [];
    $('.InfoList a[href*="/the-loai/"]').each((_, el) => {
      const t = $(el).text().trim();
      if (t) genres.push(t);
    });
    if (genres.length) novel.genres = genres.join(', ');

    $('.InfoList li').each((_, li) => {
      const label = $(li).find('strong').text().trim();
      if (/Đạo diễn/i.test(label)) {
        const author = $(li)
          .text()
          .replace(/Đạo diễn:?/i, '')
          .trim();
        if (author) novel.author = author;
      }
      if (/Trạng thái/i.test(label)) {
        const st = $(li)
          .text()
          .replace(/Trạng thái:?/i, '')
          .trim()
          .toLowerCase();
        if (/full|hoàn|complete/.test(st)) novel.status = NovelStatus.Completed;
        else if (/đang|tập/.test(st)) novel.status = NovelStatus.Ongoing;
        else novel.status = NovelStatus.Unknown;
      }
    });

    // Chapter list: detail page only shows latest 3 in "Tập mới".
    // To get the full episode list (server "AnimeVsub") we visit the
    // latest episode page and parse the list-server section.
    const latestEpHref = $('.InfoList li.latest_eps a').first().attr('href');
    if (latestEpHref) {
      try {
        const epPageUrl = latestEpHref.startsWith('http')
          ? latestEpHref
          : SITE + latestEpHref;
        const epHtml = await fetchText(epPageUrl);
        novel.chapters = this.parseEpisodeList(epHtml);
      } catch (e) {
        console.warn('AnimeVietsub: cannot fetch episode list page', e);
      }
    }

    return novel;
  }

  private parseEpisodeList(html: string): Plugin.ChapterItem[] {
    const $ = loadCheerio(html);
    this.checkCommonBlocked($);
    const chapters: Plugin.ChapterItem[] = [];

    const seen = new Set<string>();
    $('#list-server .server-group').each((_, el) => {
      const $group = $(el);
      const name = $group.find('.server-name').text().trim();
      $group
        .find('ul.list-episode li.episode a.btn-episode')
        .each((idx, el) => {
          const $a = $(el);
          const href = $a.attr('href') || '';
          if (!href) return;
          const path = this.absolutePath(href);
          if (seen.has(path)) return;
          seen.add(path);
          const epLabel = $a.attr('title')?.trim() || `Tập ${$a.text().trim()}`;
          const num = parseFloat($a.text().replace(/[^0-9.]/g, ''));
          chapters.push({
            name: epLabel,
            path,
            chapterNumber: Number.isFinite(num) ? num : idx + 1,
            page: name?.length ? name + '\u200b' : undefined,
          });
        });
    });

    return chapters;
  }

  // ---------- parseChapter ----------
  // Strategy:
  //   1. Fetch episode page → extract inline window.PLAYER_DATA
  //   2. If playTech=iframe (storage.googleapiscdn.com player):
  //      fetch the player page → extract avsToken & id → build m3u8 URL
  //   3. If playTech=api/all with sources → pass sources to customJS
  //   4. Fallback: extract data-hash/data-id for AJAX approach in customJS

  async parseChapter(chapterPath: string): Promise<string> {
    const url = SITE + chapterPath;
    const html = await fetchText(url);

    // ── 1. Try extracting window.PLAYER_DATA from inline scripts ──
    const pdMatch = html.match(
      /window\.PLAYER_DATA\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/,
    );
    if (pdMatch) {
      try {
        const rawJson = pdMatch[1].replace(/\\\//g, '/');
        const pd = JSON.parse(rawJson);

        // Case A: iframe player at storage.googleapiscdn.com
        if (
          pd.playTech === 'iframe' &&
          typeof pd.link === 'string' &&
          pd.link.includes('googleapiscdn.com')
        ) {
          try {
            const playerHtml = await fetchText(pd.link, {
              headers: { Referer: SITE + '/' },
            });
            const idM = playerHtml.match(/const\s+id\s*=\s*"([0-9a-f]+)"/);
            const tokM = playerHtml.match(/const\s+avsToken\s*=\s*"([^"]+)"/);
            if (idM && tokM) {
              const videoId = idM[1];
              const token = tokM[1];
              const base =
                pd.link.match(/^(https?:\/\/[^/]+)/)?.[1] ||
                'https://storage.googleapiscdn.com';
              const m3u8 = `${base}/playlist/${videoId}/playlist.m3u8?token=${encodeURIComponent(token)}&plain=1`;
              return this.buildPlayerHtml({
                m3u8,
                referer: pd.link,
              });
            }
          } catch (_) {
            //
          }
        }

        // Case B: api / all with sources array
        if (
          (pd.playTech === 'api' || pd.playTech === 'all') &&
          Array.isArray(pd.link)
        ) {
          // If embed disabled: only pick m3u8 sources
          if (!this.enableEmbed) {
            const hlsSource = pd.link.find(
              (s: any) =>
                s.type === 'hls' || /\.m3u8(\?|$)/i.test(s.file || ''),
            );
            if (hlsSource) {
              return this.buildPlayerHtml({
                m3u8: (hlsSource.file || '').replace(/^&http/, 'http'),
              });
            }
          } else {
            const sources = pd.link.map((s: any) => ({
              file: (s.file || '').replace(/^&http/, 'http'),
              type: s.type || '',
              label: s.label || '',
            }));
            return this.buildPlayerHtml({ sources });
          }
        }

        // Case C: api / all with single string link
        if (
          (pd.playTech === 'api' || pd.playTech === 'all') &&
          typeof pd.link === 'string'
        ) {
          const link = pd.link.replace(/^&http/, 'http');
          if (/\.m3u8(\?|$)/i.test(link)) {
            return this.buildPlayerHtml({ m3u8: link, referer: url });
          }
          if (this.enableEmbed && /\.(mp4|webm)(\?|$)/i.test(link)) {
            return this.buildPlayerHtml({
              sources: [{ file: link, type: 'mp4', label: '' }],
            });
          }
        }

        // Case D: iframe to non-googleapiscdn player (only when embed allowed)
        if (
          this.enableEmbed &&
          pd.playTech === 'iframe' &&
          typeof pd.link === 'string'
        ) {
          return this.buildPlayerHtml({ iframe: pd.link });
        }
      } catch (_) {
        //
      }
    }

    // When embed is off, don't fall back to hash/iframe
    if (!this.enableEmbed) {
      return '<p style="color:#ff4444;font-size:14px;font-family:sans-serif;text-align:center;padding:16px;">Không tìm thấy nguồn m3u8 cho tập phim này. Bật "Bật embed" trong cài đặt plugin để dùng fallback.</p><meta id="no-cache-marker"/><meta id="no-prefetch-marker"/>';
    }

    // ── 2. Fallback: extract data-hash/data-id for AJAX via customJS ──
    const $ = loadCheerio(html);
    this.checkCommonBlocked($);
    const cleanPath = chapterPath.split('?')[0].split('#')[0];
    let $link = $(
      `a.btn-episode.episode-link[href$="${cleanPath}"], a.btn-episode.episode-link[href*="${cleanPath}"]`,
    ).first();
    if ($link.length === 0) {
      $link = $('#list-server .server-group')
        .filter((_, el) => /AnimeVsub/i.test($(el).find('.server-name').text()))
        .find('a.btn-episode.active')
        .first();
    }
    if ($link.length === 0) {
      $link = $('a.btn-episode.episode-link.active').first();
    }

    const dataHash = $link.attr('data-hash') || '';
    const dataId = $link.attr('data-id') || '';

    if (dataHash) {
      return this.buildPlayerHtml({
        hash: dataHash,
        id: dataId,
        referer: url,
        site: SITE,
      });
    }

    // ── 3. Last resort: embed the episode page in an iframe ──
    return this.buildPlayerHtml({ iframe: url });
  }

  // ── Helper: build the HTML container for customJS ──
  private buildPlayerHtml(opts: {
    m3u8?: string;
    sources?: { file: string; type: string; label: string }[];
    iframe?: string;
    hash?: string;
    id?: string;
    referer?: string;
    site?: string;
  }): string {
    const esc = (s: string) => encodeHtmlEntities(s);

    const attrs: string[] = ['id="avs-player-container"'];
    if (opts.m3u8) attrs.push(`data-m3u8="${esc(opts.m3u8)}"`);
    if (opts.sources)
      attrs.push(`data-sources="${esc(JSON.stringify(opts.sources))}"`);
    if (opts.iframe) attrs.push(`data-iframe="${esc(opts.iframe)}"`);
    if (opts.hash) attrs.push(`data-hash="${esc(opts.hash)}"`);
    if (opts.id) attrs.push(`data-id="${esc(opts.id)}"`);
    if (opts.referer) attrs.push(`data-referer="${esc(opts.referer)}"`);
    if (opts.site) attrs.push(`data-site="${esc(opts.site)}"`);

    const mode = opts.m3u8 ? 'Đang ở chế độ m3u8' : 'Đang ở chế độ embed';

    return [
      `<div ${attrs.join(' ')}`,
      '  style="position:relative;width:100%;padding-bottom:56.25%;background:#000;">',
      '  <div id="avs-player-inner" style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">',
      '    <p style="color:#fff;font-family:sans-serif;">Đang tải video...</p>',
      '  </div>',
      '</div>',
      `<p style="color:#888;font-size:12px;font-family:sans-serif;text-align:center;margin:4px 0;">${mode}</p>`,
      '<meta id="no-cache-marker"/><meta id="no-prefetch-marker"/>',
    ].join('\n');
  }
}

export default new AnimeVietsubPlugin();
