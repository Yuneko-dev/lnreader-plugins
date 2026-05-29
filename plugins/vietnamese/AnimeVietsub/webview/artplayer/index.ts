import Artplayer from '../modules/artplayer.min.cjs';
import artVi from '../modules/artplayer-i18n-vi';
import { m3u8CustomType } from './hls-custom-type';
import { setupArtplayerEvents } from './events';
import { themeColors } from './theme';
import icons from './icons';

export function initArtplayer(
  container: HTMLElement,
  initialUrl: string,
  initialType: string,
  bannerUrl?: string,
) {
  const art = new Artplayer({
    container: container,
    url: initialUrl,
    type: initialType,
    fullscreen: true,
    fullscreenWeb: false,
    autoSize: false,
    setting: true,
    playbackRate: true,
    autoPlayback: true,
    isLive: false,
    hotkey: true,
    backdrop: true,
    lang: 'vi',
    gesture: true,
    fastForward: true,
    theme: themeColors.primary,
    poster: bannerUrl,
    aspectRatio: true,
    i18n: {
      vi: artVi,
    },
    customType: {
      m3u8: m3u8CustomType,
    },
    controls: [
      {
        name: 'rewind5',
        position: 'right',
        html: icons.rewind5,
        tooltip: 'Tua lại 5s',
        style: {
          padding: '0',
        },
        click: function () {
          art.video.currentTime = Math.max(art.video.currentTime - 5, 0);
        },
      },
      {
        name: 'forward5',
        position: 'right',
        html: icons.forward5,
        tooltip: 'Tua tới 5s',
        style: {
          padding: '0',
        },
        click: function () {
          art.video.currentTime = Math.min(
            art.video.currentTime + 5,
            art.video.duration || 0,
          );
        },
      },
      {
        position: 'right',
        html: icons.skipOp,
        tooltip: 'Bỏ qua OP/ED (1m30s)',
        style: {
          padding: '0',
        },
        click: function () {
          art.video.currentTime = Math.min(
            art.video.currentTime + 90,
            art.video.duration || 0,
          );
          art.notice.show = 'Đã bỏ qua 1m30s';
        },
      },
    ],
  });

  // debug
  (window as any).art = art;

  setupArtplayerEvents(art);

  return art;
}
