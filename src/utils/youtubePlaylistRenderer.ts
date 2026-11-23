import { Track } from '../types/radio';

export interface PlaylistChapter {
  index: number;
  track: Track;
  startSec: number;
  endSec: number;
  timestamp: string;
}

export function formatYouTubeTimestamp(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function buildYouTubeChapters(
  tracks: Track[],
  maxPerTrackSec = 0,
  introCountdownSec = 0
): PlaylistChapter[] {
  let cursor = introCountdownSec;
  return tracks.map((track, idx) => {
    const rawDur = track.duration > 1 ? track.duration : 18;
    const segDur = maxPerTrackSec > 0 ? Math.min(rawDur, maxPerTrackSec) : rawDur;
    const startSec = cursor;
    const endSec = cursor + segDur;
    cursor = endSec;
    return {
      index: idx + 1,
      track,
      startSec,
      endSec,
      timestamp: formatYouTubeTimestamp(startSec),
    };
  });
}

function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 2;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;

  const wavBuffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, length * numChannels * 2, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

async function buildMixedAudioBuffer(
  tracks: Track[],
  maxPerTrackSec = 14,
  introSec = 2
): Promise<{ buffer: AudioBuffer; chapters: PlaylistChapter[] }> {
  const sampleRate = 44100;
  const tempCtx = new AudioContext();
  const decoded: { track: Track; audio: AudioBuffer; usedSec: number }[] = [];

  try {
    for (const track of tracks) {
      if (!track.audioBlob) continue;
      try {
        const ab = await track.audioBlob.arrayBuffer();
        const audio = await tempCtx.decodeAudioData(ab);
        const usedSec = maxPerTrackSec > 0 ? Math.min(audio.duration, maxPerTrackSec) : audio.duration;
        if (usedSec > 0.5) {
          decoded.push({ track, audio, usedSec });
        }
      } catch {
        // skip undecodable blob
      }
    }
  } finally {
    tempCtx.close().catch(() => {});
  }

  if (decoded.length === 0) {
    throw new Error('No hay pistas con audio válido para exportar en esta lista.');
  }

  const totalAudioSec = decoded.reduce((acc, item) => acc + item.usedSec, 0);
  const totalSec = Math.max(4, introSec + totalAudioSec + 0.5);
  const offline = new OfflineAudioContext(2, Math.floor(sampleRate * totalSec), sampleRate);

  const chapters: PlaylistChapter[] = [];
  let cursor = introSec;

  decoded.forEach((item, idx) => {
    const src = offline.createBufferSource();
    src.buffer = item.audio;

    const gain = offline.createGain();
    const fadeIn = Math.min(0.8, item.usedSec * 0.15);
    const fadeOut = Math.min(0.9, item.usedSec * 0.18);

    gain.gain.setValueAtTime(0.01, cursor);
    gain.gain.linearRampToValueAtTime(0.95, cursor + fadeIn);
    gain.gain.setValueAtTime(0.95, Math.max(cursor + fadeIn, cursor + item.usedSec - fadeOut));
    gain.gain.linearRampToValueAtTime(0.01, cursor + item.usedSec);

    src.connect(gain);
    gain.connect(offline.destination);
    src.start(cursor, 0, item.usedSec);

    chapters.push({
      index: idx + 1,
      track: item.track,
      startSec: cursor,
      endSec: cursor + item.usedSec,
      timestamp: formatYouTubeTimestamp(cursor),
    });

    cursor += item.usedSec;
  });

  const rendered = await offline.startRendering();
  return { buffer: rendered, chapters };
}

export async function renderPlaylistMixWav(
  tracks: Track[],
  maxPerTrackSec = 0
): Promise<{ blob: Blob; duration: number; chapters: PlaylistChapter[] }> {
  const { buffer, chapters } = await buildMixedAudioBuffer(tracks, maxPerTrackSec, 0);
  const blob = encodeAudioBufferToWav(buffer);
  return { blob, duration: buffer.duration, chapters };
}

export async function renderPlaylistMixVideoWebM(params: {
  listName: string;
  tracks: Track[];
  maxPerTrackSec: number;
  resolution: '720p' | '1080p';
  premiereMode: boolean;
  onProgress: (pct: number) => void;
}): Promise<{ webmBlob: Blob; chapters: PlaylistChapter[]; durationSec: number }> {
  const { listName, tracks, maxPerTrackSec, resolution, premiereMode, onProgress } = params;
  const introSec = premiereMode ? 2.5 : 0;

  const { buffer, chapters } = await buildMixedAudioBuffer(tracks, maxPerTrackSec, introSec);

  const width = resolution === '1080p' ? 1920 : 1280;
  const height = resolution === '1080p' ? 1080 : 720;
  const scale = width / 1280;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const coverMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    chapters.map(
      (ch) =>
        new Promise<void>((resolve) => {
          if (!ch.track.coverUrl) {
            resolve();
            return;
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            coverMap.set(ch.track.id, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = ch.track.coverUrl;
        })
    )
  );

  const audioCtx = new AudioContext();
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  const dest = audioCtx.createMediaStreamDestination();
  src.connect(analyser);
  analyser.connect(dest);

  const videoStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: resolution === '1080p' ? 7_500_000 : 4_200_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      audioCtx.close().catch(() => {});
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
  });

  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const totalDur = buffer.duration;
  const startMs = performance.now();

  recorder.start(250);
  src.start(0);

  await new Promise<void>((resolveLoop) => {
    const draw = () => {
      const elapsed = (performance.now() - startMs) / 1000;
      onProgress(Math.min(100, Math.round((elapsed / totalDur) * 100)));
      analyser.getByteFrequencyData(freqData);

      ctx.save();
      ctx.scale(scale, scale);

      // Background
      const bg = ctx.createLinearGradient(0, 0, 1280, 720);
      bg.addColorStop(0, '#090C12');
      bg.addColorStop(0.55, '#121722');
      bg.addColorStop(1, '#1A1120');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1280, 720);

      // Ambient top glow
      const glow = ctx.createRadialGradient(980, 160, 20, 980, 160, 420);
      glow.addColorStop(0, 'rgba(225, 29, 72, 0.24)');
      glow.addColorStop(1, 'rgba(225, 29, 72, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 1280, 720);

      if (premiereMode && elapsed < introSec) {
        const countdown = Math.max(1, Math.ceil(introSec - elapsed));
        ctx.fillStyle = '#F59E0B';
        ctx.font = '700 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('YOUTUBE PREMIERE  ·  ESTRENO EN VIVO BASA RADIO', 640, 230);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 54px sans-serif';
        ctx.fillText(listName.slice(0, 34), 640, 305);

        ctx.fillStyle = '#F43F5E';
        ctx.font = '800 84px monospace';
        ctx.fillText(`00:0${countdown}`, 640, 420);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '500 20px sans-serif';
        ctx.fillText(`${chapters.length} pistas seleccionadas · Master ${resolution.toUpperCase()}`, 640, 480);
        ctx.textAlign = 'left';
      } else {
        const activeChapter =
          chapters.find((c) => elapsed >= c.startSec && elapsed < c.endSec) ||
          chapters[chapters.length - 1];
        const track = activeChapter.track;
        const img = coverMap.get(track.id);

        // Cover card
        ctx.fillStyle = '#0B0E14';
        ctx.beginPath();
        ctx.roundRect(64, 96, 320, 320, 18);
        ctx.fill();
        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(64, 96, 320, 320, 18);
          ctx.clip();
          ctx.drawImage(img, 64, 96, 320, 320);
          ctx.restore();
        }

        // Metadata
        ctx.fillStyle = '#F59E0B';
        ctx.font = '700 17px sans-serif';
        ctx.fillText(
          `${premiereMode ? 'ESTRENO YOUTUBE' : 'PLAYLIST MIX'}  ·  ${listName.toUpperCase()}  ·  PISTA ${String(activeChapter.index).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}`,
          424,
          128
        );

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 42px sans-serif';
        ctx.fillText(track.title.slice(0, 32), 424, 188);

        ctx.fillStyle = '#CBD5E1';
        ctx.font = '500 23px sans-serif';
        ctx.fillText(`${track.artist} · ${track.genre}`, 424, 228);

        // Tracklist Preview
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.roundRect(424, 260, 792, 164, 12);
        ctx.fill();

        const visibleStart = Math.max(0, activeChapter.index - 2);
        const visibleSlice = chapters.slice(visibleStart, visibleStart + 4);
        visibleSlice.forEach((ch, rowIdx) => {
          const y = 294 + rowIdx * 36;
          const isCur = ch.index === activeChapter.index;
          ctx.fillStyle = isCur ? '#FB7185' : '#94A3B8';
          ctx.font = isCur ? '700 17px monospace' : '500 16px monospace';
          ctx.fillText(ch.timestamp, 444, y);
          ctx.fillStyle = isCur ? '#FFFFFF' : '#CBD5E1';
          ctx.font = isCur ? '700 17px sans-serif' : '400 16px sans-serif';
          ctx.fillText(`${ch.track.title.slice(0, 42)} — ${ch.track.artist.slice(0, 22)}`, 530, y);
        });
      }

      // Spectrum Bars
      const bars = 54;
      const barW = 16;
      const gap = 5.5;
      const baseX = 64;
      const baseY = 636;
      for (let i = 0; i < bars; i++) {
        const val = freqData[i % freqData.length] / 255;
        const h = Math.max(8, val * 140);
        const grad = ctx.createLinearGradient(0, baseY, 0, baseY - h);
        grad.addColorStop(0, '#E11D48');
        grad.addColorStop(1, '#F59E0B');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(baseX + i * (barW + gap), baseY - h, barW, h, 4);
        ctx.fill();
      }

      // Bottom time bar
      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 15px monospace';
      ctx.fillText(
        `${formatYouTubeTimestamp(elapsed)} / ${formatYouTubeTimestamp(totalDur)}`,
        64,
        682
      );
      ctx.textAlign = 'right';
      ctx.fillText(`BASA RADIO · ${resolution.toUpperCase()}`, 1216, 682);
      ctx.textAlign = 'left';

      ctx.restore();

      if (elapsed >= totalDur) {
        src.stop();
        recorder.stop();
        resolveLoop();
        return;
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  });

  const webmBlob = await recordingPromise;
  return { webmBlob, chapters, durationSec: totalDur };
}

export function exportPlaylistAsM3U(listName: string, tracks: Track[]): void {
  const lines = ['#EXTM3U', `#PLAYLIST:${listName}`];
  for (const t of tracks) {
    lines.push(`#EXTINF:${Math.round(t.duration || 0)},${t.artist} - ${t.title}`);
    lines.push(t.fileName || `${t.title}.mp3`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'audio/x-mpegurl;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${listName.replace(/[^a-z0-9\-_ ]/gi, '_')}.m3u`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}
