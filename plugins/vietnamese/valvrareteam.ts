import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';

class ValvrareTeamPlugin implements Plugin.PluginBase {
  id = 'valvrareteam';
  name = 'Valvrareteam';
  icon = 'src/vi/valvrareteam/icon.png';
  site = 'https://valvrareteam.net';
  version = '1.0.2';

  private allNovels: Plugin.NovelItem[] = [];
  private isLoaded = this.loadAllNovels();

  private normalizeInline(text = '') {
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async popularNovels(
    pageNo: number,
    { filters, showLatestNovels }: Plugin.PopularNovelsOptions<any>,
  ): Promise<Plugin.NovelItem[]> {
    await this.isLoaded;
    if (pageNo > 1) {
      return [];
    } else {
      return this.allNovels;
    }
  }

  async fetchPageNovel(pageNo: number): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}/danh-sach-truyen/trang/${pageNo}`;
    const res = await fetchApi(url);
    const html = await res.text();
    const $ = loadCheerio(html);

    const novels: Plugin.NovelItem[] = [];

    $('.nd-novel-card').each((i, card) => {
      const $card = $(card);
      const title = $card.find('.nd-novel-title').text().trim();
      const thumbnail = $card.find('.nd-novel-image img').attr('src');
      let path = $card.find('.nd-novel-title-link').attr('href');
      if (path && !path.startsWith('/')) {
        path = '/' + path;
      }

      if (title && path) {
        novels.push({
          name: title,
          cover: thumbnail || defaultCover,
          path: path,
        });
      }
    });

    return novels;
  }

  private extractAuthors($: any) {
    let author = '';
    let illustrator = '';

    $('.rd-info-row').each((_, row) => {
      const $row = $(row);
      const label = this.normalizeInline($row.find('.rd-info-label').text())
        .toLowerCase()
        .replace(':', '');
      const value = this.normalizeInline($row.find('.rd-info-value').text());

      if (label === 'tác giả') {
        author = value;
      }

      if (label === 'họa sĩ') {
        illustrator = value;
      }
    });

    return { author, illustrator };
  }

  private extractChaptersByVolume($: any) {
    const chapters: Plugin.ChapterItem[] = [];

    $('.module-container').each((_, moduleElement) => {
      const $module = $(moduleElement);
      const volumeName = this.normalizeInline(
        $module.find('.module-title').first().text(),
      );

      const templateId = $module
        .find('.module-content-wrapper > template[id^="B:"]')
        .attr('id');

      let $source = $module;
      if (templateId) {
        const idNumber = templateId.split(':')[1];
        $source = $(`#S\\:${idNumber}`);
      }

      $source.find('.module-chapter-item').each((__, item) => {
        const $item = $(item);
        const chapterTitle = this.normalizeInline(
          $item.find('.chapter-title-link').first().text(),
        ).replace(/([^\s])\(/g, '$1 (');
        const date = this.normalizeInline(
          $item.find('.novel-detail-chapter-date').first().text(),
        );
        let chapterPath =
          $item.find('a.chapter-title-link').attr('href') || null;

        if (chapterPath && !chapterPath.startsWith('/')) {
          chapterPath = '/' + chapterPath;
        }

        const loginRequired = $item.find('.login-required-text').length > 0;

        chapters.push({
          name: loginRequired ? '🔒 ' + chapterTitle : chapterTitle,
          releaseTime: date,
          path: chapterPath,
          page: volumeName || undefined,
        });
      });
    });

    return chapters;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const url = this.site + novelPath;
    const res = await fetchApi(url);
    const html = await res.text();
    const $ = loadCheerio(html);

    const title = this.normalizeInline(
      $('.rd-novel-title').first().clone().children().remove().end().text(),
    );
    const { author } = this.extractAuthors($);
    const genres = $('.rd-genres-list .rd-genre-tag')
      .map((_, el) => this.normalizeInline($(el).text()))
      .get()
      .filter(Boolean)
      .join(', ');

    const descriptionParagraphs = $('.rd-description-content p')
      .map((_, p) => this.normalizeInline($(p).text()))
      .get()
      .filter(Boolean);
    const description =
      descriptionParagraphs.length > 0
        ? descriptionParagraphs.join('\\n\\n')
        : this.normalizeInline($('.rd-description-content').first().text());

    const thumbnail = $('.rd-cover-image').attr('src') || defaultCover;

    const chapters = this.extractChaptersByVolume($);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: title || 'Untitled',
      cover: thumbnail,
      summary: description,
      author: author,
      genres: genres,
      chapters: chapters,
    };

    console.log('Parsed novel:', novel);

    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = this.site + chapterPath;
    const res = await fetchApi(url);
    const html = await res.text();
    const $ = loadCheerio(html);

    return $('.chapter-content').first().html()?.trim() ?? '';
  }

  async loadAllNovels() {
    let page = 1;
    let n = [];
    do {
      try {
        n = await this.fetchPageNovel(page);
        this.allNovels.push(...n);
        page++;
      } catch (e) {
        break;
      }
    } while (n.length > 0);
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    await this.isLoaded;
    // pagination for search results
    const results = this.allNovels.filter(novel =>
      novel.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const PAGE_SIZE = 20;
    const startIndex = (pageNo - 1) * PAGE_SIZE;

    return results.slice(startIndex, startIndex + PAGE_SIZE);
  }

  resolveUrl = (path: string, isNovel?: boolean) =>
    this.site + (isNovel ? path : path);
}

export default new ValvrareTeamPlugin();
