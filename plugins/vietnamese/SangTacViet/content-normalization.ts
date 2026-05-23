/* eslint-disable no-useless-escape */

import { decodeHtmlEntities, encodeHtmlEntities } from '@libs/utils';
import { decodeGlyphs } from './glyph-decode';

// ── Content normalization  ─────────────────
function looksLikeInterlinear(text: string): boolean {
  return /<i\b[^>]*\b(?:t|v|p)\s*=\s*['"][^'"]*['"][^>]*>/i.test(text);
}

function normalizeInterlinear(raw: string): string {
  let t = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/<br\s*\/?>\s*/gi, '\n').replace(/<\/br\s*>/gi, '\n');
  t = t.replace(
    /<\/i>\s*\n+\s*(?=[,.;:!?%\)\]\}\u3002\uff0c\u3001\uff01\uff1f\uff1b\uff1a\u201d\u2019\u300d\u300f\u3011\u300b])/gi,
    '</i>',
  );
  const marker = '__STV_GAP__';
  t = t.replace(/<\/i>\s*<i\b/gi, '</i>' + marker + '<i');
  t = t.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, '$1');
  t = t.replace(
    /<\/?(p|div|article|section|li|tr|h[1-6]|blockquote|ul|ol)[^>]*>/gi,
    '\n',
  );
  t = t.replace(/<[^>]+>/g, '').replace(/[<>]/g, '');
  t = decodeHtmlEntities(t);
  t = t.replace(new RegExp(marker, 'g'), ' ');
  t = t.replace(/[\t\f\v ]+/g, ' ');
  t = t.replace(
    / +([,.;:!?%\)\]\}\u3002\uff0c\u3001\uff01\uff1f\uff1b\uff1a\u201d\u2019\u300d\u300f\u3011\u300b])/g,
    '$1',
  );
  t = t.replace(
    /\n+([,.;:!?%\)\]\}\u3002\uff0c\u3001\uff01\uff1f\uff1b\uff1a\u201d\u2019\u300d\u300f\u3011\u300b])/g,
    '$1',
  );
  t = t
    .replace(/[ ]*\n[ ]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return t ? t.replace(/\n/g, '<br>') : '';
}

export function normalizeChapterHtml(host: string, raw: string): string {
  let text = raw || '';
  if (!text) return '';
  const h = host.toLowerCase();

  if (h === 'fanqie') {
    text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    text = text.replace(/<\/?article>/gi, '');
    text = text.replace(/\sidx="\d+"/g, '');
    if (looksLikeInterlinear(text)) return normalizeInterlinear(text);
    return text;
  }

  if (h === 'sangtac' || h === 'dich') {
    text = decodeGlyphs(text);
    if (looksLikeInterlinear(text)) return normalizeInterlinear(text);
    if (!/<\w+[^>]*>/.test(text)) {
      text = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      text = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n/g, '<br>');
    }
    return text;
  }

  if (!/<\w+[^>]*>/.test(text)) {
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n/g, '<br>');
    return text;
  }
  if (looksLikeInterlinear(text)) return normalizeInterlinear(text);
  return text;
}

export function wrapWithParagraphs(rawText: string): string {
  if (!rawText) return '';
  const cleanText = rawText.replace(/<br\s*\/?>/gi, '\n');
  const paragraphs = cleanText.split('\n');
  const htmlResult = paragraphs
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p>${encodeHtmlEntities(line)}</p>`)
    .join('\n');
  return htmlResult;
}
