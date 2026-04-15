// Easter Eggs

import { fetchText } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

class BaoMoiPlugin implements Plugin.PluginBase {
  id = 'baomoi.com';
  name = 'Báo Mới';
  icon = 'src/vi/baomoi/icon.png';
  site = 'https://baomoi.com';
  version = '1.0.0';
  filters: Filters | undefined = undefined;
  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];
    const response = await fetchText(`${this.site}/tin-moi/trang${pageNo}.epi`);
    const $ = loadCheerio(response);
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      const nextData = JSON.parse(nextDataScript);
      const items = nextData.props.pageProps.resp.data.content.items;
      console.log('Parsed __NEXT_DATA__:', items);
      items.forEach((item: any) => {
        novels.push({
          name: item.title,
          path: item.url,
          cover: item.thumb || defaultCover,
        });
      });
    } else {
      throw new Error(
        'Failed to find __NEXT_DATA__ script in the popular novels page',
      );
    }
    return novels;
  }

  async parseNovel(novelPath: string): Promise<
    Plugin.SourceNovel & {
      content: string;
    }
  > {
    const text = await fetchText(`${this.site}${novelPath}`);
    const $ = loadCheerio(text);

    const novel: Plugin.SourceNovel & {
      content: string;
    } = {
      path: novelPath,
      content: '',
      name: '',
    };
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      const nextData = JSON.parse(nextDataScript);
      const data = nextData.props.pageProps.resp.data.content;
      console.log('Parsed __NEXT_DATA__:', data);
      novel.name = data.title;
      novel.author = data.publisher?.name || 'Unknown';
      novel.cover = data.thumbL || data.thumb || defaultCover;
      novel.genres = data.tags?.map((tag: any) => tag.name).join(',') || '';
      novel.status = NovelStatus.Completed;
      novel.summary = data.description || '';
      novel.chapters = [
        {
          name: 'Đọc trực tiếp trên LNReader',
          path: data.url + '#read',
          chapterNumber: 0,
          releaseTime: new Date(
            (data.publishedDate || data.date || 0) * 1_000,
          ).toISOString(),
        },
      ];
      novel.content = data.bodys
        .map((item: any) => {
          switch (item.type) {
            case 'text': {
              const textClass = item.subType
                ? ` class="${item.subType}"`
                : ' class="body-text"';
              return `<p${textClass}>${item.content}</p>`;
            }

            case 'image': {
              const loadingAttr = item.lazyLoad ? ' loading="lazy"' : '';
              return `
          <figure class="article-image">
            <img 
              src="${item.content}" 
              width="${item.width}" 
              height="${item.height}" 
              alt="Hình ảnh bài viết" 
              ${loadingAttr}
            />
          </figure>
        `.trim();
            }

            case 'video':
              return `
          <figure class="article-video">
            <video controls width="${item.width}" height="${item.height}" poster="${item.poster}">
              <source src="${item.content}" type="video/mp4" />
              Trình duyệt của bạn không hỗ trợ thẻ video.
            </video>
          </figure>
        `.trim();

            default:
              console.warn(`Bỏ qua type không xác định: ${item.type}`);
              return '';
          }
        })
        .join('\n');
    } else {
      throw new Error('Failed to find __NEXT_DATA__ script in the novel page');
    }
    console.log('Parsed novel:', novel);
    return novel;
  }

  async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
    const novel = await this.parseNovel(novelPath);
    return {
      chapters: novel.chapters || [],
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const novel = await this.parseNovel(chapterPath);
    return novel.content || '';
  }
  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];
    const response = await fetchText(
      `${this.site}/tim-kiem/${encodeURIComponent(searchTerm)}/trang${pageNo}.epi`,
    );
    const $ = loadCheerio(response);
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      const nextData = JSON.parse(nextDataScript);
      const items = nextData.props.pageProps.resp.data.content.items;
      console.log('Parsed __NEXT_DATA__:', items);
      items.forEach((item: any) => {
        novels.push({
          name: item.title,
          path: item.url,
          cover: item.thumb || defaultCover,
        });
      });
    } else {
      throw new Error(
        'Failed to find __NEXT_DATA__ script in the search results page',
      );
    }
    return novels;
  }
}

export default new BaoMoiPlugin();
