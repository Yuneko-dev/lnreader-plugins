/* eslint-disable */

/**
 * HentaiZ - WebView Video Player (customJS)
 *
 * Runs inside the WebView/browser context after parseChapter returns HTML.
 * All decryption is done server-side in the plugin code.
 *
 * Priority:
 *   1. data-m3u8-master + data-m3u8-playlists → pre-decrypted HLS playback
 *   2. data-iframe → embed iframe
 */
(function () {
  'use strict';
  if (!window.LNReaderPlayer) return;

  var container = document.getElementById('htz-player-container');
  if (!container) return;

  var masterData = container.getAttribute('data-m3u8-master');
  var playlistsData = container.getAttribute('data-m3u8-playlists');

  if (masterData && playlistsData) {
    try {
      var playlists = JSON.parse(playlistsData);
      var variantBlobUrls = [];

      for (const variantBlobUrl of playlists) {
        const blob = new Blob([variantBlobUrl], {
          type: 'application/vnd.apple.mpegurl',
        });
        variantBlobUrls.push(URL.createObjectURL(blob));
      }

      var rewrittenMaster = masterData;
      for (var i = 0; i < variantBlobUrls.length; i++) {
        rewrittenMaster = rewrittenMaster.replace(
          '__VARIANT_' + i + '__',
          variantBlobUrls[i],
        );
      }

      var masterBlob = new Blob([rewrittenMaster], {
        type: 'application/vnd.apple.mpegurl',
      });
      var masterUrl = URL.createObjectURL(masterBlob);

      window.LNReaderPlayer.log('[HTZ] Master m3u8 ready');
      window.LNReaderPlayer.playHls(masterUrl);
    } catch (e) {
      window.LNReaderPlayer.log('[HTZ] Failed to parse m3u8 data: ' + e);
    }
  } else {
    window.LNReaderPlayer.log('[HTZ] Missing player data');
  }
})();
