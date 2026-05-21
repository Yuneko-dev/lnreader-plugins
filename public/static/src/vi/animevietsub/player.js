/* eslint-disable */

/**
 * AnimeVietsub - WebView Video Player (customJS)
 *
 * Runs inside the WebView/browser context after parseChapter returns HTML.
 *
 * Priority:
 *   1. data-m3u8   → direct HLS.js playback (bypasses iframe adblock detection)
 *   2. data-sources → direct source playback
 *   3. data-iframe  → embed iframe
 *   4. data-hash    → AJAX /ajax/player fallback
 */
(function () {
  'use strict';

  var container = document.getElementById('avs-player-container');
  if (!container) return;

  var inner = document.getElementById('avs-player-inner');
  if (!inner) return;

  var embedEnabled = container.getAttribute('data-embed-enabled') === '1';
  var modeLabel = document.getElementById('avs-mode-label');
  var _debugLog = [];

  // ─── Fetch helper (uses reader.fetch proxy to bypass CORS) ──────
  function nativeFetch(url, headers) {
    var fetchFn = (window.reader && window.reader.fetch) || fetch;
    return fetchFn(url, { credentials: 'include', headers: headers }).then(
      function (r) {
        var h = {};
        r.headers.forEach(function (v, k) {
          h[k.toLowerCase()] = v;
        });
        return r.text().then(function (t) {
          return { status: r.status, text: t, headers: h };
        });
      },
    );
  }

  // ─── Priority 1: direct m3u8 URL (from parseChapter extraction) ──
  var m3u8 = container.getAttribute('data-m3u8');
  if (m3u8) {
    console.log('[AVS] Playing m3u8 directly:', m3u8.substring(0, 80) + '…');
    buildVideoPlayer(inner, [{ file: m3u8, type: 'hls' }]);
    return;
  }

  // ─── Priority 2: pre-parsed sources array ────────────────────────
  var sourcesRaw = container.getAttribute('data-sources');
  if (sourcesRaw) {
    try {
      var sources = JSON.parse(sourcesRaw);
      console.log('[AVS] Playing parsed sources:', sources.length);
      buildVideoPlayer(inner, sources);
      return;
    } catch (e) {
      console.warn('[AVS] Failed to parse data-sources:', e);
    }
  }

  // ─── Priority 3: iframe embed ────────────────────────────────────
  var iframeSrc = container.getAttribute('data-iframe');
  if (iframeSrc) {
    if (iframeSrc.indexOf('googleapiscdn.com') !== -1) {
      console.log('[AVS] googleapiscdn detected, trying token extraction…');
      tryGoogleApisCdn(iframeSrc, inner);
      return;
    }
    if (!embedEnabled) {
      showError(
        'Nguồn này chỉ hỗ trợ embed. Bật "Bật embed" trong cài đặt plugin.',
      );
      if (modeLabel) modeLabel.textContent = '';
      return;
    }
    console.log('[AVS] Embedding iframe:', iframeSrc.substring(0, 80));
    inner.innerHTML =
      '<iframe src="' +
      escapeAttr(iframeSrc) +
      '" style="width:100%;height:100%;border:none;" ' +
      'allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>';
    if (modeLabel) modeLabel.textContent = 'Đang ở chế độ embed';
    return;
  }

  // ─── Priority 4: AJAX fallback with data-hash ────────────────────
  var hash = container.getAttribute('data-hash');
  var id = container.getAttribute('data-id');
  var referer = container.getAttribute('data-referer');
  var site = container.getAttribute('data-site');

  if (!hash || !site) {
    showError('Thiếu thông tin tập phim.');
    return;
  }

  callAjaxPlayer();

  function callAjaxPlayer() {
    var postBody = 'link=' + encodeURIComponent(hash);
    if (id) postBody += '&id=' + encodeURIComponent(id);

    console.log('[AVS] AJAX fallback: calling /ajax/player…');
    fetch(site + '/ajax/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: referer || site + '/',
        Origin: site,
      },
      body: postBody,
      credentials: 'include',
    })
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        console.log('[AVS] /ajax/player response:', text.slice(0, 300));

        var json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          console.warn('[AVS] Non-JSON response');
          showError('Không thể phân tích phản hồi từ server.');
          return;
        }

        if (!json || !json.success) {
          showError('Server trả về lỗi.');
          return;
        }

        handlePlayerResponse(json);
      })
      .catch(function (err) {
        console.error('[AVS] /ajax/player error:', err);
        showError('Không thể kết nối tới server.');
      });
  }

  function handlePlayerResponse(json) {
    // iframe player
    if (json.playTech === 'iframe' && typeof json.link === 'string') {
      if (json.link.indexOf('googleapiscdn.com') !== -1) {
        console.log(
          '[AVS] AJAX returned googleapiscdn, trying token extraction…',
        );
        tryGoogleApisCdn(json.link, inner);
        return;
      }
      if (!embedEnabled) {
        showError(
          'Nguồn này chỉ hỗ trợ embed. Bật "Bật embed" trong cài đặt plugin.',
        );
        if (modeLabel) modeLabel.textContent = '';
        return;
      }
      inner.innerHTML =
        '<iframe src="' +
        escapeAttr(json.link) +
        '" style="width:100%;height:100%;border:none;" ' +
        'allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>';
      if (modeLabel) modeLabel.textContent = 'Đang ở chế độ embed';
      return;
    }

    // sources array
    if (Array.isArray(json.link)) {
      buildVideoPlayer(inner, json.link);
      return;
    }

    // single source string
    if (typeof json.link === 'string') {
      var link = json.link.replace(/^&http/, 'http');
      if (/\.m3u8(\?|$)/i.test(link)) {
        buildVideoPlayer(inner, [{ file: link, type: 'hls' }]);
      } else if (/\.(mp4|webm)(\?|$)/i.test(link)) {
        buildVideoPlayer(inner, [{ file: link }]);
      } else if (embedEnabled) {
        inner.innerHTML =
          '<iframe src="' +
          escapeAttr(link) +
          '" style="width:100%;height:100%;border:none;" ' +
          'allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>';
        if (modeLabel) modeLabel.textContent = 'Đang ở chế độ embed';
      } else {
        showError(
          'Nguồn này chỉ hỗ trợ embed. Bật "Bật embed" trong cài đặt plugin.',
        );
        if (modeLabel) modeLabel.textContent = '';
      }
      return;
    }

    showError('Định dạng phát không được hỗ trợ.');
  }

  // ─── googleapiscdn: two-layer m3u8 decryption ─────────────────
  //
  // Layer 1: AES-GCM decrypt concatenated _t params → intermediate m3u8
  // Layer 2: AES-CTR decrypt segment URLs → real CDN URLs
  //
  // If any phase fails, fall back to iframe embed.
  function tryGoogleApisCdn(playerUrl, target) {
    // Create hidden iframe to solve Cloudflare challenge
    var iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    iframe.src = playerUrl;
    (document.body || document.documentElement).appendChild(iframe);

    // Wait for Cloudflare, then try fetch
    var cfWait = 4000; // 4s for CF challenge
    debugLog('Đợi CF ' + cfWait + 'ms…');
    setTimeout(function () {
      debugLog('CF done, fetching page…');
      fetchPlayerPage(playerUrl, target, iframe);
    }, cfWait);
  }

  function fetchPlayerPage(playerUrl, target, iframe) {
    // Use native fetch bridge to bypass CORS
    // React Native reads cookies from CookieManager (shared with WebView)
    // so Cloudflare cf_clearance cookie is included automatically
    nativeFetch(playerUrl, { Referer: playerUrl })
      .then(function (res) {
        if (res.status !== 200)
          throw new Error(
            'HTTP ' + res.status + ' (len=' + (res.text || '').length + ')',
          );
        var html = res.text;
        debugLog('Page OK, size=' + html.length);
        cleanupIframe(iframe);

        // Extract avsToken from inline script
        var tokenMatch = html.match(/const\s+avsToken\s*=\s*"([^"]+)"/);
        if (!tokenMatch) {
          debugLog('No avsToken! First 150: ' + html.substring(0, 150));
          return;
        }
        var avsToken = tokenMatch[1];
        debugLog('Token: ' + avsToken.substring(0, 30) + '…');

        // Extract video hash from URL
        var hashMatch = playerUrl.match(/\/player\/([0-9a-f]+)/);
        if (!hashMatch) {
          fallbackToEmbed(playerUrl, target);
          return;
        }
        var videoHash = hashMatch[1];

        // Fetch m3u8 with token
        debugLog('Fetching m3u8…');

        var baseUrl = playerUrl.match(/^(https?:\/\/[^/]+)/)[1];
        var m3u8Url =
          baseUrl +
          '/playlist/' +
          videoHash +
          '/playlist.m3u8?token=' +
          encodeURIComponent(avsToken);

        return nativeFetch(m3u8Url, { Referer: playerUrl }).then(
          function (m3u8Res) {
            var m3u8Text = m3u8Res.text;
            var m3u8Headers = m3u8Res.headers || {};
            debugLog('m3u8 OK, size=' + m3u8Text.length);
            processEncryptedM3u8(
              m3u8Text,
              m3u8Headers,
              avsToken,
              playerUrl,
              target,
            );
          },
        );
      })
      .catch(function (err) {
        cleanupIframe(iframe);
        debugLog('Fetch fail: ' + err.message);
      });
  }

  // ─── Crypto helpers (ported from avs-loader.min.js v1.12.16) ──────
  function b64urlDecode(str) {
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    s += '=='.slice(0, (4 - (s.length % 4)) % 4);
    var binary = atob(s);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function lcgNext(state) {
    return (Math.imul(state, 1664525) + 1013904223) >>> 0;
  }

  function stringUnshuffle(str, seed) {
    var chars = str.split('');
    var len = chars.length;
    var state = parseInt(seed.substring(0, 8), 16) >>> 0;
    var swaps = [];
    for (var i = len - 1; i > 0; i--) {
      state = lcgNext(state);
      swaps.push([i, state % (i + 1)]);
    }
    for (var k = swaps.length - 1; k >= 0; k--) {
      var a = swaps[k][0],
        b = swaps[k][1];
      var tmp = chars[a];
      chars[a] = chars[b];
      chars[b] = tmp;
    }
    return chars.join('');
  }

  function createPRNG(seed) {
    var hash = 2166136261;
    for (var i = 0; i < seed.length; i++) {
      hash = (hash ^ (seed.charCodeAt(i) & 255)) >>> 0;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    var state = hash >>> 0 || 1;
    return function () {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state >>>= 0;
      state ^= state << 5;
      return (state >>>= 0);
    };
  }

  function descramble(data, permKey, permSalt) {
    var input = data instanceof Uint8Array ? data : new Uint8Array(data);
    var len = input.length;
    var output = new Uint8Array(len);
    if (len === 0) return output.buffer;
    var rng = createPRNG(permKey + '|' + permSalt);
    var perm = new Uint32Array(len);
    for (var i = 0; i < len; i++) perm[i] = i;
    for (var i = len - 1; i > 0; i--) {
      var j = rng() % (i + 1);
      var t = perm[i];
      perm[i] = perm[j];
      perm[j] = t;
    }
    var xorState = 0;
    for (var i = 0; i < len; i++) {
      if (!(i & 3)) xorState = rng();
      output[perm[i]] = input[i] ^ ((xorState >>> (8 * (i & 3))) & 255);
    }
    return output.buffer;
  }

  // ─── Two-layer m3u8 decryption ──────────────────────────────────
  function processEncryptedM3u8(
    m3u8Text,
    m3u8Headers,
    avsToken,
    playerUrl,
    target,
  ) {
    debugLog('Decrypting (2-layer)…');

    // Parse JWT → jti
    var jwtParts = avsToken.split('.');
    var payload;
    try {
      payload = JSON.parse(atob(jwtParts[1]));
    } catch (e) {
      debugLog('JWT parse failed');
      fallbackToEmbed(playerUrl, target);
      return;
    }
    var jti = payload.jti;
    debugLog('JTI: ' + jti.substring(0, 20) + '…');

    // Extract jtiOdd (every odd-indexed char → 64-char hex string)
    var jtiOdd = '';
    for (var k = 0; k < jti.length; k++) {
      if (k % 2 === 1) jtiOdd += jti[k];
    }

    // Read session params from m3u8 response headers
    var cn = m3u8Headers['x-edge-tag'] || '';
    var sk = m3u8Headers['x-cache-node'] || '';
    var ts = m3u8Headers['x-request-trace'] || '0';
    var uid = '';
    try {
      uid = decodeURIComponent(m3u8Headers['x-proxy-digest'] || 'anon');
    } catch (e) {
      uid = 'anon';
    }
    debugLog(
      'cn=' + cn.substring(0, 16) + ' sk=' + sk.substring(0, 16) + ' ts=' + ts,
    );

    if (!cn || !sk) {
      // Try envelope header (base64url-encoded JSON with cn, sk, ts, uid)
      var envHeader =
        m3u8Headers['x-avs-envelope'] || m3u8Headers['x-stream-envelope'] || '';
      if (envHeader) {
        try {
          var envJson = JSON.parse(
            new TextDecoder().decode(b64urlDecode(envHeader)),
          );
          cn = envJson.cn || cn;
          sk = envJson.sk || sk;
          ts = envJson.ts || ts;
          uid = envJson.uid || uid;
        } catch (e) {
          /* envelope parse failed */
        }
      }
    }

    if (!cn || !sk) {
      debugLog('No cn/sk → cannot decrypt');
      fallbackToEmbed(playerUrl, target);
      return;
    }

    // ── Layer 1: AES-GCM batch decrypt of _t values ──
    var lines = m3u8Text.split('\n');
    var tValues = [];
    var headerLines = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.startsWith('#') || line.trim() === '') {
        if (
          !line.match(/^#EXTINF:/) &&
          !line.match(/^#EXT-X-ENDLIST/) &&
          !line.match(/^#EXT-X-KEY/)
        ) {
          headerLines.push(line);
        }
      } else {
        var tm = line.match(/[?&]_t=([^&\s]+)/);
        if (tm) tValues.push(tm[1]);
      }
    }

    debugLog('_t segments: ' + tValues.length);

    if (tValues.length === 0) {
      debugLog('No _t params in m3u8');
      fallbackToEmbed(playerUrl, target);
      return;
    }

    // Concatenate and unshuffle
    var concatenated = tValues.join('');
    var unshuffled = stringUnshuffle(concatenated, sk);

    // Base64url decode to get the encrypted blob
    var encryptedBlob;
    try {
      encryptedBlob = b64urlDecode(unshuffled);
    } catch (e) {
      debugLog('b64 decode failed: ' + e.message);
      fallbackToEmbed(playerUrl, target);
      return;
    }

    debugLog('Blob: ' + encryptedBlob.length + ' bytes');

    // Derive AES-GCM key: HMAC-SHA256(key=b64decode(cn), data="uid:ts:sk:0")
    var cnBytes = b64urlDecode(cn);
    var hmacDataStr = uid + ':' + ts + ':' + sk + ':0';
    var hmacData = new TextEncoder().encode(hmacDataStr);
    var iv = cnBytes.slice(0, 12);

    crypto.subtle
      .importKey('raw', cnBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
      ])
      .then(function (hmacKey) {
        return crypto.subtle.sign('HMAC', hmacKey, hmacData);
      })
      .then(function (gcmKeyBuf) {
        return crypto.subtle.importKey(
          'raw',
          gcmKeyBuf,
          { name: 'AES-GCM' },
          false,
          ['decrypt'],
        );
      })
      .then(function (gcmKey) {
        debugLog('AES-GCM decrypt ' + encryptedBlob.length + 'B…');
        return crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          gcmKey,
          encryptedBlob,
        );
      })
      .then(function (rawResult) {
        // Apply descrambler (crypto harden is active)
        var descrambled = descramble(rawResult, sk, ts);
        var intermediateM3u8 = new TextDecoder().decode(descrambled);
        debugLog(
          'Intermediate: ' +
            intermediateM3u8.length +
            'ch, first80=' +
            intermediateM3u8.substring(0, 80),
        );

        if (intermediateM3u8.length < 10) {
          debugLog('Intermediate too short');
          fallbackToEmbed(playerUrl, target);
          return;
        }

        // ── Layer 2: AES-CTR decrypt segment URLs ──
        decryptSegmentUrls(
          intermediateM3u8,
          headerLines,
          jtiOdd,
          playerUrl,
          target,
        );
      })
      .catch(function (err) {
        debugLog('Layer 1 (GCM) failed: ' + ((err && err.message) || err));
        fallbackToEmbed(playerUrl, target);
      });
  }

  function decryptSegmentUrls(
    intermediateM3u8,
    headerLines,
    jtiOdd,
    playerUrl,
    target,
  ) {
    var lines = intermediateM3u8.split('\n');
    var segments = [];

    // Parse /hls/{fileId}.ts?e=...&i=...  or absolute URLs with same pattern
    var hlsRe = /\/hls\/([0-9a-f]{24})\.ts[^#\s]*/;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.startsWith('#') || line === '') continue;

      var m = line.match(hlsRe);
      if (m) {
        // Extract query params from URL
        var qIdx = line.indexOf('?');
        var params = {};
        if (qIdx !== -1) {
          line
            .substring(qIdx + 1)
            .split('&')
            .forEach(function (p) {
              var eq = p.indexOf('=');
              if (eq !== -1) params[p.substring(0, eq)] = p.substring(eq + 1);
            });
        }
        segments.push({
          fileId: m[1],
          e: params.e || '',
          i: parseInt(params.i || '0', 10),
          lineIdx: i,
        });
      }
    }

    debugLog('Segments to decrypt: ' + segments.length);

    if (segments.length === 0) {
      // Intermediate m3u8 might already have direct URLs (no /hls/ pattern)
      debugLog('No /hls/ segments in intermediate m3u8');
      fallbackToEmbed(playerUrl, target);
      return;
    }

    // Derive AES-CTR key per fileId (usually all same)
    var hmacKeyBytes = new TextEncoder().encode(jtiOdd);
    var keyCache = {};

    function deriveCtrKey(fileId) {
      if (keyCache[fileId]) return Promise.resolve(keyCache[fileId]);
      var signData = new TextEncoder().encode('url-cipher|' + fileId);
      return crypto.subtle
        .importKey(
          'raw',
          hmacKeyBytes,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        )
        .then(function (k) {
          return crypto.subtle.sign('HMAC', k, signData);
        })
        .then(function (buf) {
          return crypto.subtle.importKey(
            'raw',
            buf,
            { name: 'AES-CTR' },
            false,
            ['decrypt'],
          );
        })
        .then(function (ctrKey) {
          keyCache[fileId] = ctrKey;
          return ctrKey;
        });
    }

    // Decrypt all segments
    var promises = segments.map(function (seg) {
      return deriveCtrKey(seg.fileId).then(function (ctrKey) {
        var encrypted = b64urlDecode(seg.e);
        var counter = new Uint8Array(16);
        var idx = seg.i;
        counter[12] = (idx >>> 24) & 0xff;
        counter[13] = (idx >>> 16) & 0xff;
        counter[14] = (idx >>> 8) & 0xff;
        counter[15] = idx & 0xff;
        return crypto.subtle
          .decrypt(
            { name: 'AES-CTR', counter: counter, length: 64 },
            ctrKey,
            encrypted,
          )
          .then(function (dec) {
            return { lineIdx: seg.lineIdx, url: new TextDecoder().decode(dec) };
          });
      });
    });

    Promise.all(promises)
      .then(function (results) {
        var validCount = 0;
        var outLines = lines.slice(); // copy intermediate lines

        results.forEach(function (r) {
          if (r.url.indexOf('http') === 0) {
            outLines[r.lineIdx] = r.url;
            validCount++;
          }
        });

        debugLog('Decrypted ' + validCount + '/' + results.length + ' URLs');
        if (validCount === 0) {
          fallbackToEmbed(playerUrl, target);
          return;
        }

        // Build clean m3u8: header lines + decrypted segment lines
        var cleanLines = [];
        for (var i = 0; i < headerLines.length; i++)
          cleanLines.push(headerLines[i]);
        for (var i = 0; i < outLines.length; i++) {
          var l = outLines[i];
          if (!l) continue;
          if (
            l.indexOf('#EXT-X-KEY:') === 0 &&
            l.indexOf('urn:avs:shield') !== -1
          )
            continue;
          // Skip /hls/ placeholder lines that weren't decrypted
          if (l.match(/\/hls\/[0-9a-f]{24}\.ts/)) continue;
          cleanLines.push(l);
        }

        var cleanM3u8 = cleanLines.join('\n');
        var blob = new Blob([cleanM3u8], {
          type: 'application/vnd.apple.mpegurl',
        });
        var blobUrl = URL.createObjectURL(blob);

        if (modeLabel) modeLabel.textContent = 'Đang ở chế độ m3u8';
        buildVideoPlayer(target, [{ file: blobUrl, type: 'hls' }]);
      })
      .catch(function (err) {
        debugLog('Layer 2 (CTR) failed: ' + ((err && err.message) || err));
        fallbackToEmbed(playerUrl, target);
      });
  }

  function fallbackToEmbed(playerUrl, target) {
    if (!embedEnabled) {
      console.log('[AVS] Embed disabled, showing error');
      showError(
        'Không thể giải mã video. Bật "Bật embed" trong cài đặt plugin để xem qua iframe.',
      );
      if (modeLabel) modeLabel.textContent = '';
      return;
    }
    console.log('[AVS] Falling back to iframe embed');
    target.innerHTML =
      '<iframe src="' +
      escapeAttr(playerUrl) +
      '" style="width:100%;height:100%;border:none;" ' +
      'allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>';
    if (modeLabel) modeLabel.textContent = 'Đang ở chế độ embed';
  }

  function cleanupIframe(iframe) {
    try {
      iframe.src = 'about:blank';
    } catch (e) {}
    setTimeout(function () {
      try {
        iframe.remove();
      } catch (e) {}
    }, 200);
  }

  // ─── Utilities ──────────────────────────────────────────────────
  function debugLog(msg) {
    _debugLog.push(msg);
    console.log('[AVS] ' + msg);
    var el = document.getElementById('avs-debug-log');
    if (!el && inner) {
      inner.innerHTML =
        '<div id="avs-debug-log" style="color:#aaa;font-family:monospace;font-size:11px;padding:8px;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto;"></div>';
      el = document.getElementById('avs-debug-log');
    }
    if (el) el.textContent = _debugLog.join('\n');
  }
  function showError(msg) {
    debugLog('ERROR: ' + msg);
  }

  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // ─── Video player builder ──────────────────────────────────────
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
        console.warn('[AVS] Lỗi khi khôi phục tiến độ:', e);
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
          // Custom fragment loader: strips 127-byte PNG prefix from each segment
          // (AnimeVietsub disguises TS segments with a PNG header)
          var AvsFragLoader = function (config) {
            var inner = new Hls.DefaultConfig.loader(config);
            Object.defineProperties(this, {
              stats: {
                get: function () {
                  return inner.stats;
                },
              },
              context: {
                get: function () {
                  return inner.context;
                },
              },
            });
            this.abort = function () {
              inner.abort();
            };
            this.destroy = function () {
              inner.destroy();
            };
            this.load = function (ctx, cfg, cbs) {
              var origSuccess = cbs.onSuccess;
              var modCbs = Object.assign({}, cbs, {
                onSuccess: function (resp, stats, ctx2, net) {
                  if (resp.data && resp.data.byteLength > 127) {
                    var header = new Uint8Array(resp.data, 0, 8);
                    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
                    var isPng =
                      header[0] === 0x89 &&
                      header[1] === 0x50 &&
                      header[2] === 0x4e &&
                      header[3] === 0x47 &&
                      header[4] === 0x0d &&
                      header[5] === 0x0a &&
                      header[6] === 0x1a &&
                      header[7] === 0x0a;
                    if (isPng) {
                      resp.data = resp.data.slice(127);
                    }
                  }
                  origSuccess(resp, stats, ctx2, net);
                },
              });
              inner.load(ctx, cfg, modCbs);
            };
          };

          var hlsCfg = {
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            xhrSetup: function (xhr) {
              xhr.withCredentials = false;
            },
            fLoader: AvsFragLoader,
          };
          var hls = new Hls(hlsCfg);
          hls.loadSource(hlsSources[0].file);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, function () {
            video.play().catch(function () {});
          });
          hls.on(Hls.Events.ERROR, function (event, data) {
            console.error('[AVS HLS] error:', data.type, data.details);
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                console.log('[AVS HLS] network error, retrying…');
                hls.startLoad();
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                console.log('[AVS HLS] media error, recovering…');
                hls.recoverMediaError();
              } else {
                hls.destroy();
                if (otherSources.length > 0) {
                  appendMp4Sources(video, otherSources);
                } else {
                  showError('Lỗi phát video HLS.');
                }
              }
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = hlsSources[0].file;
          video.addEventListener('loadedmetadata', function () {
            video.play().catch(function () {});
          });
        } else if (otherSources.length > 0) {
          appendMp4Sources(video, otherSources);
        } else {
          showError('Trình duyệt không hỗ trợ phát HLS.');
          return;
        }

        target.innerHTML = '';
        target.appendChild(video);
      });
    } else {
      appendMp4Sources(video, otherSources);
      target.innerHTML = '';
      target.appendChild(video);
    }
  }

  function appendMp4Sources(video, sources) {
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
      console.log('[AVS] HLS.js loaded');
      callback();
    };
    script.onerror = function () {
      console.error('[AVS] Failed to load HLS.js');
      showError('Không thể tải thư viện HLS.js.');
    };
    document.head.appendChild(script);
  }
})();
