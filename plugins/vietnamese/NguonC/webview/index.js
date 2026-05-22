/* eslint-disable */

/**
 * NguonC - WebView Video Player (customJS)
 *
 * Runs inside the WebView/browser context after parseChapter returns HTML.
 *
 * Priority:
 *   1. data-embed → embed iframe (most reliable)
 *   2. data-m3u8  → direct HLS.js playback (fallback)
 */
(function () {
  'use strict';

  var container = document.getElementById('nguonc-player-container');
  if (!container) return;

  var inner = document.getElementById('nguonc-player-inner');
  if (!inner) return;

  // ─── Priority 1: embed iframe (most reliable) ────────────────
  var embed = container.getAttribute('data-embed');
  if (embed) {
    console.log('[NguonC] Embedding iframe:', embed.substring(0, 80));
    inner.innerHTML =
      '<iframe src="' +
      escapeAttr(embed) +
      '" style="width:100%;height:100%;border:none;" ' +
      'sandbox="allow-scripts allow-same-origin allow-presentation" ' +
      'allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>';
    return;
  }

  // ─── Priority 2: direct m3u8 URL (fallback) ─────────────────
  var m3u8 = container.getAttribute('data-m3u8');
  if (m3u8) {
    console.log('[NguonC] Playing m3u8:', m3u8.substring(0, 80) + '…');
    buildVideoPlayer(inner, [{ file: m3u8, type: 'hls' }]);
    return;
  }

  showError('Không tìm thấy nguồn phát.');

  // ─── Utilities ────────────────────────────────────────────────
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

  // ─── Video player builder ────────────────────────────────────
  function buildVideoPlayer(target, sources) {
    var hlsSources = [];
    var otherSources = [];

    (sources || []).forEach(function (s) {
      var file = (s.file || '').replace(/^&http/, 'http');
      if (!file) return;
      if (s.type === 'hls' || /\.m3u8(\?|$)/i.test(file)) {
        hlsSources.push({ file: file, label: s.label || 'Auto' });
      } else {
        otherSources.push({
          file: file,
          type: s.type || 'mp4',
          label: s.label || '',
        });
      }
    });

    if (hlsSources.length === 0 && otherSources.length === 0) {
      showError('Không tìm thấy nguồn video.');
      return;
    }

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
        console.warn('[NguonC] Lỗi khi khôi phục tiến độ:', e);
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
          // Cập nhật tiến độ sau mỗi 5 giây
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

    if (hlsSources.length > 0) {
      loadHlsJs(function () {
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
          var hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            xhrSetup: function (xhr) {
              xhr.withCredentials = false;
            },
          });
          hls.loadSource(hlsSources[0].file);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, function () {
            video.play().catch(function () {});
          });
          hls.on(Hls.Events.ERROR, function (event, data) {
            console.error('[NguonC HLS] error:', data.type, data.details);
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                console.log('[NguonC HLS] network error, retrying…');
                hls.startLoad();
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                console.log('[NguonC HLS] media error, recovering…');
                hls.recoverMediaError();
              } else {
                hls.destroy();
                fallbackToEmbed(target);
              }
            }
          });

          target.innerHTML = '';
          target.appendChild(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = hlsSources[0].file;
          video.addEventListener('loadedmetadata', function () {
            video.play().catch(function () {});
          });
          target.innerHTML = '';
          target.appendChild(video);
        } else {
          fallbackToEmbed(target);
        }
      });
    } else {
      appendSources(video, otherSources);
      target.innerHTML = '';
      target.appendChild(video);
    }
  }

  function fallbackToEmbed(target) {
    var embedUrl = container.getAttribute('data-embed');
    if (embedUrl) {
      console.log('[NguonC] Falling back to embed iframe');
      target.innerHTML =
        '<iframe src="' +
        escapeAttr(embedUrl) +
        '" style="width:100%;height:100%;border:none;" ' +
        'sandbox="allow-scripts allow-same-origin allow-presentation" ' +
        'allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>';
    } else {
      showError('Lỗi phát video.');
    }
  }

  function appendSources(video, sources) {
    sources.forEach(function (s) {
      var source = document.createElement('source');
      source.src = s.file;
      source.type = 'video/' + s.type;
      if (s.label) source.setAttribute('label', s.label);
      video.appendChild(source);
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
      console.log('[NguonC] HLS.js loaded');
      callback();
    };
    script.onerror = function () {
      console.error('[NguonC] Failed to load HLS.js');
      fallbackToEmbed(inner);
    };
    document.head.appendChild(script);
  }
})();
