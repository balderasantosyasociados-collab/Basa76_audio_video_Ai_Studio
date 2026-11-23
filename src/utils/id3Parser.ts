export interface ParsedAudioMeta {
  title: string;
  artist: string;
  album: string;
  genre: string;
  coverUrl?: string;
  duration: number;
}

function decodeSynchsafeInt(b0: number, b1: number, b2: number, b3: number): number {
  return ((b0 & 0x7f) << 21) | ((b1 & 0x7f) << 14) | ((b2 & 0x7f) << 7) | (b3 & 0x7f);
}

function decodeTextFrame(bytes: Uint8Array): string {
  if (bytes.length < 2) return '';
  const encoding = bytes[0];
  const payload = bytes.slice(1);

  try {
    if (encoding === 0) {
      return new TextDecoder('iso-8859-1').decode(payload).replace(/\0/g, '').trim();
    }
    if (encoding === 1) {
      return new TextDecoder('utf-16').decode(payload).replace(/\0/g, '').trim();
    }
    if (encoding === 2) {
      return new TextDecoder('utf-16be').decode(payload).replace(/\0/g, '').trim();
    }
    return new TextDecoder('utf-8').decode(payload).replace(/\0/g, '').trim();
  } catch {
    return '';
  }
}

function extractApicDataUrl(bytes: Uint8Array): string | undefined {
  if (bytes.length < 10) return undefined;
  const encoding = bytes[0];
  let offset = 1;

  // Read MIME string (null-terminated ASCII)
  let mimeEnd = offset;
  while (mimeEnd < bytes.length && bytes[mimeEnd] !== 0) {
    mimeEnd++;
  }
  const mimeRaw = new TextDecoder('iso-8859-1').decode(bytes.slice(offset, mimeEnd));
  const mime = mimeRaw.includes('/') ? mimeRaw : 'image/jpeg';
  offset = mimeEnd + 1;

  if (offset >= bytes.length) return undefined;
  // Picture type (1 byte)
  offset += 1;

  // Description (null-terminated according to encoding)
  if (encoding === 1 || encoding === 2) {
    while (offset + 1 < bytes.length && !(bytes[offset] === 0 && bytes[offset + 1] === 0)) {
      offset += 2;
    }
    offset += 2;
  } else {
    while (offset < bytes.length && bytes[offset] !== 0) {
      offset += 1;
    }
    offset += 1;
  }

  if (offset >= bytes.length) return undefined;
  const imgBytes = bytes.slice(offset);
  if (imgBytes.length < 16) return undefined;

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < imgBytes.length; i += chunkSize) {
    const chunk = imgBytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

async function parseId3v2(file: File): Promise<Partial<ParsedAudioMeta>> {
  const result: Partial<ParsedAudioMeta> = {};
  try {
    const headerSlice = await file.slice(0, 10).arrayBuffer();
    const header = new Uint8Array(headerSlice);
    if (header[0] !== 0x49 || header[1] !== 0x44 || header[2] !== 0x33) {
      return result;
    }
    const majorVersion = header[3];
    const tagSize = decodeSynchsafeInt(header[6], header[7], header[8], header[9]);
    const readSize = Math.min(tagSize + 10, 2 * 1024 * 1024); // Cap header scan at 2MB
    const tagBuffer = await file.slice(0, readSize).arrayBuffer();
    const data = new Uint8Array(tagBuffer);

    let pos = 10;
    // Skip extended header if present (bit 6 of flags)
    if ((header[5] & 0x40) !== 0 && pos + 4 <= data.length) {
      const extSize =
        majorVersion === 4
          ? decodeSynchsafeInt(data[pos], data[pos + 1], data[pos + 2], data[pos + 3])
          : (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
      pos += Math.max(4, extSize);
    }

    while (pos + 10 < data.length) {
      if (data[pos] === 0) break;
      const frameId = String.fromCharCode(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

      const frameSize =
        majorVersion === 4
          ? decodeSynchsafeInt(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7])
          : (data[pos + 4] << 24) | (data[pos + 5] << 16) | (data[pos + 6] << 8) | data[pos + 7];

      pos += 10;
      if (frameSize <= 0 || pos + frameSize > data.length) break;

      const frameData = data.slice(pos, pos + frameSize);
      if (frameId === 'TIT2') {
        const val = decodeTextFrame(frameData);
        if (val) result.title = val;
      } else if (frameId === 'TPE1') {
        const val = decodeTextFrame(frameData);
        if (val) result.artist = val;
      } else if (frameId === 'TALB') {
        const val = decodeTextFrame(frameData);
        if (val) result.album = val;
      } else if (frameId === 'TCON') {
        const val = decodeTextFrame(frameData).replace(/^\(\d+\)/, '').trim();
        if (val) result.genre = val;
      } else if (frameId === 'APIC' && !result.coverUrl) {
        result.coverUrl = extractApicDataUrl(frameData);
      }

      pos += frameSize;
    }
  } catch {
    // Fallback cleanly to filename parsing
  }
  return result;
}

export function parseFileNameFallback(fileName: string): { title: string; artist: string } {
  const base = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim();
  const dashSplit = base.split(/\s+[-–—]\s+/);
  if (dashSplit.length >= 2) {
    return {
      artist: dashSplit[0].trim() || 'Artista Independiente',
      title: dashSplit.slice(1).join(' - ').trim() || base,
    };
  }
  return {
    title: base || 'Pista sin título',
    artist: 'Mi Biblioteca',
  };
}

export async function extractAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeAttribute('src');
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(0);
    }, 5000);

    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      cleanup();
      resolve(dur);
    };

    audio.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(0);
    };

    audio.src = url;
  });
}

export async function parseAudioFile(file: File): Promise<ParsedAudioMeta> {
  const fallback = parseFileNameFallback(file.name);
  const [id3, duration] = await Promise.all([
    parseId3v2(file),
    extractAudioDuration(file),
  ]);

  return {
    title: id3.title || fallback.title,
    artist: id3.artist || fallback.artist,
    album: id3.album || 'Carga Local',
    genre: id3.genre || 'Música Propia',
    coverUrl: id3.coverUrl,
    duration,
  };
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
