import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';
import {
  decodeHtmlEntities,
  encodeHtmlEntities,
  NodeCrypto,
} from '@libs/utils';
import { Buffer } from '@libs/utils';
import { storage } from '@libs/storage';
import { ctr } from '@libs/aes';

const SITE = 'https://hentaiz.hot';
const STORAGE_URL = 'https://storage.haiten.org';
const MIMIX_API = 'https://x.mimix.cc/watch/';

function hexToBytes(hex: string): Uint8Array {
  return Buffer.from(hex, 'hex');
}

async function decryptVideoData(
  videoId: string,
): Promise<{
  m3u8Master: string;
  m3u8Playlists: string[];
  variantFolders: string[];
  segDomain: string;
  id: string;
} | null> {
  try {
    const res = await fetchApi(MIMIX_API + videoId);
    if (!res.ok) {
      console.error('[HTZ] mimix fetch failed:', res.status);
      return null;
    }
    const rawText = await res.text();
    const text = rawText.trim();
    const colonIdx = text.indexOf(':');
    if (colonIdx < 0) {
      console.error('[HTZ] invalid mimix response format');
      return null;
    }

    const iv = hexToBytes(text.substring(0, colonIdx));
    const ct = hexToBytes(text.substring(colonIdx + 1));
    const key = NodeCrypto.createHash('sha256').update(videoId).digest();

    const cipher = ctr(key, iv);
    const decrypted = cipher.decrypt(ct);
    const jsonStr = new TextDecoder().decode(decrypted);
    const data = JSON.parse(jsonStr);

    const m3u8 = data.defaultM3u8;
    if (!m3u8?.master || !m3u8?.playlists?.length) {
      console.error('[HTZ] no m3u8 data in decrypted response');
      return null;
    }

    const segDomain =
      data.segmentDomains?.length > 0
        ? data.segmentDomains[0]
        : data.domain || '';

    const variantFolders: string[] = [];
    for (const line of m3u8.master.split('\n')) {
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.startsWith('#') &&
        trimmed.includes('playlist.m3u8')
      ) {
        variantFolders.push(trimmed.replace('/playlist.m3u8', ''));
      }
    }

    return {
      m3u8Master: m3u8.master,
      m3u8Playlists: m3u8.playlists,
      variantFolders,
      segDomain,
      id: data.id || videoId,
    };
  } catch (e) {
    console.error('[HTZ] decryptVideoData error:', e);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeSvelteData(data: any[]): any {
  const cache = new Map();
  function resolve(idx: number): any {
    if (cache.has(idx)) return cache.get(idx);
    const val = data[idx];
    if (val === null || val === undefined) {
      cache.set(idx, val);
      return val;
    }
    if (
      typeof val === 'string' ||
      typeof val === 'number' ||
      typeof val === 'boolean'
    ) {
      cache.set(idx, val);
      return val;
    }
    if (Array.isArray(val)) {
      if (val.length === 2 && val[0] === 'Date') {
        const d = val[1];
        cache.set(idx, d);
        return d;
      }
      const arr: any[] = [];
      cache.set(idx, arr);
      for (const i of val) {
        arr.push(resolve(i));
      }
      return arr;
    }
    const obj: Record<string, any> = {};
    cache.set(idx, obj);
    for (const [key, i] of Object.entries(val)) {
      obj[key] = resolve(i as number);
    }
    return obj;
  }
  return resolve(0);
}

async function fetchSvelteData(url: string): Promise<any> {
  const res = await fetchApi(url);
  if (!res.ok) return null;
  const json = await res.json();
  const pageNode = json?.nodes?.[2];
  if (!pageNode || pageNode.type === 'error' || !pageNode.data) return null;
  return decodeSvelteData(pageNode.data);
}

const genreOptions: { label: string; value: string }[] = [
  { label: '3D', value: '3d' },
  { label: 'Ahegao', value: 'ahegao' },
  { label: 'Anal', value: 'anal' },
  { label: 'Bao cao su', value: 'bao-cao-su' },
  { label: 'Bạo dâm', value: 'bao-dam' },
  { label: 'Big Boobs', value: 'big-boobs' },
  { label: 'Big girls', value: 'big-girls' },
  { label: 'Bondage', value: 'bondage' },
  { label: 'Bú liếm', value: 'bu-liem' },
  { label: 'Công cộng', value: 'cong-cong' },
  { label: 'Cosplay', value: 'cosplay' },
  { label: 'Da ngăm', value: 'da-ngam' },
  { label: 'Đẻ con', value: 'de-con' },
  { label: 'Đồ Bơi', value: 'do-boi' },
  { label: 'Double Penetration', value: 'double-penetration' },
  { label: 'Đụ Vú', value: 'du-vu' },
  { label: 'Elf', value: 'elf' },
  { label: 'Fantasy', value: 'fantasy' },
  { label: 'Femdom', value: 'femdom' },
  { label: 'Foot Job', value: 'foot-job' },
  { label: 'Furry', value: 'furry' },
  { label: 'Futanari', value: 'futanari' },
  { label: 'Gái quậy', value: 'gai-quay' },
  { label: 'Gang Bang', value: 'gang-bang' },
  { label: 'Giáo viên', value: 'giao-vien' },
  { label: 'Goblin', value: 'goblin' },
  { label: 'Guro', value: 'guro' },
  { label: 'Harem', value: 'harem' },
  { label: 'Hiếp dâm', value: 'hiep-dam' },
  { label: 'Idol', value: 'idol' },
  { label: 'Josei', value: 'josei' },
  { label: 'Kemonomimi', value: 'kemonomimi' },
  { label: 'Loạn luân', value: 'loan-luan' },
  { label: 'Loli', value: 'loli' },
  { label: 'Maid', value: 'maid' },
  { label: 'Mang thai', value: 'mang-thai' },
  { label: 'Megane', value: 'megane' },
  { label: 'MILF', value: 'milf' },
  { label: 'Mind Break', value: 'mind-break' },
  { label: 'Monster', value: 'monster' },
  { label: 'Ngủ', value: 'ngu' },
  { label: 'NTR', value: 'ntr' },
  { label: 'Nữ sinh', value: 'nu-sinh' },
  { label: 'Plot', value: 'plot' },
  { label: 'Scat', value: 'scat' },
  { label: 'Sex Toy', value: 'sex-toy' },
  { label: 'Shota', value: 'shota' },
  { label: 'Softcore', value: 'softcore' },
  { label: 'Stocking', value: 'stocking' },
  { label: 'Sữa mẹ', value: 'sua-me' },
  { label: 'Succubus', value: 'succubus' },
  { label: 'Thác loạn', value: 'thac-loan' },
  { label: 'Thôi miên', value: 'thoi-mien' },
  { label: 'Threesome', value: 'threesome' },
  { label: 'Thủ Dâm', value: 'thu-dam' },
  { label: 'Thuốc kích dục', value: 'thuoc-kich-duc' },
  { label: 'Tiểu tiện', value: 'tieu-tien' },
  { label: 'Tống tình', value: 'tong-tinh' },
  { label: 'Trap', value: 'trap' },
  { label: 'Tsundere', value: 'tsundere' },
  { label: 'Ugly Bastard', value: 'ugly-bastard' },
  { label: 'Vanilla', value: 'vanilla' },
  { label: 'Virgin', value: 'virgin' },
  { label: 'Vú lép', value: 'vu-lep' },
  { label: 'Wafuku', value: 'wafuku' },
  { label: 'X-Ray', value: 'x-ray' },
  { label: 'Xúc tu', value: 'xuc-tu' },
  { label: 'Yaoi', value: 'yaoi' },
  { label: 'Y Tá', value: 'y-ta' },
  { label: 'Yuri', value: 'yuri' },
];

const studioOptions: { label: string; value: string }[] = [
  { label: 'Tất cả', value: 'ALL' },
  { label: '26RegionSFM', value: '26regionsfm' },
  { label: 'Actas', value: 'actas' },
  { label: 'Active', value: 'active' },
  { label: 'Adult Source Media', value: 'adult-source-media' },
  { label: 'affect3D', value: 'affect3d' },
  { label: 'Aiban Work', value: 'aiban-work' },
  { label: 'AIC', value: 'aic' },
  { label: 'AIC Plus+', value: 'aic-plus' },
  { label: 'Akita Shoten', value: 'akita-shoten' },
  { label: 'Alles', value: 'alles' },
  { label: 'Amelialtie', value: 'amelialtie' },
  { label: 'Amusteven', value: 'amusteven' },
  { label: 'Animac', value: 'animac' },
  { label: 'AniMan', value: 'animan' },
  { label: 'Animate Film', value: 'animate-film' },
  { label: 'Anime Antenna Iinkai', value: 'anime-antenna-iinkai' },
  { label: 'Antechinus', value: 'antechinus' },
  { label: 'APPP', value: 'appp' },
  { label: 'Armor', value: 'armor' },
  { label: 'Arms', value: 'arms' },
  { label: 'AT-2', value: 'at-2' },
  { label: 'Atelier KOB', value: 'atelier-kob' },
  { label: 'Awakoto-ya', value: 'awakoto-ya' },
  { label: 'Axel3D', value: 'axel3d' },
  { label: 'BEAM Entertainment', value: 'beam-entertainment' },
  { label: 'BloomZ', value: 'bloomz' },
  { label: 'Blue bread', value: 'blue-bread' },
  { label: 'Blue Cat', value: 'blue-cat' },
  { label: 'Blue Eyes', value: 'blue-eyes' },
  { label: 'BOMB! CUTE! BOMB!', value: 'bomb-cute-bomb' },
  { label: 'BOOTLEG', value: 'bootleg' },
  { label: 'Break Bottle', value: 'break-bottle' },
  { label: 'Bunny Walker', value: 'bunny-walker' },
  { label: 'CherryLips', value: 'cherrylips' },
  { label: 'ChiChinoya', value: 'chichinoya' },
  { label: 'chippai', value: 'chippai' },
  { label: 'Chocolat', value: 'chocolat' },
  { label: 'Chu Chu', value: 'chu-chu' },
  { label: 'Circle Tribute', value: 'circle-tribute' },
  { label: 'Collaboration Works', value: 'collaboration-works' },
  { label: 'Cosmic Ray', value: 'cosmic-ray' },
  { label: 'Cosmos', value: 'cosmos' },
  { label: 'Cotton Doll', value: 'cotton-doll' },
  { label: 'Cranberry', value: 'cranberry' },
  { label: 'Critical Mass Video', value: 'critical-mass-video' },
  { label: 'D3', value: 'd3' },
  { label: 'Dezmall', value: 'dezmall' },
  { label: 'Digital Works', value: 'digital-works' },
  { label: 'Discovery', value: 'discovery' },
  { label: 'DMT', value: 'dmt' },
  { label: 'Doberman Studio', value: 'doberman-studio' },
  { label: 'Dollhouse', value: 'dollhouse' },
  { label: 'Dream Force', value: 'dream-force' },
  { label: 'EBIMARU-DO', value: 'ebimaru-do' },
  { label: 'Echo', value: 'echo' },
  { label: 'EDGE', value: 'edge' },
  { label: 'Erozuki', value: 'erozuki' },
  { label: 'Exprational', value: 'exprational' },
  { label: 'Five Ways', value: 'five-ways' },
  { label: 'Flavors Soft', value: 'flavors-soft' },
  { label: 'Forged3DX', value: 'forged3dx' },
  { label: 'FOW', value: 'fow' },
  { label: 'Frontier Works', value: 'frontier-works' },
  { label: 'G-Lam', value: 'g-lam' },
  { label: 'Glovision', value: 'glovision' },
  { label: 'Godoy', value: 'godoy' },
  { label: 'GOLD BEAR', value: 'gold-bear' },
  { label: 'Green Bunny', value: 'green-bunny' },
  { label: 'Guheihei', value: 'guheihei' },
  { label: 'Guilty', value: 'guilty' },
  { label: 'H69 Verse', value: 'h69-verse' },
  { label: 'Hills', value: 'hills' },
  { label: 'Himajin Planning', value: 'himajin-planning' },
  { label: 'Hoods Entertainment', value: 'hoods-entertainment' },
  { label: 'HoriPro', value: 'horipro' },
  { label: 'Hot Bear', value: 'hot-bear' },
  { label: 'HouKIBOSHI', value: 'houkiboshi' },
  { label: 'HY', value: 'hy' },
  { label: 'Image House', value: 'image-house' },
  { label: 'IMP', value: 'imp' },
  { label: 'InitialAI', value: 'initialai' },
  { label: 'Innocent Grey', value: 'innocent-grey' },
  { label: 'ITONAMI', value: 'itonami' },
  { label: 'Ivory Tower', value: 'ivory-tower' },
  { label: 'Jackerman', value: 'jackerman' },
  { label: 'Jam', value: 'jam' },
  { label: 'JapanAnime', value: 'japananime' },
  { label: 'Jellyfish', value: 'jellyfish' },
  { label: 'Jerid', value: 'jerid' },
  { label: 'JT2XTREME', value: 'jt2xtreme' },
  { label: 'Juicy Mango', value: 'juicy-mango' },
  { label: 'Kanade Creative', value: 'kanade-creative' },
  { label: 'Kanitarumono', value: 'kanitarumono' },
  { label: 'Kazuki Production', value: 'kazuki-production' },
  { label: 'King Bee', value: 'king-bee' },
  { label: 'Kitty Media', value: 'kitty-media' },
  { label: 'L', value: 'l' },
  { label: 'Lantis', value: 'lantis' },
  { label: 'Lune Pictures', value: 'lune-pictures' },
  { label: 'MaF', value: 'maf' },
  { label: 'Magic Bus', value: 'magic-bus' },
  { label: 'Majin', value: 'majin' },
  { label: 'Maplestar', value: 'maplestar' },
  { label: 'marmalade*star', value: 'marmaladestar' },
  { label: 'Mary Jane', value: 'mary-jane' },
  { label: 'Media Bank', value: 'media-bank' },
  { label: 'Media Blasters', value: 'media-blasters' },
  { label: 'Mendez SFM', value: 'mendez-sfm' },
  { label: 'Metoro', value: 'metoro' },
  { label: 'Milkshake', value: 'milkshake' },
  { label: 'Milky', value: 'milky' },
  { label: 'Milky Animation Label', value: 'milky-animation-label' },
  { label: 'Mitsu', value: 'mitsu' },
  { label: 'Miwo3x', value: 'miwo3x' },
  { label: 'MizudeppO', value: 'mizudeppo' },
  { label: 'mmdia', value: 'mmdia' },
  { label: 'Mousou Senka', value: 'mousou-senka' },
  { label: 'MS Pictures', value: 'ms-pictures' },
  { label: 'N/A', value: 'na' },
  { label: 'Nagoonimation', value: 'nagoonimation' },
  { label: 'Najar', value: 'najar' },
  { label: 'Natural High', value: 'natural-high' },
  { label: 'Nekokoya', value: 'nekokoya' },
  { label: 'Neural Desires', value: 'neural-desires' },
  { label: 'New Generation', value: 'new-generation' },
  { label: 'Nihikime no Dozeu', value: 'nihikime-no-dozeu' },
  { label: 'Nikovako', value: 'nikovako' },
  { label: 'No Future', value: 'no-future' },
  { label: 'Nur', value: 'nur' },
  { label: 'NuTech Digital', value: 'nutech-digital' },
  { label: 'Office Take Off', value: 'office-take-off' },
  { label: 'Office Takeout', value: 'office-takeout' },
  { label: 'OLE-M', value: 'ole-m' },
  { label: 'opiumud', value: 'opiumud' },
  { label: 'OZ', value: 'oz' },
  { label: 'PashminaA', value: 'pashminaa' },
  { label: 'Passione', value: 'passione' },
  { label: 'peachpie', value: 'peachpie' },
  { label: 'PerfectDeadbeat', value: 'perfectdeadbeat' },
  { label: 'Picante Circus', value: 'picante-circus' },
  { label: 'Pink Pineapple', value: 'pink-pineapple' },
  { label: 'Pink sama', value: 'pink-sama' },
  { label: 'Pixy', value: 'pixy' },
  { label: 'Platinum Milky', value: 'platinum-milky' },
  { label: 'Poly Animation', value: 'poly-animation' },
  { label: 'PoRO', value: 'poro' },
  { label: 'Production Reed', value: 'production-reed' },
  { label: 'Queen Bee', value: 'queen-bee' },
  { label: 'Rabbit Gate', value: 'rabbit-gate' },
  { label: 'Raiose', value: 'raiose' },
  { label: 'RD', value: 'rd' },
  { label: 'RiffleR18', value: 'riffler18' },
  { label: "Ryuu M's", value: "ryuu-m's" },
  { label: 'Sakura Purin', value: 'sakura-purin' },
  { label: 'schoolzone', value: 'schoolzone' },
  { label: 'Seismic', value: 'seismic' },
  { label: 'SELFISH', value: 'selfish' },
  { label: 'Sentai Filmworks', value: 'sentai-filmworks' },
  { label: 'Seven', value: 'seven' },
  { label: 'Shinkuukan', value: 'shinkuukan' },
  { label: 'Shion', value: 'shion' },
  { label: 'Showten', value: 'showten' },
  { label: "Silky's", value: "silky's" },
  { label: 'Skuddbutt', value: 'skuddbutt' },
  { label: 'Socrates', value: 'socrates' },
  { label: 'SPEED', value: 'speed' },
  { label: 'Studio 1st', value: 'studio-1st' },
  { label: 'Studio 9 MAiami', value: 'studio-9-maiami' },
  { label: 'Studio CA', value: 'studio-ca' },
  { label: 'Studio Eromatick', value: 'studio-eromatick' },
  { label: 'Studio Fantasia', value: 'studio-fantasia' },
  { label: 'studioGGB', value: 'studioggb' },
  { label: 'Studio Gokumi', value: 'studio-gokumi' },
  { label: 'Studio Ten Carat', value: 'studio-ten-carat' },
  { label: 'Studio Tulip', value: 'studio-tulip' },
  { label: 'Studio Zealot', value: 'studio-zealot' },
  { label: 'Suiseisha', value: 'suiseisha' },
  { label: 'Suzuki Mirano', value: 'suzuki-mirano' },
  { label: 'SYLD', value: 'syld' },
  { label: 'Tavac', value: 'tavac' },
  { label: 'TheCount', value: 'thecount' },
  { label: 'Thelewdcook', value: 'thelewdcook' },
  { label: 't japan', value: 't-japan' },
  { label: 'TOHO animation', value: 'toho-animation' },
  { label: 'Toranoana', value: 'toranoana' },
  { label: 'Torudaya', value: 'torudaya' },
  { label: 'Toshiba Entertainment', value: 'toshiba-entertainment' },
  { label: 'T-Rex', value: 't-rex' },
  { label: 'TR Sensual Studio', value: 'tr-sensual-studio' },
  { label: 'Umemaro 3D', value: 'umemaro-3d' },
  { label: 'Union Cho', value: 'union-cho' },
  { label: 'Valkyria', value: 'valkyria' },
  { label: 'ViciNeko', value: 'vicineko' },
  { label: 'WHITE BEAR', value: 'white-bear' },
  { label: 'Wild Life', value: 'wild-life' },
  { label: 'XTER', value: 'xter' },
  { label: 'Y.O.U.C', value: 'y.o.u.c' },
  { label: 'ZIZ', value: 'ziz' },
  { label: 'ZMSFM', value: 'zmsfm' },
  { label: 'Zyc', value: 'zyc' },
  { label: 'なめらか動画部', value: 'なめらか動画部' },
];

const yearOptions: { label: string; value: string }[] = [
  { label: 'Tất cả', value: 'ALL' },
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
  { label: '2012', value: '2012' },
  { label: '2011', value: '2011' },
  { label: '2010', value: '2010' },
  { label: '2009', value: '2009' },
  { label: '2008', value: '2008' },
  { label: '2007', value: '2007' },
  { label: '2006', value: '2006' },
  { label: '2005', value: '2005' },
  { label: '2004', value: '2004' },
  { label: '2003', value: '2003' },
  { label: '2002', value: '2002' },
  { label: '2001', value: '2001' },
  { label: '2000', value: '2000' },
  { label: '1999', value: '1999' },
  { label: '1994', value: '1994' },
];

class HentaiZPlugin implements Plugin.PluginBase {
  id = 'hentaiz';
  name = 'HentaiZ';
  icon = 'src/vi/hentaiz/icon.png';
  site = SITE;
  version = '1.0.4';

  customJS = 'src/vi/hentaiz/player.js';

  imageRequestInit: Plugin.ImageRequestInit = {
    headers: {
      Referer: SITE + '/',
    },
  };

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

  filters = {
    sort: {
      type: FilterTypes.Picker,
      label: 'Sắp xếp',
      value: 'publishedAt_desc',
      options: [
        { label: 'Mới nhất', value: 'publishedAt_desc' },
        { label: 'Xem nhiều', value: 'views_desc' },
        { label: 'Tên A-Z', value: 'title_asc' },
      ],
    },
    animationType: {
      type: FilterTypes.Picker,
      label: 'Loại phim',
      value: 'ALL',
      options: [
        { label: 'Tất cả', value: 'ALL' },
        { label: 'Hentai 2D', value: 'TWO_D' },
        { label: 'Hentai 3D', value: 'THREE_D' },
        { label: 'Hentai Motion', value: 'MOTION' },
      ],
    },
    contentRating: {
      type: FilterTypes.Picker,
      label: 'Kiểm duyệt',
      value: 'ALL',
      options: [
        { label: 'Tất cả', value: 'ALL' },
        { label: 'Có che', value: 'CENSORED' },
        { label: 'Không che', value: 'UNCENSORED' },
      ],
    },
    isTrailer: {
      type: FilterTypes.Picker,
      label: 'Loại nội dung',
      value: 'ALL',
      options: [
        { label: 'Tất cả', value: 'ALL' },
        { label: 'Phim đầy đủ', value: 'false' },
        { label: 'Trailer', value: 'true' },
      ],
    },
    genres: {
      type: FilterTypes.CheckboxGroup,
      label: 'Thể loại',
      value: [],
      options: genreOptions,
    },
    excludeGenres: {
      type: FilterTypes.CheckboxGroup,
      label: 'Loại trừ',
      value: [],
      options: genreOptions,
    },
    studios: {
      type: FilterTypes.Picker,
      label: 'Hãng phim',
      value: 'ALL',
      options: studioOptions,
    },
    year: {
      type: FilterTypes.Picker,
      label: 'Năm',
      value: 'ALL',
      options: yearOptions,
    },
  } satisfies Filters;

  // ---------- helpers ----------

  private buildBrowseUrl(
    page: number,
    filterVals: {
      sort: string;
      animationType: string;
      contentRating: string;
      isTrailer: string;
      genres: string[];
      excludeGenres: string[];
      studios: string;
      year: string;
    },
    searchTerm?: string,
  ): string {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    params.set('sort', filterVals.sort);
    params.set('page', String(page));
    params.set('limit', '24');
    params.set('animationType', filterVals.animationType);
    params.set('contentRating', filterVals.contentRating);
    params.set('isTrailer', filterVals.isTrailer);
    params.set('year', filterVals.year);

    if (filterVals.genres.length > 0) {
      params.set('genres', ',' + filterVals.genres.join(','));
    }
    if (filterVals.excludeGenres.length > 0) {
      params.set('excludeGenres', ',' + filterVals.excludeGenres.join(','));
    }
    if (filterVals.studios && filterVals.studios !== 'ALL') {
      params.set('studios', ',' + filterVals.studios);
    }

    return `${SITE}/browse/__data.json?${params.toString()}`;
  }

  private parseBrowseData(data: any): Plugin.NovelItem[] {
    if (!data?.episodes) return [];
    const novels: Plugin.NovelItem[] = [];
    for (const ep of data.episodes) {
      if (!ep?.slug || !ep?.title) continue;
      const cover = ep.backdropImage?.filePath
        ? STORAGE_URL + ep.backdropImage.filePath
        : ep.posterImage?.filePath
          ? STORAGE_URL + ep.posterImage.filePath
          : defaultCover;
      novels.push({
        name: ep.title,
        path: '/watch/' + ep.slug,
        cover,
      });
    }
    return novels;
  }

  // ---------- popularNovels ----------

  async popularNovels(
    pageNo: number,
    { filters }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const url = this.buildBrowseUrl(pageNo, {
      sort: filters?.sort?.value || 'publishedAt_desc',
      animationType: filters?.animationType?.value || 'ALL',
      contentRating: filters?.contentRating?.value || 'ALL',
      isTrailer: filters?.isTrailer?.value || 'ALL',
      genres: (filters?.genres?.value as string[]) || [],
      excludeGenres: (filters?.excludeGenres?.value as string[]) || [],
      studios: (filters?.studios?.value as string) || 'ALL',
      year: filters?.year?.value || 'ALL',
    });

    const data = await fetchSvelteData(url);
    return this.parseBrowseData(data);
  }

  // ---------- searchNovels ----------

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = this.buildBrowseUrl(
      pageNo,
      {
        sort: 'publishedAt_desc',
        animationType: 'ALL',
        contentRating: 'ALL',
        isTrailer: 'ALL',
        genres: [],
        excludeGenres: [],
        studios: 'ALL',
        year: 'ALL',
      },
      searchTerm,
    );

    const data = await fetchSvelteData(url);
    return this.parseBrowseData(data);
  }

  // ---------- parseNovel ----------

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const slug = novelPath.replace('/watch/', '');
    const dataUrl = `${SITE}/watch/${slug}/__data.json`;
    const data = await fetchSvelteData(dataUrl);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: '',
    };

    if (!data?.episode) return novel;

    const ep = data.episode;
    novel.name = ep.title || '';
    novel.summary = ep.description
      ? decodeHtmlEntities(
          (ep.description as string)
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ''),
        )
      : '';

    // Detail endpoint has no images; cover is fetched from browse data below
    novel.cover = ep.posterImage?.filePath
      ? STORAGE_URL + ep.posterImage.filePath
      : ep.backdropImage?.filePath
        ? STORAGE_URL + ep.backdropImage.filePath
        : defaultCover;

    if (ep.genres && Array.isArray(ep.genres)) {
      novel.genres = ep.genres
        .map((g: any) => g?.genre?.name)
        .filter(Boolean)
        .join(', ');
    }

    if (ep.studios && Array.isArray(ep.studios)) {
      novel.author = ep.studios
        .map((s: any) => s?.studio?.name)
        .filter(Boolean)
        .join(', ');
    }

    if (ep.contentRating) {
      novel.artist = ep.contentRating;
    }

    novel.status = NovelStatus.Completed;

    // Fetch all episodes of the same series by searching for the title
    const chapters: Plugin.ChapterItem[] = [];
    const seriesTitle = ep.title || '';

    if (seriesTitle) {
      const searchUrl = this.buildBrowseUrl(
        1,
        {
          sort: 'publishedAt_desc',
          animationType: 'ALL',
          contentRating: 'ALL',
          isTrailer: 'ALL',
          genres: [],
          excludeGenres: [],
          studios: 'ALL',
          year: 'ALL',
        },
        seriesTitle,
      );

      const browseData = await fetchSvelteData(searchUrl);
      if (browseData?.episodes) {
        const seriesEps = browseData.episodes.filter(
          (e: any) => e?.title === seriesTitle,
        );

        // Get cover from browse data (detail endpoint has no images)
        if (novel.cover === defaultCover && seriesEps.length > 0) {
          const firstEp = seriesEps[0];
          if (firstEp.backdropImage?.filePath) {
            novel.cover = STORAGE_URL + firstEp.backdropImage.filePath;
          } else if (firstEp.posterImage?.filePath) {
            novel.cover = STORAGE_URL + firstEp.posterImage.filePath;
          }
        }

        seriesEps
          .sort(
            (a: any, b: any) => (a.episodeNumber || 0) - (b.episodeNumber || 0),
          )
          .forEach((e: any) => {
            chapters.push({
              name: `Tập ${e.episodeNumber || 1}`,
              path: '/watch/' + e.slug,
              chapterNumber: e.episodeNumber || 1,
            });
          });
      }
    }

    // Fallback: if search found nothing, add current episode
    if (chapters.length === 0) {
      const numMatch = slug.match(/-(\d+)$/);
      const epNum = numMatch ? parseInt(numMatch[1]) : 1;
      chapters.push({
        name: `Tập ${epNum}`,
        path: novelPath,
        chapterNumber: epNum,
      });
    }

    novel.chapters = chapters;
    return novel;
  }

  // ---------- parseChapter ----------

  async parseChapter(chapterPath: string): Promise<string> {
    const slug = chapterPath.replace('/watch/', '');
    const dataUrl = `${SITE}/watch/${slug}/__data.json`;
    const data = await fetchSvelteData(dataUrl);

    const embedUrl = data?.episode?.embedUrl || '';

    if (!embedUrl) {
      return '<p style="color:#ff4444;font-size:14px;font-family:sans-serif;text-align:center;padding:16px;">Không tìm thấy nguồn phát video.</p><meta id="no-cache-marker"/><meta id="no-prefetch-marker"/>';
    }

    // Embed mode: plain iframe
    if (this.enableEmbed) {
      return this.buildPlayerHtml({ iframe: embedUrl });
    }

    // M3U8 mode: decrypt video data server-side
    const idMatch = embedUrl.match(/[?&]v=([a-f0-9-]+)/i);
    const videoId = idMatch ? idMatch[1] : '';

    if (!videoId) {
      return this.buildPlayerHtml({ iframe: embedUrl });
    }

    const videoData = await decryptVideoData(videoId);
    if (!videoData) {
      return this.buildPlayerHtml({ iframe: embedUrl });
    }

    // Build absolute-URL m3u8 playlists and embed as JSON data attribute
    const rewrittenPlaylists: string[] = [];
    for (let i = 0; i < videoData.m3u8Playlists.length; i++) {
      const folder =
        videoData.variantFolders[i] || videoData.variantFolders[0] || '';
      const baseUrl = `${videoData.segDomain}/${videoData.id}/${folder}/`;
      const lines = videoData.m3u8Playlists[i].split('\n');
      const rewritten = lines
        .map(line => {
          const t = line.trim();
          return t && !t.startsWith('#') ? baseUrl + t : t;
        })
        .join('\n');
      rewrittenPlaylists.push(rewritten);
    }

    // Rewrite master playlist with placeholder variant indices
    const masterLines = videoData.m3u8Master.split('\n');
    let varIdx = 0;
    const rewrittenMaster = masterLines
      .map(line => {
        const t = line.trim();
        if (t && !t.startsWith('#') && t.includes('playlist.m3u8')) {
          return `__VARIANT_${varIdx++}__`;
        }
        return t;
      })
      .join('\n');

    return this.buildPlayerHtml({
      m3u8Master: rewrittenMaster,
      m3u8Playlists: rewrittenPlaylists,
    });
  }

  private buildPlayerHtml(opts: {
    iframe?: string;
    m3u8Master?: string;
    m3u8Playlists?: string[];
  }): string {
    const esc = (s: string) => encodeHtmlEntities(s);
    const attrs: string[] = ['id="htz-player-container"'];

    if (opts.iframe) attrs.push(`data-iframe="${esc(opts.iframe)}"`);
    if (opts.m3u8Master)
      attrs.push(`data-m3u8-master="${esc(opts.m3u8Master)}"`);
    if (opts.m3u8Playlists) {
      attrs.push(
        `data-m3u8-playlists="${esc(JSON.stringify(opts.m3u8Playlists))}"`,
      );
    }

    const mode = opts.m3u8Master ? 'Đang ở chế độ m3u8' : 'Đang ở chế độ embed';

    return [
      `<div ${attrs.join(' ')} style="position:relative;width:100%;padding-bottom:56.25%;background:#000;">`,
      '  <div id="htz-player-inner" style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">',
      '    <p style="color:#fff;font-family:sans-serif;">Đang tải video...</p>',
      '  </div>',
      '</div>',
      `<p style="color:#888;font-size:12px;font-family:sans-serif;text-align:center;margin:4px 0;">${mode}</p>`,
      '<meta id="no-cache-marker"/><meta id="no-prefetch-marker"/>',
    ].join('\n');
  }
}

export default new HentaiZPlugin();
