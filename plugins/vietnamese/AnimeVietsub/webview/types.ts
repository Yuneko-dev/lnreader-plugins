/* eslint-disable */

export interface PlayerConfig {
  mode: string; // 'm3u8' or 'embed'
  playerType: string;
  debugEnabled: boolean;
  m3u8?: string | null;
  sourcesRaw?: string | null;
  iframeSrc?: string | null;
  ajaxHash?: string | null;
  ajaxId?: string | null;
  ajaxReferer?: string | null;
  ajaxSite?: string | null;
  bannerUrl?: string | null;
}

export interface MediaSource {
  file: string;
  type?: string;
  label?: string;
}

export type PlaybackType = 'iframe' | 'sources';

export interface ResolvedMedia {
  type: PlaybackType;
  iframeUrl?: string;
  sources?: MediaSource[];
}
