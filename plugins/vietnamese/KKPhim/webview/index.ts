// KKPhim Player - m3u8 playback with ad blocker

const DISCONTINUITY_TAG = '#EXT-X-DISCONTINUITY';

function collapseConsecutiveDiscontinuities(playlist: string): string {
  const lines = playlist.split(/\r?\n/);
  const normalized: string[] = [];
  let previousWasDiscontinuity = false;

  for (const line of lines) {
    if (line.trim() === DISCONTINUITY_TAG) {
      if (previousWasDiscontinuity) continue;
      normalized.push(DISCONTINUITY_TAG);
      previousWasDiscontinuity = true;
      continue;
    }
    normalized.push(line);
    if (line.trim().length > 0) {
      previousWasDiscontinuity = false;
    }
  }

  while (normalized.length > 0 && normalized[normalized.length - 1].trim().length === 0) {
    normalized.pop();
  }
  if (normalized.length > 0 && normalized[normalized.length - 1].trim() === DISCONTINUITY_TAG) {
    normalized.pop();
  }

  return normalized.join('\n');
}

function processDiscontinuityBlocks(playlist: string): string {
  const lines = playlist.replace(/\r\n/g, '\n').split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() !== DISCONTINUITY_TAG) {
      result.push(line);
      i++;
      continue;
    }

    const blockLines: string[] = [];
    i++;

    while (i < lines.length && lines[i].trim() !== DISCONTINUITY_TAG) {
      blockLines.push(lines[i]);
      i++;
    }

    if (i < lines.length) i++; // skip closing DISCONTINUITY

    const segmentLines = blockLines.filter((l) => {
      const trimmed = l.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#');
    });

    // Match /v7/, /v8/, convertv7/, convertv8/ etc. (ad segments)
    const isAdBlock = segmentLines.some((l) => /\/v\d+\/|convertv\d+\//.test(l));

    if (!isAdBlock) {
      result.push(DISCONTINUITY_TAG);
      result.push(...blockLines);
      result.push(DISCONTINUITY_TAG);
    } else {
      // Remove ad block but keep DISCONTINUITY marker for PTS reset
      result.push(DISCONTINUITY_TAG);
    }
  }

  return collapseConsecutiveDiscontinuities(result.join('\n'));
}

