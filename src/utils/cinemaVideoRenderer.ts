import { CreativeProduction, VideoResolution } from '../types/radio';

export function getResolutionDimensions(resolution: VideoResolution): {
  width: number;
  height: number;
  label: string;
} {
  switch (resolution) {
    case '5K':
      return { width: 5120, height: 2880, label: '5K High HD (5120×2880)' };
    case '4K':
      return { width: 3840, height: 2160, label: '4K UHD (3840×2160)' };
    case '1080p':
    default:
      return { width: 1920, height: 1080, label: 'Full HD (1920×1080)' };
  }
}

export function drawCinemaFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  production: CreativeProduction,
  elapsedSec: number,
  totalDurationSec: number,
  freqData?: Uint8Array
): void {
  const scenes = production.scenes.length > 0
    ? production.scenes
    : [
        {
          index: 1,
          title: production.title,
          durationLabel: '00:30',
          visualDescription: production.logline,
          cameraAndLighting: 'Cinematográfico Anamórfico 5K',
          dialogue: production.synopsis.slice(0, 140),
          accentColor: '#E11D48',
        },
      ];

  const introDur = 2.6;
  const scale = w / 1280;

  // Base Obsidian Cinema Backdrop
  ctx.fillStyle = '#07090E';
  ctx.fillRect(0, 0, w, h);

  if (elapsedSec < introDur) {
    // Studio Bumper (Disney / Sony / Columbia / BASA Pictures aesthetic)
    const progress = elapsedSec / introDur;
    const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.8 ? (1 - progress) / 0.2 : 1;

    const rad = ctx.createRadialGradient(w * 0.5, h * 0.45, 20 * scale, w * 0.5, h * 0.45, 520 * scale);
    rad.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
    rad.addColorStop(0.5, 'rgba(225, 29, 72, 0.12)');
    rad.addColorStop(1, 'rgba(7, 9, 14, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';

    ctx.fillStyle = '#F59E0B';
    ctx.font = `600 ${Math.round(18 * scale)}px sans-serif`;
    ctx.fillText(production.studioStyle.toUpperCase(), w / 2, h * 0.39);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${Math.round(52 * scale)}px sans-serif`;
    ctx.fillText(production.title.slice(0, 36), w / 2, h * 0.49);

    ctx.fillStyle = '#94A3B8';
    ctx.font = `500 ${Math.round(20 * scale)}px sans-serif`;
    ctx.fillText(
      `${production.genre}  ·  ${production.resolution} MASTER  ·  ${production.targetPlatform}`,
      w / 2,
      h * 0.57
    );
    ctx.restore();
    return;
  }

  // Scene sequence
  const bodyElapsed = elapsedSec - introDur;
  const bodyTotal = Math.max(4, totalDurationSec - introDur);
  const sceneDur = bodyTotal / scenes.length;
  const sceneIdx = Math.min(scenes.length - 1, Math.floor(bodyElapsed / sceneDur));
  const sceneLocalProgress = (bodyElapsed % sceneDur) / sceneDur;
  const scene = scenes[sceneIdx];
  const accent = /^#[0-9a-fA-F]{6}$/.test(scene.accentColor || '')
    ? scene.accentColor
    : '#E11D48';

  // Atmospheric gradient per scene
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#0B0E14');
  grad.addColorStop(0.55, '#131926');
  grad.addColorStop(1, '#07090E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Moving cinematic light orb / lens glow
  const orbX = w * (0.3 + 0.4 * Math.sin(elapsedSec * 0.4 + sceneIdx));
  const orbY = h * (0.35 + 0.15 * Math.cos(elapsedSec * 0.3));
  const glow = ctx.createRadialGradient(orbX, orbY, 10 * scale, orbX, orbY, 460 * scale);
  glow.addColorStop(0, `${accent}44`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Parallax horizon silhouettes / geometric cinema framing
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 6; i++) {
    const bw = (180 + i * 35) * scale;
    const bx = ((i * 250 - elapsedSec * (12 + i * 3)) % (w + 300 * scale));
    const bh = (120 + (i % 3) * 60) * scale;
    ctx.fillRect(bx, h - bh - 90 * scale, bw, bh);
  }

  // Widescreen Cinema Letterbox Bars (2.39:1 feel)
  const barH = Math.round(62 * scale);
  ctx.fillStyle = '#040508';
  ctx.fillRect(0, 0, w, barH);
  ctx.fillRect(0, h - barH, w, barH);

  // Top bar info
  ctx.fillStyle = '#94A3B8';
  ctx.font = `600 ${Math.round(14 * scale)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(
    `${production.title.toUpperCase()}  ·  ${
      production.format === 'series' ? `EPISODIO ${scene.index}` : `ESCENA ${scene.index}`
    }: ${scene.title}`,
    48 * scale,
    38 * scale
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#F59E0B';
  ctx.fillText(`${production.resolution} HIGH HD`, w - 48 * scale, 38 * scale);

  // Center visual scene description card
  ctx.textAlign = 'left';
  ctx.fillStyle = accent;
  ctx.font = `600 ${Math.round(16 * scale)}px sans-serif`;
  ctx.fillText(
    `${scene.cameraAndLighting || 'Cámara Cinematográfica'}  ·  ${scene.durationLabel}`,
    72 * scale,
    170 * scale
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(36 * scale)}px sans-serif`;
  ctx.fillText(scene.title.slice(0, 48), 72 * scale, 222 * scale);

  // Wrap visual description cleanly
  ctx.fillStyle = '#CBD5E1';
  ctx.font = `400 ${Math.round(21 * scale)}px sans-serif`;
  const words = (scene.visualDescription || '').split(/\s+/);
  let line = '';
  let yPos = 278 * scale;
  const maxWidth = w - 144 * scale;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, 72 * scale, yPos);
      line = word;
      yPos += 32 * scale;
      if (yPos > 430 * scale) break;
    } else {
      line = test;
    }
  }
  if (line && yPos <= 430 * scale) {
    ctx.fillText(line, 72 * scale, yPos);
  }

  // Audio Spectrum Bar along bottom letterbox edge
  if (freqData) {
    const bars = 40;
    const bw = (w - 144 * scale) / bars;
    for (let i = 0; i < bars; i++) {
      const val = freqData[i % freqData.length] / 255;
      const bh = Math.max(3 * scale, val * 44 * scale);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.65;
      ctx.fillRect(72 * scale + i * bw, h - barH - bh - 8 * scale, bw * 0.7, bh);
    }
    ctx.globalAlpha = 1;
  }

  // Subtitle / Dialogue Box
  if (scene.dialogue) {
    const fade = sceneLocalProgress < 0.1 ? sceneLocalProgress / 0.1 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(w * 0.1, h - barH - 84 * scale, w * 0.8, 56 * scale);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = `600 ${Math.round(22 * scale)}px sans-serif`;
    ctx.fillText(`"${scene.dialogue.slice(0, 88)}"`, w / 2, h - barH - 48 * scale);
    ctx.restore();
  }
}

export async function exportProductionVideoWebM(params: {
  production: CreativeProduction;
  soundtrackBlob: Blob;
  exportResolution: VideoResolution;
  onProgress: (pct: number) => void;
}): Promise<Blob> {
  const { production, soundtrackBlob, exportResolution, onProgress } = params;
  const dims = getResolutionDimensions(exportResolution);

  const canvas = document.createElement('canvas');
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext('2d')!;

  const audioCtx = new AudioContext();
  const arrayBuf = await soundtrackBlob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);

  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffer;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  const dest = audioCtx.createMediaStreamDestination();
  src.connect(analyser);
  analyser.connect(dest);

  const videoStream = canvas.captureStream(24);
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: exportResolution === '5K' ? 16_000_000 : exportResolution === '4K' ? 12_000_000 : 6_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const renderDuration = Math.min(audioBuffer.duration, 24);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const startTime = performance.now();

  const donePromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      audioCtx.close().catch(() => {});
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
  });

  recorder.start(250);
  src.start(0);

  await new Promise<void>((resolveLoop) => {
    const tick = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      onProgress(Math.min(100, Math.round((elapsed / renderDuration) * 100)));
      analyser.getByteFrequencyData(freqData);
      drawCinemaFrame(ctx, dims.width, dims.height, production, elapsed, renderDuration, freqData);

      if (elapsed >= renderDuration) {
        src.stop();
        recorder.stop();
        resolveLoop();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  return donePromise;
}
