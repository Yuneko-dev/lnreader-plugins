/* eslint-disable */
/// <reference types="webview" />

function hexToBytes(hexString: string) {
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return bytes;
}
function base64ToBytes(base64String: string) {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function initPlayer() {
    const container = document.getElementById('nguonc-player-container');
    if (!container || !window.LNReaderPlayer) return;
    const iframeUrl = container.getAttribute('data-iframe');
    const s = container.getAttribute('data-s');
    const h = container.getAttribute('data-h');
    const k = container.getAttribute('data-k');
    if (!iframeUrl) return;
    const urlObj = new URL(iframeUrl);
    const req = await window.reader.fetch(`${urlObj.origin}/${s}.m3u8`, {
        method: 'GET',
        headers: {
            Referer: urlObj.origin,
        },
        referrer: urlObj.origin,
    });
    const m3u8Content = await req.text();
    console.log(m3u8Content);
    const lines = m3u8Content.split('\n');
    let ivHex = '';
    let encryptedData = '';

    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('#ENC-AESGCM')) {
            const ivMatch = line.match(/iv=([a-fA-F0-9]+)/);
            if (ivMatch) ivHex = ivMatch[1];
        } else if (line && !line.startsWith('#')) {
            encryptedData = line;
        }
    }

    if (!ivHex || !encryptedData) {
        throw new Error('Định dạng tệp mã hóa không hợp lệ.');
    }

    const ivBytes = hexToBytes(ivHex);
    const encryptedBytes = base64ToBytes(encryptedData);

    const ciphertext = encryptedBytes.slice(0, -16);
    const authTag = encryptedBytes.slice(-16);

    const encryptionKey = k;
    if (!encryptionKey) {
        throw new Error('Thiếu khóa xác thực mã hóa.');
    }

    const textEncoder = new TextEncoder();
    const keyBytes = textEncoder.encode(encryptionKey).slice(0, 32);
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        {
            name: 'AES-GCM',
        },
        false,
        ['decrypt'],
    );

    const encryptedBuffer = new Uint8Array(ciphertext.length + authTag.length);
    encryptedBuffer.set(ciphertext);
    encryptedBuffer.set(authTag, ciphertext.length);

    const algorithm = {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: 128,
    };

    const decryptedBuffer = await crypto.subtle.decrypt(
        algorithm,
        cryptoKey,
        encryptedBuffer,
    );
    const textDecoder = new TextDecoder();
    const m3u8 = textDecoder.decode(decryptedBuffer);
    const blob = new Blob([m3u8], {
        type: 'application/vnd.apple.mpegurl'
    });
    const url = URL.createObjectURL(blob);
    let ProxyFragLoader = function (config: any) {
        // @ts-ignore
        this._config = config;
        // @ts-ignore
        this.stats = {
            aborted: false,
            loaded: 0,
            retry: 0,
            total: 0,
            chunkCount: 0,
            bwEstimate: 0,
            loading: { start: 0, first: 0, end: 0 },
            parsing: { start: 0, end: 0 },
            buffering: { start: 0, first: 0, end: 0 },
        };
        // @ts-ignore
        this.context = null;
        // @ts-ignore
        this._controller = null;
    };
    ProxyFragLoader.prototype.destroy = function () {
        this.abort();
    };
    ProxyFragLoader.prototype.abort = function () {
        if (this._controller) {
            this._controller.abort();
            this._controller = null;
        }
    };
    // @ts-ignore
    ProxyFragLoader.prototype.load = function (ctx, cfg, cbs) {
        this.context = ctx;
        var self = this;
        self.stats.loading.start = performance.now();
        window.reader.fetch(ctx.url, {
            method: 'GET',
            headers: {
                Referer: urlObj.origin,
            },
            referrer: urlObj.origin,
        })
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                self.stats.loading.first = performance.now();
                return resp.arrayBuffer();
            })
            .then(function (buf) {
                self.stats.loading.end = performance.now();
                self.stats.loaded = buf.byteLength;
                self.stats.total = buf.byteLength;

                cbs.onSuccess({ data: buf }, self.stats, ctx, null);
            })
            .catch(function (err) {
                if (err.name === 'AbortError') return;
                self.stats.loading.end = performance.now();
                cbs.onError(
                    { code: 0, text: err.message },
                    ctx,
                    null,
                    self.stats,
                );
            });
    };

    window.LNReaderPlayer.playHls(url, {
        fLoader: ProxyFragLoader,
    });
}

initPlayer();