export let playerContainer: HTMLElement | null = null;

export function initUtils(container: HTMLElement) {
  playerContainer = container;
}

export function debugLog(msg: string) {
  window.LNReaderPlayer!.log(msg);
}

export function showError(msg: string) {
  debugLog('ERROR: ' + msg);
}

export function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function cleanupIframe(iframe: HTMLIFrameElement) {
  try {
    iframe.src = 'about:blank';
  } catch (e) {
    //
  }
  setTimeout(function () {
    try {
      iframe.remove();
    } catch (e) {
      //
    }
  }, 200);
}
