import Artplayer from '../modules/artplayer.min.cjs';
import artVi from '../modules/artplayer-i18n-vi';
import { m3u8CustomType } from './hls-custom-type';
import { setupArtplayerEvents } from './events';
import { themeColors } from './theme';
import icons from './icons';

class DoubleClick {
  timestamp = 0;
  dblclick() {
    const now = Date.now();
    const result = this.timestamp && now - this.timestamp <= 300;
    this.timestamp = now;
    return result;
  }
}
const ldb = new DoubleClick();
const rdb = new DoubleClick();

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
    layers: [
      {
        name: 'double-click-backward',
        html: '',
        style: {
          position: 'absolute',
          left: '0',
          top: '0',
          bottom: '0',
          width: '33%',
          height: '100%',
        },
        click: function () {
          if (ldb.dblclick()) {
            art.backward = 10;
            art.notice.show = 'Tua lại 10s';
          }
        },
      },
      {
        name: 'double-click-forward',
        html: '',
        style: {
          position: 'absolute',
          right: '0',
          top: '0',
          bottom: '0',
          width: '33%',
          height: '100%',
        },
        click: function () {
          if (rdb.dblclick()) {
            art.forward = 10;
            art.notice.show = 'Tua tới 10s';
          }
        },
      },
    ],
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