function cleanManifest(manifest: string): string {
  const lines = manifest.replace(/\r\n/g, '\n').split('\n');
  const discontinuityIndexes: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === DISCONTINUITY_TAG) {
      discontinuityIndexes.push(i);
    }
  }

  const removeLine = new Array(lines.length).fill(false);

  for (let index = 0; index < discontinuityIndexes.length - 1; index++) {
    const start = discontinuityIndexes[index];
    const end = discontinuityIndexes[index + 1];
    let segmentCount = 0;
    let totalDuration = 0;
    let shortDurationCount = 0;

    for (let lineIndex = start + 1; lineIndex < end; lineIndex++) {
      const line = lines[lineIndex].trim();

      if (/\.ts($|\?)/i.test(line)) segmentCount++;

      if (line.startsWith('#EXTINF:')) {
        const match = line.match(/#EXTINF:([\d.]+),/);
        if (!match) continue;
        const duration = parseFloat(match[1]);
        if (!isFinite(duration)) continue;
        totalDuration += duration;
        if (duration < 2.5) shortDurationCount++;
      }
    }

    const averageDuration = segmentCount > 0 ? totalDuration / segmentCount : 0;
    const shortDurationRatio = segmentCount > 0 ? shortDurationCount / segmentCount : 0;

    const isAdBlock =
      segmentCount >= 8 &&
      segmentCount <= 20 &&
      (averageDuration < 3 || shortDurationRatio >= 0.6);

    if (isAdBlock) {
      for (let lineIndex = start; lineIndex <= end; lineIndex++) {
        removeLine[lineIndex] = true;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (/^#EXT-X-KEY:METHOD=NONE\b/i.test(lines[i].trim())) removeLine[i] = true;
    if (lines[i].trim() === DISCONTINUITY_TAG) removeLine[i] = true;
  }

  const cleanedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!removeLine[i]) {
      cleanedLines.push(lines[i].replace(/\/convertv\d+\//g, '/'));
    }
  }

  return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isContainAds(playlist: string): boolean {
  if (/\/v\d+\//.test(playlist)) return true;
  if (/convertv\d+\//.test(playlist)) return true;
  return false;
}

function cleanMediaPlaylistText(text: string, baseUrl: string): string {
  if (!text.includes('#EXTM3U')) return text;

  // Resolve relative URLs to absolute
  const withAbsoluteUrls = text.replace(/^[^#].*$/gm, (line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return line;
    try {
      return new URL(trimmed, baseUrl).toString();
    } catch {
      return line;
    }
  });

  if (!isContainAds(withAbsoluteUrls)) {
    return collapseConsecutiveDiscontinuities(withAbsoluteUrls);
  }

  return processDiscontinuityBlocks(withAbsoluteUrls);
}

// ── Main ──
(async function () {
  if (!window.LNReaderPlayer) return;

  const container = document.getElementById('kkphim-player-container');
  if (!container) return;

  const m3u8Url = container.getAttribute('data-m3u8') || '';
  const adBlockerDisabled = container.getAttribute('data-ad-blocker') === 'true';

  if (!m3u8Url) {
    window.LNReaderPlayer.log('No m3u8 URL found');
    return;
  }

  window.LNReaderPlayer.log('KKPhim player initialized');
  window.LNReaderPlayer.log('Ad blocker: ' + (adBlockerDisabled ? 'OFF' : 'ON'));

  if (adBlockerDisabled) {
    window.LNReaderPlayer.log('Playing m3u8 directly (ad blocker off)');
    window.LNReaderPlayer.playHls(m3u8Url);
    return;
  }

  // ── Ad blocker: fetch, clean, play blob ──
  window.LNReaderPlayer.log('Fetching m3u8 for ad cleaning...');

  try {
    const res = await fetch(m3u8Url);
    const playlistText = await res.text();

    // Master playlist — find best quality stream
    if (playlistText.includes('#EXT-X-STREAM-INF')) {
      window.LNReaderPlayer.log('Master playlist detected, parsing streams...');

      const lines = playlistText.split('\n');
      let streamUrl = '';
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('#EXT-X-STREAM-INF')) {
          const nextLine = lines[i + 1]?.trim();
          if (nextLine && !nextLine.startsWith('#')) {
            streamUrl = new URL(nextLine, m3u8Url).toString();
            break;
          }
        }
      }

      if (streamUrl) {
        window.LNReaderPlayer.log('Fetching stream playlist: ' + streamUrl);
        const streamRes = await fetch(streamUrl);
        const streamPlaylist = await streamRes.text();
        const cleaned = cleanMediaPlaylistText(streamPlaylist, streamUrl);
        window.LNReaderPlayer.log('Ad cleaning complete, playing...');
        const blob = new Blob([cleaned], { type: 'application/vnd.apple.mpegurl' });
        const blobUrl = URL.createObjectURL(blob);
        window.LNReaderPlayer.playHls(blobUrl);
        return;
      }
    }

    const cleaned = cleanMediaPlaylistText(playlistText, m3u8Url);
    window.LNReaderPlayer.log('Ad cleaning complete, playing...');
    const blob = new Blob([cleaned], { type: 'application/vnd.apple.mpegurl' });
    const blobUrl = URL.createObjectURL(blob);
    window.LNReaderPlayer.playHls(blobUrl);
  } catch (err: any) {
    window.LNReaderPlayer.log('Error cleaning ads: ' + err.message);
    window.LNReaderPlayer.log('Falling back to direct playback...');
    window.LNReaderPlayer.playHls(m3u8Url);
  }
})();
