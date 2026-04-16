import { load as loadCheerio } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { defaultCover } from '@libs/defaultCover';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { NovelStatus } from '@libs/novelStatus';
import { storage } from '@libs/storage';

class NocSyosetu implements Plugin.PagePlugin {
  id = 'noc.syosetu';
  name = 'NocSyosetu';
  icon = 'src/jp/nocsyosetu/icon.png';
  site = 'https://noc.syosetu.com/';
  version = '1.1.7';
  headers = {
    'Cookie': 'over18=yes',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://noc.syosetu.com/',
  };

  pluginSettings = {
    nocsyosetu_translate: {
      value: false,
      label: 'Translate Titles & Summaries (Google Translate) - EN Default',
      type: 'Switch',
    },
    nocsyosetu_translateLang: {
      value: 'en',
      label: 'Language (e.g: en, vi, th, ...)',
      type: 'Text',
    },
  };

  get settingNocSyosetuTranslate() {
    return storage.get('nocsyosetu_translate');
  }

  get settingNocSyosetuTranslateLang() {
    return storage.get('nocsyosetu_translateLang') || 'en';
  }

  get filters(): Filters {
    const translate = this.settingNocSyosetuTranslate;
    const getLabel = (jp: string, en: string) =>
      translate ? `${jp} (${en})` : jp;

    return {
      order: {
        label: getLabel('並び替え', 'Order By'),
        type: FilterTypes.Picker,
        value: 'new',
        options: [
          {
            label: getLabel('最新掲載順', 'Most Recently Updated'),
            value: 'new',
          },
          {
            label: getLabel(
              '週間ユニークアクセスが多い順',
              'Most Weekly Unique Accesses',
            ),
            value: 'weekly',
          },
          {
            label: getLabel('ブックマーク登録の多い順', 'Most Bookmarks'),
            value: 'favnovelcnt',
          },
          {
            label: getLabel('レビューの多い順', 'Most Reviews'),
            value: 'reviewcnt',
          },
          {
            label: getLabel('総合ポイントの高い順', 'Highest Total Points'),
            value: 'hyoka',
          },
          {
            label: getLabel('日間ポイントの高い順', 'Highest Daily Points'),
            value: 'dailypoint',
          },
          {
            label: getLabel('週間ポイントの高い順', 'Highest Weekly Points'),
            value: 'weeklypoint',
          },
          {
            label: getLabel('月間ポイントの高い順', 'Highest Monthly Points'),
            value: 'monthlypoint',
          },
          {
            label: getLabel(
              '四半期ポイントの高い順',
              'Highest Quarterly Points',
            ),
            value: 'quarterlypoint',
          },
          {
            label: getLabel('年間ポイントの高い順', 'Highest Yearly Points'),
            value: 'yearlypoint',
          },
          {
            label: getLabel('評価者数の多い順', 'Most Ratings'),
            value: 'hyokacnt',
          },
          {
            label: getLabel('文字数の多い順', 'Highest Character Count'),
            value: 'lengthdesc',
          },
          {
            label: getLabel('初回掲載順', 'Initial Publication Order'),
            value: 'generalfirstup',
          },
          {
            label: getLabel('更新が古い順', 'Least Recently Updated'),
            value: 'old',
          },
        ],
      },
      type: {
        label: getLabel('作品種別', 'Novel Type'),
        type: FilterTypes.Picker,
        value: '',
        options: [
          { label: getLabel('全て', 'All'), value: '' },
          { label: getLabel('短編', 'Short Story'), value: 't' },
          { label: getLabel('連載', 'Serialization'), value: 're' },
          { label: getLabel('完結のみ', 'Completed'), value: 'er' },
          { label: getLabel('連載中のみ', 'Ongoing'), value: 'r' },
        ],
      },
      scope: {
        label: getLabel('検索範囲', 'Search Scope'),
        type: FilterTypes.CheckboxGroup,
        value: [],
        options: [
          { label: getLabel('作品タイトル', 'Title'), value: 'title' },
          { label: getLabel('あらすじ', 'Synopsis'), value: 'ex' },
          { label: getLabel('キーワード', 'Keywords'), value: 'keyword' },
          { label: getLabel('作者名', 'Author'), value: 'wname' },
        ],
      },
      tags: {
        label: getLabel('特殊タグ', 'Special Tags'),
        type: FilterTypes.CheckboxGroup,
        value: ['ispickup'],
        options: [
          {
            label: getLabel('残酷な描写あり', 'Cruel Content'),
            value: 'iszankoku',
          },
          { label: getLabel('ボーイズラブ', 'Boys Love'), value: 'isbl' },
          { label: getLabel('ガールズラブ', 'Girls Love'), value: 'isgl' },
          {
            label: getLabel('異世界転生', 'Isekai Reincarnation'),
            value: 'istensei',
          },
          {
            label: getLabel('異世界転移', 'Isekai Transfer'),
            value: 'istenni',
          },
          {
            label: getLabel('挿絵のある作品', 'With Illustrations'),
            value: 'sasie',
          },
          {
            label: getLabel('小説PickUp！対象作品', 'Pickup'),
            value: 'ispickup',
          },
        ],
      },
      tag: {
        label: getLabel('除外タグ', 'Exclude Tags'),
        type: FilterTypes.CheckboxGroup,
        value: [],
        options: [
          {
            label: getLabel(
              '長期連載停止中の作品',
              'Long-term Suspended Serialization',
            ),
            value: 'stop',
          },
          {
            label: getLabel('残酷な描写あり', 'Cruel Content'),
            value: 'notzankoku',
          },
          { label: getLabel('ボーイズラブ', 'Boys Love'), value: 'notbl' },
          { label: getLabel('ガールズラブ', 'Girls Love'), value: 'notgl' },
          {
            label: getLabel('異世界転生', 'Isekai Reincarnation'),
            value: 'nottensei',
          },
          {
            label: getLabel('異世界転移', 'Isekai Transfer'),
            value: 'nottenni',
          },
        ],
      },
    } satisfies Filters;
  }

