import { Readable } from 'node:stream';
import { performNetRequest } from '../ipc/fetch-handler.js';
import { customSession } from '../main.js';

export function registerLnproxyProtocol() {
  customSession.protocol.handle('lnproxy', async req => {
    // Handle OPTIONS request for preflight just in case, though Custom Protocol with corsEnabled shouldn't need it.
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': '*',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    try {
      const urlObj = new URL(req.url);
      const targetUrl = urlObj.searchParams.get('url');

      if (!targetUrl) {
        return new Response('Missing url parameter', { status: 400 });
      }

      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        const prefix = 'x-ln-forward-header-';
        if (key.toLowerCase().startsWith(prefix)) {
          const realKey = key.substring(prefix.length);
          headers[realKey] = value;
        }
      });

      // Parse the request body if any
      let bodyData: Buffer | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        const arrayBuf = await req.arrayBuffer();
        if (arrayBuf.byteLength > 0) {
          bodyData = Buffer.from(arrayBuf);
        }
      }

      // We use the shared native implementation from fetch-handler
      const responseData = await performNetRequest(targetUrl, {
        method: req.method,
        headers: headers,
        body: bodyData,
      });

      const resHeaders = new Headers(responseData.headers);

      // Node fetch/net automatically decompresses but keeps original headers, causing issues when piped to Chromium
      resHeaders.delete('content-encoding');
      resHeaders.delete('content-length');

      // Always allow CORS
      resHeaders.set('Access-Control-Allow-Origin', '*');
      resHeaders.set('Access-Control-Allow-Headers', '*');
      resHeaders.set('Access-Control-Allow-Methods', '*');

      const webStream = Readable.toWeb(responseData.stream as any);

      return new Response(webStream as any, {
        status: responseData.statusCode,
        statusText: responseData.statusMessage,
        headers: resHeaders,
      });
    } catch (error) {
      console.error('[lnproxy] Request error:', error);
      return new Response(String(error), { status: 500 });
    }
  });
}
