export let debugEnabled = false;
const _debugLog: string[] = [];
export let playerContainer: HTMLElement | null = null;

export function initUtils(container: HTMLElement, debug: boolean) {
  playerContainer = container;
  debugEnabled = debug;
}

export function debugLog(msg: string) {
  _debugLog.push(msg);
  console.log('[AVS] ' + msg);
  if (!debugEnabled || !playerContainer) return;
  let el = document.getElementById('avs-debug-log');
  if (!el) {
    el = document.createElement('div');
    el.id = 'avs-debug-log';
    el.style.cssText = `
    background: #111;
    color: #aaa
    font-family: monospace;
    font-size: 11px;
    padding: 8px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 300px;
    overflow-y: auto;
    border-top: 1px solid #333;`;
    playerContainer.insertAdjacentElement('afterend', el);
  }
  el.textContent = _debugLog.join('\n');
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
