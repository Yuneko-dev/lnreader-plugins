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
    version = '1.0.3';
    headers = {
        'Cookie': 'over18=yes',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://noc.syosetu.com/',
    };

    pluginSettings = {
        nocsyosetu_translate: {
            value: false,
            label: 'Translate Titles & Descriptions (Google Translate)',
            type: 'Switch',
        },
        nocsyosetu_translateLang: {
            value: 'en',
            label: 'Target Language (en <default> , vi, th, ...)',
            type: 'Text',
        },
    };

    get filters(): Filters {
        const translate = storage.get('nocsyosetu_translate');
        const getLabel = (jp: string, en: string) => translate ? `${jp} (${en})` : jp;

        return {
            order: {
                label: getLabel('並び替え', 'Order By'),
                type: FilterTypes.Picker,
                value: 'new',
                options: [
                    { label: getLabel('最新掲載順', 'Most Recently Updated'), value: 'new' },
                    { label: getLabel('週間ユニークアクセスが多い順', 'Most Weekly Unique Accesses'), value: 'weekly' },
                    { label: getLabel('ブックマーク登録の多い順', 'Most Bookmarks'), value: 'favnovelcnt' },
                    { label: getLabel('レビューの多い順', 'Most Reviews'), value: 'reviewcnt' },
                    { label: getLabel('総合ポイントの高い順', 'Highest Total Points'), value: 'hyoka' },
                    { label: getLabel('日間ポイントの高い順', 'Highest Daily Points'), value: 'dailypoint' },
                    { label: getLabel('週間ポイントの高い順', 'Highest Weekly Points'), value: 'weeklypoint' },
                    { label: getLabel('月間ポイントの高い順', 'Highest Monthly Points'), value: 'monthlypoint' },
                    { label: getLabel('四半期ポイントの高い順', 'Highest Quarterly Points'), value: 'quarterlypoint' },
                    { label: getLabel('年間ポイントの高い順', 'Highest Yearly Points'), value: 'yearlypoint' },
                    { label: getLabel('評価者数の多い順', 'Most Ratings'), value: 'hyokacnt' },
                    { label: getLabel('文字数の多い順', 'Highest Character Count'), value: 'lengthdesc' },
                    { label: getLabel('初回掲載順', 'Initial Publication Order'), value: 'generalfirstup' },
                    { label: getLabel('更新が古い順', 'Least Recently Updated'), value: 'old' },
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
                //&title=1&ex=1&keyword=1&wname=1
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
                //& sasie=1-&ispickup=1&iszankoku=1&isbl=1&isgl=1&istensei=1&istenni=1
                label: getLabel('特殊タグ', 'Special Tags'),
                type: FilterTypes.CheckboxGroup,
                value: [],
                options: [
                    { label: getLabel('残酷な描写あり', 'Cruel Content'), value: 'iszankoku' },
                    { label: getLabel('ボーイズラブ', 'Boys Love'), value: 'isbl' },
                    { label: getLabel('ガールズラブ', 'Girls Love'), value: 'isgl' },
                    { label: getLabel('異世界転生', 'Isekai Reincarnation'), value: 'istensei' },
                    { label: getLabel('異世界転移', 'Isekai Transfer'), value: 'istenni' },
                    { label: getLabel('挿絵のある作品', 'With Illustrations'), value: 'sasie' },
                    { label: getLabel('小説PickUp！対象作品', 'Pickup'), value: 'ispickup' },
                ],
            },
            tag: {
                // &stop=1&notzankoku=1&notbl=1&notgl=1&nottensei=1&nottenni=1
                label: getLabel('除外タグ', 'Exclude Tags'),
                type: FilterTypes.CheckboxGroup,
                value: [],
                options: [
                    { label: getLabel('長期連載停止中の作品', 'Long-term Suspended Serialization'), value: 'stop' },
                    { label: getLabel('残酷な描写あり', 'Cruel Content'), value: 'notzankoku' },
                    { label: getLabel('ボーイズラブ', 'Boys Love'), value: 'notbl' },
                    { label: getLabel('ガールズラブ', 'Girls Love'), value: 'notgl' },
                    { label: getLabel('異世界転生', 'Isekai Reincarnation'), value: 'nottensei' },
                    { label: getLabel('異世界転移', 'Isekai Transfer'), value: 'nottenni' },
                ],
            },
        } satisfies Filters;
    }

    async translateService(
        text: string,
        targetLang: string = storage.get('nocsyosetu_translateLang') || 'en',
        sourceLang: string = 'ja'
    ): Promise<string> {
        if (!text) return text;
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(
                text,
            )}`;
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

    isJapanese(text: string): boolean {
        return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
    }

    async popularNovels(
        pageNo: number,
        options: Plugin.PopularNovelsOptions<Filters>,
    ): Promise<Plugin.NovelItem[]> {
        const { filters } = options;
        let url = `${this.site}pickup/list/?p=${pageNo}`;

        if (filters && (
            filters.order.value !== 'new' ||
            filters.type.value ||
            (Array.isArray(filters.scope.value) && filters.scope.value.length > 0) ||
            (Array.isArray(filters.tags.value) && filters.tags.value.length > 0) ||
            (Array.isArray(filters.tag.value) && filters.tag.value.length > 0)
        )) {
            url = `${this.site}search/search/?p=${pageNo}`;
            if (filters.order.value) url += `&order=${filters.order.value}`;
            if (filters.type.value) url += `&type=${filters.type.value}`;
            if (Array.isArray(filters.scope?.value)) {
                filters.scope.value.forEach(s => url += `&${s}=1`);
            }
            if (Array.isArray(filters.tags?.value)) {
                filters.tags.value.forEach(t => url += `&${t}=1`);
            }
            if (Array.isArray(filters.tag?.value)) {
                filters.tag.value.forEach(t => url += `&${t}=1`);
            }
        }

        const result = await fetchApi(url, { headers: this.headers });
        const body = await result.text();

        const $ = loadCheerio(body);
        const novels: Plugin.NovelItem[] = [];

        $('.trackback_list').each((i, el) => {
            const $el = $(el);
            const titleAnchor = $el.find('.trackback_listdiv a').first();

            const name = titleAnchor.text().trim().replace(/\([^)]*\)$/, '').trim();
            let novelUrl = titleAnchor.attr('href');

            if (name && novelUrl) {
                if (!novelUrl.startsWith('http')) {
                    novelUrl = novelUrl.startsWith('/')
                        ? `https://novel18.syosetu.com${novelUrl}`
                        : `https://novel18.syosetu.com/${novelUrl}`;
                }

                novels.push({
                    name: name,
                    path: novelUrl,
                    cover: defaultCover,
                });
            }
        });

        if (storage.get('nocsyosetu_translate') && novels.length > 0) {
            await Promise.all(
                novels.map(async (n) => {
                    n.name = await this.translateService(n.name);
                })
            );
        }

        return novels;
    }

    parseChapters($page: any): Plugin.ChapterItem[] {
        const chapters: Plugin.ChapterItem[] = [];
        const chapterSelectors =
            '.novel_sublist2 .subtitle a, .p-eplist__sublist a.p-eplist__subtitle, .index_box .subtitle a';
        $page(chapterSelectors).each((i: number, el: any) => {
            const name = $page(el).text().trim();
            const path = $page(el).attr('href');
            if (name && path) {
                chapters.push({
                    name,
                    path: path.startsWith('http')
                        ? path
                        : path.startsWith('/')
                            ? `https://novel18.syosetu.com${path}`
                            : `https://novel18.syosetu.com/${path}`,
                    releaseTime: '',
                });
            }
        });
        return chapters;
    }

    async parseNovel(novelUrl: string): Promise<Plugin.SourceNovel & { totalPages: number }> {
        const result = await fetchApi(novelUrl, { headers: this.headers });
        const body = await result.text();

        const $ = loadCheerio(body);

        let lastPageNum = 1;
        const lastPageHref = $('.c-pager__item--last').attr('href');
        if (lastPageHref) {
            const match = lastPageHref.match(/\?p=(\d+)/);
            if (match && match[1]) {
                lastPageNum = parseInt(match[1]);
            }
        }

        let name = $('.p-novel__title').text().trim() || $('title').text().replace('ノクターンノベルズ', '').trim();
        let summary = $('#novel_ex, .p-novel__summary').text().trim();
        let genres = $('meta[name="keywords"]').attr('content') || '';

        if (storage.get('nocsyosetu_translate')) {
            name = await this.translateService(name);
            summary = await this.translateService(summary);
            if (genres) {
                genres = await this.translateService(genres);
            }
        }

        const novel: Plugin.SourceNovel & { totalPages: number } = {
            path: novelUrl,
            name,
            author: $('.p-novel__author').text().trim().replace('作者：', ''),
            summary,
            genres,
            cover: defaultCover,
            status: body.includes('完結済') ? NovelStatus.Completed : NovelStatus.Ongoing,
            chapters: this.parseChapters($),
            totalPages: lastPageNum,
        };

        return novel;
    }

    async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
        const nextPageUrl = `${novelPath}${novelPath.endsWith('/') ? '' : '/'}?p=${page}`;
        const result = await fetchApi(nextPageUrl, { headers: this.headers });
        const body = await result.text();
        const $ = loadCheerio(body);

        return {
            chapters: this.parseChapters($),
        };
    }

    async parseChapter(chapterPath: string): Promise<string> {
        const result = await fetchApi(chapterPath, { headers: this.headers });
        const body = await result.text();

        const $ = loadCheerio(body);

        const content = $('.p-novel__body').html() || '';

        return content;
    }

    async searchNovels(
        searchTerm: string,
        pageNo: number,
        filters?: any,
    ): Promise<Plugin.NovelItem[]> {
        let finalSearchTerm = searchTerm;
        if (searchTerm && !this.isJapanese(searchTerm)) {
            finalSearchTerm = await this.translateService(searchTerm, 'ja', 'auto');
        }

        let url = `${this.site}search/search/?word=${encodeURIComponent(
            finalSearchTerm,
        )}&p=${pageNo}`;

        if (filters) {
            if (filters.order?.value) url += `&order=${filters.order.value}`;
            if (filters.type?.value) url += `&type=${filters.type.value}`;
            if (Array.isArray(filters.scope?.value)) {
                filters.scope.value.forEach((s: string) => url += `&${s}=1`);
            }
            if (Array.isArray(filters.tags?.value)) {
                filters.tags.value.forEach((t: string) => url += `&${t}=1`);
            }
            if (Array.isArray(filters.tag?.value)) {
                filters.tag.value.forEach((t: string) => url += `&${t}=1`);
            }
        }

        const result = await fetchApi(url, { headers: this.headers });
        const body = await result.text();

        const $ = loadCheerio(body);

        const novels: Plugin.NovelItem[] = [];

        $('.searchkekka_box').each((i, el) => {
            const $el = $(el);
            const titleAnchor = $el.find('.novel_h a').first();
            const name = titleAnchor.text().trim();
            const novelUrl = titleAnchor.attr('href');

            if (name && novelUrl) {
                novels.push({
                    name,
                    path: novelUrl.startsWith('http') ? novelUrl : `https://novel18.syosetu.com${novelUrl}`,
                    cover: defaultCover,
                });
            }
        });
        if (novels.length === 0) {
            $('.trackback_list').each((i, el) => {
                const firstDiv = $(el).find('.trackback_listdiv').first();
                const titleAnchor = firstDiv.find('a').first();
                const name = titleAnchor.text().trim();
                const novelUrl = titleAnchor.attr('href');

                if (name && novelUrl) {
                    novels.push({
                        name,
                        path: novelUrl.startsWith('http') ? novelUrl : `https://novel18.syosetu.com${novelUrl}`,
                        cover: defaultCover,
                    });
                }
            });
        }

        if (storage.get('nocsyosetu_translate') && novels.length > 0) {
            await Promise.all(
                novels.map(async (n) => {
                    n.name = await this.translateService(n.name);
                })
            );
        }

        return novels;
    }
}

export default new NocSyosetu();