  async translateService(
    text: string,
    targetLang?: string,
    sourceLang = 'auto',
  ): Promise<string> {
    if (!text) return text;
    const lang = (
      targetLang ||
      storage.get('nocsyosetu_translateLang') ||
      'en'
    ).trim();
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

  // dirty hack
  isJapanese(text: string): boolean {
    return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
  }

  private parseNovels($: any): Plugin.NovelItem[] {
    const novels: Plugin.NovelItem[] = [];

    $('.searchkekka_box, .trackback_list').each((i: number, el: any) => {
      const $el = $(el);
      const titleAnchor = $el
        .find('.novel_h a, .trackback_listdiv a, a.tl')
        .first();
      if (titleAnchor.length === 0) return;

      const name = titleAnchor
        .text()
        .trim()
        .replace(/\([^)]*\)$/, '')
        .trim();
      let novelUrl = titleAnchor.attr('href');

      if (name && novelUrl) {
        novelUrl = this.normalizeNovelUrl(novelUrl);

        novels.push({
          name,
          path: novelUrl,
          cover: defaultCover,
        });
      }
    });

    return novels;
  }

  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions<Filters>,
  ): Promise<Plugin.NovelItem[]> {
    const { filters } = options;
    let url = `${this.site}search/search/search.php?order_former=search&p=${pageNo}&word=&order=new&ispickup=1`;

    if (
      filters &&
      (filters.order.value !== 'new' ||
        filters.type.value ||
        (Array.isArray(filters.scope.value) &&
          filters.scope.value.length > 0) ||
        (Array.isArray(filters.tags.value) && filters.tags.value.length > 0) ||
        (Array.isArray(filters.tag.value) && filters.tag.value.length > 0))
    ) {
      url = `${this.site}search/search/search.php?order_former=search&p=${pageNo}&word=`;
      if (filters.order.value) {
        url += `&order=${filters.order.value}`;
      }
      if (filters.type.value) {
        url += `&type=${filters.type.value}`;
      }
      if (Array.isArray(filters.scope?.value)) {
        filters.scope.value.forEach(s => (url += `&${s}=1`));
      }
      if (Array.isArray(filters.tags?.value)) {
        filters.tags.value.forEach(t => (url += `&${t}=1`));
      }
      if (Array.isArray(filters.tag?.value)) {
        filters.tag.value.forEach(t => (url += `&${t}=1`));
      }
    }

    const result = await fetchApi(url, { headers: this.headers });
    const body = await result.text();

    const $ = loadCheerio(body);

    const pageNovels = this.parseNovels($);

    if (pageNovels.length === 0) {
      if (!body.includes('0作品')) {
        throw new Error(
          'Failed to load novels. Please check the age gate in WebView. / 小説の読み込みに失敗しました。WebViewでの年齢確認をご確認ください。',
        );
      }
    }

    if (this.settingNocSyosetuTranslate && pageNovels.length > 0) {
      let content = ``;
      for (const novel of pageNovels) {
        content += novel.name + '\n';
      }
      content = await this.translateService(content);
      const translatedNames = content.split('\n');
      for (let i = 0; i < pageNovels.length; i++) {
        pageNovels[i].name = translatedNames[i] || pageNovels[i].name;
      }
    }

    return pageNovels;
  }

  parseChapters($page: any): Plugin.ChapterItem[] {
    const chapters: Plugin.ChapterItem[] = [];

    //    const chapterSelectors =
    //      '.novel_sublist2 .subtitle a, .p-eplist__sublist a.p-eplist__subtitle, .index_box .subtitle a';
    //    $page(chapterSelectors).each((i: number, el: any) => {
    //      const name = $page(el).text().trim();
    //      const path = $page(el).attr('href');
    //      if (name && path) {
    //        chapters.push({
    //          name,
    //          path: this.normalizeNovelUrl(path),
    //          releaseTime: '',
    //        });
    //      }
    //    });

    $page('.p-eplist__sublist').each((i: number, element: any) => {
      const chapterLink = $page(element).find('a');
      const chapterUrl = chapterLink.attr('href');
      const chapterName = chapterLink.text().trim();
      const releaseDate = $page(element)
        .find('.p-eplist__update')
        .text()
        .trim()
        .split(' ')[0]
        .replace(/\//g, '-');

      if (chapterUrl) {
        chapters.push({
          name: chapterName,
          releaseTime: releaseDate,
          path: this.normalizeNovelUrl(chapterUrl),
        });
      }
    });

    return chapters;
  }

  private normalizeNovelUrl(url: string): string {
    if (url.startsWith('http')) {
      return url;
    } else if (url.startsWith('/')) {
      return `https://novel18.syosetu.com${url}`;
    } else {
      return `https://novel18.syosetu.com/${url}`;
    }
  }

  async parseNovel(
    novelUrl: string,
  ): Promise<Plugin.SourceNovel & { totalPages: number }> {
    const result = await fetchApi(novelUrl, { headers: this.headers });
    const body = await result.text();

    const $ = loadCheerio(body);

    // Parse status
    let status = 'Unknown';
    if (
      $('.c-announce').text().includes('連載中') ||
      $('.c-announce').text().includes('未完結')
    ) {
      status = NovelStatus.Ongoing;
    } else if ($('.c-announce').text().includes('更新されていません')) {
      status = NovelStatus.OnHiatus;
    } else if ($('.c-announce').text().includes('完結')) {
      status = NovelStatus.Completed;
    }

    let lastPageNum = 1;
    const lastPageHref = $('.c-pager__item--last').attr('href');
    if (lastPageHref) {
      const match = lastPageHref.match(/\?p=(\d+)/);
      if (match && match[1]) {
        lastPageNum = parseInt(match[1]);
      }
    }

    let name =
      $('.p-novel__title').text().trim() ||
      $('title').text().replace('ノクターンノベルズ', '').trim();
    let summary = ($('#novel_ex').html() || '').replace(/<br>/g, '\n').trim();
    let genres = $('meta[property="og:description"]')
      .attr('content')
      ?.split(' ')
      .join(',');

    const chapters = this.parseChapters($);
    if (chapters.length === 0 && $('.p-novel__body').length > 0) {
      // YYYY/MM/DD
      const date = $('.p-novel__date-published')
        .text()
        .trim()
        .match(/(\d{4}\/\d{2}\/\d{2})/)?.[1];
      // Convert to YYYY-MM-DD
      const releaseTime = date ? date.replace(/\//g, '-') : '';
      chapters.push({
        name,
        path: novelUrl,
        releaseTime,
      });
    }

    if (this.settingNocSyosetuTranslate) {
      if (genres) {
        const trans = await this.translateService(
          `${name}\n${genres}\n${summary}`,
        );
        const arr = trans.split('\n');
        name = arr[0];
        genres = arr[1];
        summary = arr.slice(2).join('\n');
      } else {
        const trans = await this.translateService(`${name}\n${summary}`);
        const arr = trans.split('\n');
        name = arr[0];
        summary = arr.slice(1).join('\n');
      }
    }

    const novel: Plugin.SourceNovel & { totalPages: number } = {
      path: novelUrl,
      name,
      author: $('.p-novel__author').text().replace('作者：', '').trim(),
      summary,
      artist: '',
      genres,
      cover: defaultCover,
      status,
      chapters,
      totalPages: lastPageNum,
    };

    return novel;
  }

  async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
    const url = new URL(novelPath);
    url.searchParams.set('p', page);
    const result = await fetchApi(url.toString(), { headers: this.headers });
    const body = await result.text();
    const $ = loadCheerio(body);

    return {
      chapters: this.parseChapters($),
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const result = await fetchApi(chapterPath, { headers: this.headers });
    const body = await result.text();

    const cheerioQuery = loadCheerio(body);
    // Get the chapter title
    const chapterTitle = cheerioQuery('.p-novel__title').html() || '';

    // Get the chapter content
    const chapterContent =
      cheerioQuery(
        '.p-novel__body .p-novel__text:not([class*="p-novel__text--"])',
      ).html() || '';

    // Combine title and content with proper HTML structure
    return `<h1>${chapterTitle}</h1>${chapterContent}`;
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    let finalSearchTerm = searchTerm;
    if (searchTerm && !this.isJapanese(searchTerm)) {
      finalSearchTerm = await this.translateService(searchTerm, 'ja', 'auto');
    }

    const url = `${this.site}search/search/search.php?order_former=search&word=${encodeURIComponent(
      finalSearchTerm,
    )}${
      pageNo !== undefined
        ? `&p=${pageNo <= 1 || pageNo > 100 ? '1' : pageNo}` // check if pagenum is between 1 and 100
        : '' // if isn't don't set ?p
    }`;

    const result = await fetchApi(url, { headers: this.headers });
    const body = await result.text();

    const cheerioQuery = loadCheerio(body);

    const pageNovels = this.parseNovels(cheerioQuery);

    if (pageNovels.length === 0 && pageNo === 1) {
      if (!body.includes('0作品')) {
        throw new Error(
          'Failed to load novels. Please check the age gate in WebView. / 小説の読み込みに失敗しました。WebViewでの年齢確認をご確認ください。',
        );
      }
    }

    if (this.settingNocSyosetuTranslate && pageNovels.length > 0) {
      let content = ``;
      for (const novel of pageNovels) {
        content += novel.name + '\n';
      }
      content = await this.translateService(content);
      const translatedNames = content.split('\n');
      for (let i = 0; i < pageNovels.length; i++) {
        pageNovels[i].name = translatedNames[i] || pageNovels[i].name;
      }
    }

    return pageNovels;
  }
}

export default new NocSyosetu();
