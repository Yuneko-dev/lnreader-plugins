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

  var container = document.getElementById('htz-player-container');
  if (!container) return;

  var inner = document.getElementById('htz-player-inner');
  if (!inner) return;

  // ─── Priority 1: pre-decrypted m3u8 data ───────────────────────
  var masterData = container.getAttribute('data-m3u8-master');
  var playlistsData = container.getAttribute('data-m3u8-playlists');
  if (masterData && playlistsData) {
    try {
      var playlists = JSON.parse(playlistsData);
      playM3u8(masterData, playlists);
    } catch (e) {
      console.error('[HTZ] Failed to parse m3u8 data:', e);
      showError('Không thể phân tích dữ liệu m3u8.');
    }
    return;
  }

  // ─── Priority 2: iframe embed ──────────────────────────────────
  var iframeSrc = container.getAttribute('data-iframe');
  if (iframeSrc) {
    console.log('[HTZ] Embedding iframe:', iframeSrc.substring(0, 80));
    inner.innerHTML =
      '<iframe src="' +
      escapeAttr(iframeSrc) +
      '" style="width:100%;height:100%;border:none;" ' +
      'allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>';
    return;
  }

  showError('Thiếu thông tin tập phim.');

  // ─── Build m3u8 blob URLs and play ─────────────────────────────
  function playM3u8(master, variantPlaylists) {
    // Create blob URLs for each variant playlist
    var variantBlobUrls = [];

    for (const variantBlobUrl of variantPlaylists) {
      const blob = new Blob([variantBlobUrl], {
        type: 'application/vnd.apple.mpegurl',
      });
      variantBlobUrls.push(URL.createObjectURL(blob));
    }

    // Replace __VARIANT_N__ placeholders in master with blob URLs
    var rewrittenMaster = master;
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

    console.log('[HTZ] Master m3u8 ready, variants:', variantBlobUrls.length);
    buildVideoPlayer(inner, masterUrl);
  }

  // ─── Utilities ─────────────────────────────────────────────────
  function showError(msg) {
    if (inner) {
      inner.innerHTML =
        '<p style="color:#ff4444;font-family:sans-serif;text-align:center;padding:16px;">' +
        msg +
        '</p>';
    }
  }

  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // ─── Video player builder ─────────────────────────────────────
  function buildVideoPlayer(target, m3u8Url) {
    var video = document.createElement('video');
    video.controls = true;
    video.setAttribute('playsinline', '');
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.background = '#000';

    // --- Đồng bộ tiến độ xem với app gốc ---
    var hasSeekedInitial = false;
    var lastSaveTime = 0;

    video.addEventListener('loadedmetadata', function () {
      try {
        if (
          !hasSeekedInitial &&
          video.duration > 0 &&
          window.reader &&
          window.reader.chapter
        ) {
          var initialProgress = window.reader.chapter.progress || 0;
          if (initialProgress > 0 && initialProgress < 100) {
            video.currentTime = Math.floor(
              (initialProgress / 100) * video.duration,
            );
          }
          hasSeekedInitial = true;
        }
      } catch (e) {
        console.warn('[HTZ] Lỗi khi khôi phục tiến độ:', e);
      }
    });

    video.addEventListener('timeupdate', function () {
      try {
        if (
          video.duration > 0 &&
          window.reader &&
          typeof window.reader.post === 'function'
        ) {
          var currentTime = video.currentTime;
          if (Math.abs(currentTime - lastSaveTime) >= 5) {
            lastSaveTime = currentTime;
            var progressInt = Math.floor((currentTime / video.duration) * 100);
            window.reader.post({
              type: 'save',
              data: progressInt,
            });
          }
        }
      } catch (e) {
        // Bỏ qua lỗi
      }
    });

    video.addEventListener('ended', function () {
      try {
        if (window.reader && typeof window.reader.post === 'function') {
          // mark as completed
          window.reader.post({
            type: 'save',
            data: 100,
          });
          // move to next chapter
          if (window.reader.nextChapter) window.reader.post({ type: 'next' });
        }
      } catch (e) {
        // Bỏ qua lỗi
      }
    });

    // ----------------------------------------

    loadHlsJs(function () {
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        var hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          xhrSetup: function (xhr) {
            xhr.withCredentials = false;
          },
        });
        hls.loadSource(m3u8Url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          console.log('[HTZ] HLS manifest parsed, levels:', hls.levels.length);
          video.play().catch(function () {});
        });
        hls.on(Hls.Events.ERROR, function (event, data) {
          console.error('[HTZ HLS] error:', data.type, data.details);
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              console.log('[HTZ HLS] network error, retrying…');
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              console.log('[HTZ HLS] media error, recovering…');
              hls.recoverMediaError();
            } else {
              hls.destroy();
              showError('Lỗi phát video HLS.');
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = m3u8Url;
        video.addEventListener('loadedmetadata', function () {
          video.play().catch(function () {});
        });
      } else {
        showError('Trình duyệt không hỗ trợ phát HLS.');
        return;
      }

      target.innerHTML = '';
      target.appendChild(video);
    });
  }

  function loadHlsJs(callback) {
    if (typeof Hls !== 'undefined') {
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.6.16/dist/hls.min.js';
    script.onload = function () {
      console.log('[HTZ] HLS.js loaded');
      callback();
    };
    script.onerror = function () {
      console.error('[HTZ] Failed to load HLS.js');
      showError('Không thể tải thư viện HLS.js.');
    };
    document.head.appendChild(script);
  }
})();
