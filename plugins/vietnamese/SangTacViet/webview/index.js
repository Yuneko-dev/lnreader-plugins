// ── Shared helpers ──

function doRefetch() {
  try {
    if (
      typeof window.reader !== 'undefined' &&
      typeof window.reader.refetch === 'function'
    ) {
      window.reader.refetch();
    } else {
      console.warn('[STV] window.reader.refetch not available');
    }
  } catch (e) {
    console.error('[STV] refetch error:', e);
  }
}

function verifyToken(token, provider) {
  return fetch('/index.php?ngmar=verifyca', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      'ajax=verifycaptcha&token=' +
      encodeURIComponent(token) +
      '&purpose=read&provider=' +
      encodeURIComponent(provider),
  }).then(function (r) {
    return r.text();
  });
}

// ── Cloudflare Turnstile (auto-solves invisibly) ──

var TURNSTILE_SITEKEY = '0x4AAAAAABVjME7NHipdnj-c';
var turnstileTimeout = null;

function tryTurnstile(placeholder) {
  return new Promise(function (resolve) {
    // Timeout — fall back to image captcha after 10s
    turnstileTimeout = setTimeout(function () {
      console.warn('[STV] Turnstile timeout, falling back to image captcha');
      resolve(false);
    }, 10000);

    var container = document.createElement('div');
    container.id = 'turnstile-box';
    placeholder.appendChild(container);

    var script = document.createElement('script');
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;

    script.onload = function () {
      try {
        turnstile.render('#turnstile-box', {
          sitekey: TURNSTILE_SITEKEY,
          callback: function (token) {
            clearTimeout(turnstileTimeout);
            verifyToken(token, 'cloudflare').then(function (text) {
              if (text.trim() === 'success') {
                doRefetch();
                resolve(true);
              } else {
                console.warn('[STV] Turnstile verify failed:', text);
                resolve(false);
              }
            });
          },
          'error-callback': function () {
            clearTimeout(turnstileTimeout);
            console.warn('[STV] Turnstile error, falling back');
            resolve(false);
          },
        });
      } catch (e) {
        clearTimeout(turnstileTimeout);
        console.warn('[STV] Turnstile render error:', e);
        resolve(false);
      }
    };

    script.onerror = function () {
      clearTimeout(turnstileTimeout);
      console.warn('[STV] Turnstile script failed to load');
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

// ── Image captcha fallback ──

var captchaHTML =
  '<div>' +
  '<div class="captcha-container">' +
  '<div class="captcha-header">Captcha</div>' +
  '<div class="captcha-body">' +
  '<input type="text" id="captcha-input" class="captcha-input" placeholder="Nhập mã xác thực"/>' +
  '<div class="captcha-image-wrapper">' +
  '<img id="captcha-image" src="" alt="Captcha" style="cursor:pointer" title="Nhấn để đổi ảnh mới"/>' +
  '</div>' +
  '<button id="captcha-btn" class="captcha-btn">Xác thực</button>' +
  '<div id="captcha-error" style="color:red;font-size:13px;text-align:center;display:none"></div>' +
  '</div>' +
  '</div>' +
  '<style>' +
  '.captcha-container{width:320px;border:1px solid #d1d1d1;border-radius:5px;overflow:hidden;font-family:inherit;background:#fff}' +
  '.captcha-header{background:#f0f0f0;padding:10px 15px;font-weight:bold;color:#111;font-size:15px}' +
  '.captcha-body{padding:12px;display:flex;flex-direction:column;gap:12px}' +
  '.captcha-input{width:100%;padding:10px;border:1px solid transparent;background:#f5f5f5;border-radius:4px;text-align:center;font-size:14px;color:#111;box-sizing:border-box;outline:none}' +
  '.captcha-input:focus{border-color:#ccc}' +
  '.captcha-image-wrapper{width:100%;border-radius:4px;overflow:hidden;background:#f8f9fa;display:flex;justify-content:center;align-items:center}' +
  '.captcha-image-wrapper img{width:100%;height:auto;display:block}' +
  '.captcha-btn{width:100%;padding:8px;background:#f2f2f2;border:1px solid #d1d1d1;border-radius:4px;font-weight:bold;color:#555;cursor:pointer;font-size:14px}' +
  '.captcha-btn:hover{background:#e5e5e5}' +
  '</style>' +
  '</div>';

function showImageCaptcha(placeholder) {
  // Remove any turnstile remnant
  var old = document.getElementById('turnstile-box');
  if (old) old.remove();

  placeholder.innerHTML = captchaHTML;

  var img = document.getElementById('captcha-image');
  var input = document.getElementById('captcha-input');
  var btn = document.getElementById('captcha-btn');
  var err = document.getElementById('captcha-error');

  function refresh() {
    img.src = '/generate_captcha.php?random=' + Math.random();
    input.value = '';
  }

  img.addEventListener('click', refresh);
  btn.addEventListener('click', function () {
    var token = input.value.trim();
    if (!token || token.length < 4) {
      err.textContent = 'Mã xác thực phải có ít nhất 4 ký tự!';
      err.style.display = 'block';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Đang kiểm tra...';
    err.style.display = 'none';

    verifyToken(token, 'sangtacviet')
      .then(function (text) {
        if (text.trim() === 'success') {
          doRefetch();
        } else {
          err.textContent = 'Mã xác thực không chính xác, vui lòng thử lại.';
          err.style.display = 'block';
          refresh();
        }
      })
      .catch(function () {
        err.textContent = 'Đã có lỗi xảy ra khi kết nối tới máy chủ.';
        err.style.display = 'block';
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Xác thực';
      });
  });

  refresh();
}

// ── Entry point ──

document.addEventListener('DOMContentLoaded', function () {
  var placeholder = document.getElementById('captcha-placeholder');
  if (!placeholder) return;

  placeholder.textContent = 'Đang xác thực...';

  // Try invisible Turnstile first; fall back to image captcha
  tryTurnstile(placeholder).then(function (solved) {
    if (!solved) {
      showImageCaptcha(placeholder);
    }
  });
});
