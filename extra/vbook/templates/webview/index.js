(function () {
  'use strict';
  var container = document.getElementById('vbook-player-container');
  var inner = document.getElementById('vbook-player-inner');
  var selector = document.getElementById('vbook-server-selector');
  if (!container || !inner) return;

  var serversStr = container.getAttribute('data-servers');
  if (!serversStr) {
    showError('Không tìm thấy link video.');
    return;
  }

  var servers;
  try {
    servers = JSON.parse(serversStr);
  } catch (e) {
    showError('Lỗi đọc danh sách server.');
    return;
  }
  if (servers.length === 0) {
    showError('Không có server nào hoạt động.');
    return;
  }

  var currentHls = null;

  function playTrack(track) {
    if (currentHls) {
      currentHls.destroy();
      currentHls = null;
    }
    inner.innerHTML = '';
    if (
      track.type === 'iframe' ||
      track.type === 'auto' ||
      track.type === 'embed'
    ) {
      inner.innerHTML =
        '<iframe src="' +
        escapeAttr(track.data) +
        '" style="width:100%;height:100%;border:none;" allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>';
    } else {
      buildVideoPlayer(inner, track.data);
    }
  }

  function renderServerSelector() {
    if (!selector || servers.length <= 1) return;
    var html =
      '<select id="vbook-server-select" style="padding: 5px; font-size: 14px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; outline: none; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">';
    for (var i = 0; i < servers.length; i++) {
      html +=
        '<option value="' +
        i +
        '">' +
        escapeAttr(servers[i].title || 'Server ' + (i + 1)) +
        '</option>';
    }
    html += '</select>';
    selector.innerHTML = html;
    document
      .getElementById('vbook-server-select')
      .addEventListener('change', function (e) {
        playTrack(servers[parseInt(e.target.value)]);
      });
  }

  renderServerSelector();
  playTrack(servers[0]);

  function showError(msg) {
    if (inner)
      inner.innerHTML =
        '<p style="color:#ff4444;font-family:sans-serif;text-align:center;padding:16px;">' +
        msg +
        '</p>';
  }

  function escapeAttr(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  function buildVideoPlayer(target, m3u8Url) {
    var video = document.createElement('video');
    video.controls = true;
    video.setAttribute('playsinline', '');
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.background = '#000';

    var lastSaveTime = 0;
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
            window.reader.post({
              type: 'save',
              data: Math.floor((currentTime / video.duration) * 100),
            });
          }
        }
      } catch (e) {}
    });

    video.addEventListener('ended', function () {
      try {
        if (window.reader && typeof window.reader.post === 'function') {
          window.reader.post({ type: 'save', data: 100 });
          if (window.reader.nextChapter) window.reader.post({ type: 'next' });
        }
      } catch (e) {}
    });

    loadHlsJs(function () {
      if (
        typeof Hls !== 'undefined' &&
        Hls.isSupported() &&
        m3u8Url.indexOf('.m3u8') !== -1
      ) {
        var hls = new Hls({ maxBufferLength: 30 });
        hls.loadSource(m3u8Url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          video.play().catch(function () {});
        });
        currentHls = hls;
      } else if (
        video.canPlayType('application/vnd.apple.mpegurl') ||
        m3u8Url.indexOf('.mp4') !== -1
      ) {
        video.src = m3u8Url;
        video.addEventListener('loadedmetadata', function () {
          video.play().catch(function () {});
        });
      } else {
        showError('Trình duyệt không hỗ trợ phát định dạng video này.');
        return;
      }
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
    script.onload = callback;
    script.onerror = function () {
      showError('Không thể tải thư viện HLS.js.');
    };
    document.head.appendChild(script);
  }
})();
