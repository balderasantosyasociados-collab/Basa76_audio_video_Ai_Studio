import { AiSongBlueprint, DrumStyle } from '../types/radio';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
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

function createNoiseBuffer(ctx: BaseAudioContext, durationSec = 0.5): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function scheduleKick(ctx: OfflineAudioContext, dest: AudioNode, time: number, punch = 0.85) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(145, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);

  gain.gain.setValueAtTime(punch, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + 0.3);
}

function scheduleSnare(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  noiseBuf: AudioBuffer,
  time: number,
  level = 0.42
) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1850;
  filter.Q.value = 0.8;

  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(level, time);
  nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

  noise.connect(filter);
  filter.connect(nGain);
  nGain.connect(dest);
  noise.start(time);
  noise.stop(time + 0.17);

  const body = ctx.createOscillator();
  const bGain = ctx.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(185, time);
  body.frequency.exponentialRampToValueAtTime(95, time + 0.08);
  bGain.gain.setValueAtTime(level * 0.65, time);
  bGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
  body.connect(bGain);
  bGain.connect(dest);
  body.start(time);
  body.stop(time + 0.1);
}

function scheduleHat(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  noiseBuf: AudioBuffer,
  time: number,
  open = false,
  level = 0.16
) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7200;

  const gain = ctx.createGain();
  const dur = open ? 0.19 : 0.045;
  gain.gain.setValueAtTime(level, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  noise.start(time);
  noise.stop(time + dur + 0.01);
}

function getDrumPattern(style: DrumStyle): { kicks: number[]; snares: number[]; hats: number[] } {
  switch (style) {
    case 'reggaeton':
      return {
        kicks: [0, 4, 8, 12],
        snares: [3, 6, 11, 14], // Dembow syncopation
        hats: [0, 2, 4, 6, 8, 10, 12, 14],
      };
    case 'trap':
      return {
        kicks: [0, 7, 10],
        snares: [8],
        hats: [0, 2, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15],
      };
    case 'house':
      return {
        kicks: [0, 4, 8, 12],
        snares: [4, 12],
        hats: [2, 6, 10, 14],
      };
    case 'afrobeat':
      return {
        kicks: [0, 6, 10],
        snares: [3, 8, 14],
        hats: [0, 2, 4, 6, 8, 10, 12, 14],
      };
    case 'synthwave':
      return {
        kicks: [0, 4, 8, 12],
        snares: [4, 12],
        hats: [0, 2, 4, 6, 8, 10, 12, 14],
      };
    case 'lofi':
      return {
        kicks: [0, 7, 10],
        snares: [4, 12],
        hats: [0, 2, 4, 6, 8, 10, 12, 14],
      };
    case 'rock':
      return {
        kicks: [0, 6, 8],
        snares: [4, 12],
        hats: [0, 2, 4, 6, 8, 10, 12, 14],
      };
    case 'pop':
    default:
      return {
        kicks: [0, 8, 10],
        snares: [4, 12],
        hats: [0, 2, 4, 6, 8, 10, 12, 14],
      };
  }
}

export async function renderAiSongToWav(
  blueprint: AiSongBlueprint,
  vocalBase64?: string
): Promise<{ blob: Blob; duration: number }> {
  const sampleRate = 44100;
  const bpm = Math.max(72, Math.min(155, blueprint.bpm || 105));
  const stepDur = 60 / bpm / 4; // 16th note
  const barDur = stepDur * 16;
  const totalBars = 16; // Intro (4) + Verse (4) + Chorus (4) + Outro (4) -> ~34s-48s full dynamic song
  const duration = Math.min(58, Math.max(24, totalBars * barDur + 1.2));

  const ctx = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate);

  const masterComp = ctx.createDynamicsCompressor();
  masterComp.threshold.value = -14;
  masterComp.knee.value = 16;
  masterComp.ratio.value = 4;
  masterComp.attack.value = 0.005;
  masterComp.release.value = 0.18;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.01, 0);
  masterGain.gain.linearRampToValueAtTime(0.88, 0.4);
  masterGain.gain.setValueAtTime(0.88, Math.max(1, duration - 1.5));
  masterGain.gain.linearRampToValueAtTime(0.001, duration);

  const musicBus = ctx.createGain();
  musicBus.gain.value = 1.0;

  musicBus.connect(masterComp);
  masterComp.connect(masterGain);
  masterGain.connect(ctx.destination);

  const noiseBuf = createNoiseBuffer(ctx, 0.5);
  const pattern = getDrumPattern(blueprint.drumStyle);

  const chords =
    Array.isArray(blueprint.chordProgression) && blueprint.chordProgression.length >= 4
      ? blueprint.chordProgression
      : [
          [57, 60, 64, 67],
          [53, 57, 60, 64],
          [55, 59, 62, 67],
          [52, 55, 59, 64],
        ];
  const bassNotes =
    Array.isArray(blueprint.bassNotes) && blueprint.bassNotes.length >= 4
      ? blueprint.bassNotes
      : [45, 45, 41, 41, 43, 43, 40, 40];
  const melodyNotes =
    Array.isArray(blueprint.melodyNotes) && blueprint.melodyNotes.length >= 8
      ? blueprint.melodyNotes
      : [69, 72, 76, 74, 72, 69, 67, 69, 72, 76, 79, 76, 74, 72, 71, 69];

  // Schedule 16 bars
  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * barDur;
    const isIntro = bar < 2;
    const isChorus = bar >= 6 && bar < 12;
    const isOutro = bar >= 14;

    const chord = chords[bar % chords.length];

    // 1. Warm Stereo Pad / Keys Chord
    chord.forEach((midi, voiceIdx) => {
      const freq = midiToFreq(Math.max(40, Math.min(88, midi)));
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      const panner = ctx.createStereoPanner();

      osc.type = blueprint.drumStyle === 'synthwave' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, barStart);

      filter.type = 'lowpass';
      filter.frequency.value = isChorus ? 2200 : 1250;

      panner.pan.value = ((voiceIdx % 2 === 0 ? -1 : 1) * 0.28);

      const amp = isChorus ? 0.13 : 0.095;
      g.gain.setValueAtTime(0.001, barStart);
      g.gain.linearRampToValueAtTime(amp, barStart + 0.08);
      g.gain.setValueAtTime(amp * 0.85, barStart + barDur - 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, barStart + barDur);

      osc.connect(filter);
      filter.connect(g);
      g.connect(panner);
      panner.connect(musicBus);

      osc.start(barStart);
      osc.stop(barStart + barDur + 0.02);
    });

    // 2. Drums (skip heavy kick in bar 0 intro)
    if (bar >= 1 && !isOutro) {
      for (let step = 0; step < 16; step++) {
        const t = barStart + step * stepDur;
        if (pattern.kicks.includes(step) && (bar >= 2 || step === 0)) {
          scheduleKick(ctx, musicBus, t, isChorus ? 0.88 : 0.72);
        }
        if (pattern.snares.includes(step) && bar >= 2) {
          scheduleSnare(ctx, musicBus, noiseBuf, t, isChorus ? 0.42 : 0.32);
        }
        if (pattern.hats.includes(step)) {
          scheduleHat(ctx, musicBus, noiseBuf, t, step === 14 && isChorus, isChorus ? 0.15 : 0.1);
        }
      }
    }

    // 3. Bassline (enters bar 2)
    if (bar >= 2) {
      const bassStepCount = 2;
      for (let b = 0; b < bassStepCount; b++) {
        const bTime = barStart + b * (barDur / 2);
        const bassMidi = bassNotes[(bar * 2 + b) % bassNotes.length];
        const freq = midiToFreq(Math.max(28, Math.min(55, bassMidi)));
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = blueprint.drumStyle === 'synthwave' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, bTime);

        filter.type = 'lowpass';
        filter.frequency.value = 320;

        g.gain.setValueAtTime(0.001, bTime);
        g.gain.linearRampToValueAtTime(isChorus ? 0.42 : 0.32, bTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, bTime + barDur / 2 - 0.04);

        osc.connect(filter);
        filter.connect(g);
        g.connect(musicBus);

        osc.start(bTime);
        osc.stop(bTime + barDur / 2);
      }
    }

    // 4. Lead Melody Hook (active in Verse 2, Chorus, and Outro)
    if (!isIntro) {
      const notesPerBar = 4;
      for (let m = 0; m < notesPerBar; m++) {
        const mTime = barStart + m * (barDur / notesPerBar);
        const noteMidi = melodyNotes[(bar * 4 + m) % melodyNotes.length];
        const freq = midiToFreq(Math.max(58, Math.min(88, noteMidi)));

        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const pan = ctx.createStereoPanner();

        osc.type = isChorus ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, mTime);
        pan.pan.value = Math.sin(bar + m) * 0.25;

        const level = isChorus ? 0.22 : 0.13;
        const noteDur = barDur / notesPerBar;
        g.gain.setValueAtTime(0.001, mTime);
        g.gain.linearRampToValueAtTime(level, mTime + 0.025);
        g.gain.exponentialRampToValueAtTime(0.001, mTime + noteDur * 0.9);

        osc.connect(g);
        g.connect(pan);
        pan.connect(musicBus);

        osc.start(mTime);
        osc.stop(mTime + noteDur);
      }
    }
  }

  // 5. Mix AI Vocal Performance over Chorus if available
  if (vocalBase64) {
    try {
      const binaryStr = atob(vocalBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const vocalBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const vocalStart = 4 * barDur; // Enter right after intro!

      const vSrc = ctx.createBufferSource();
      vSrc.buffer = vocalBuffer;

      const vGain = ctx.createGain();
      vGain.gain.value = 1.05;

      // Subtle studio delay echo on vocal
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.24;
      const delayGain = ctx.createGain();
      delayGain.gain.value = 0.22;

      vSrc.connect(vGain);
      vGain.connect(masterComp);
      vGain.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(masterComp);

      // Gentle musical ducking while vocal hook performs
      const vEnd = Math.min(duration - 1, vocalStart + vocalBuffer.duration);
      musicBus.gain.setValueAtTime(1.0, Math.max(0, vocalStart - 0.2));
      musicBus.gain.linearRampToValueAtTime(0.58, vocalStart + 0.15);
      musicBus.gain.setValueAtTime(0.58, Math.max(vocalStart + 0.2, vEnd - 0.2));
      musicBus.gain.linearRampToValueAtTime(1.0, Math.min(duration, vEnd + 0.4));

      vSrc.start(vocalStart);
    } catch {
      // Proceed cleanly with instrumental master if vocal decode fails
    }
  }

  const renderedBuffer = await ctx.startRendering();
  const blob = encodeAudioBufferToWav(renderedBuffer);
  return { blob, duration: renderedBuffer.duration };
}

export async function renderMusicVideoWebM(params: {
  title: string;
  artist: string;
  genre: string;
  lyrics: string;
  audioBlob: Blob;
  coverUrl: string;
  onProgress: (pct: number) => void;
}): Promise<Blob> {
  const { title, artist, genre, lyrics, audioBlob, coverUrl, onProgress } = params;

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;

  // Load cover image
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = coverUrl;
  });

  const audioCtx = new AudioContext();
  const arrayBuf = await audioBlob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);

  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffer;

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

  const recorder = new MediaRecorder(combinedStream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const lyricLines = lyrics
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('['));

  // Cap video render at max 22s or full song duration so YouTube export finishes fast and reliably
  const renderDuration = Math.min(audioBuffer.duration, 24);
  const startTime = performance.now();

  const recordingPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      audioCtx.close().catch(() => {});
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
  });

  recorder.start(250);
  src.start(0);

  await new Promise<void>((resolveLoop) => {
    const drawFrame = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const pct = Math.min(100, Math.round((elapsed / renderDuration) * 100));
      onProgress(pct);

      analyser.getByteFrequencyData(freqData);

      // Dark studio gradient background
      const bgGrad = ctx.createLinearGradient(0, 0, 1280, 720);
      bgGrad.addColorStop(0, '#0B0E14');
      bgGrad.addColorStop(1, '#181F2E');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1280, 720);

      // Subtle cover artwork left card
      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(72, 110, 360, 360, 20);
        ctx.clip();
        ctx.drawImage(img, 72, 110, 360, 360);
        ctx.restore();
      }

      // Header text
      ctx.fillStyle = '#F43F5E';
      ctx.font = '600 18px sans-serif';
      ctx.fillText(`BASA RADIO AI STUDIO  ·  ${genre.toUpperCase()}`, 480, 145);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 44px sans-serif';
      ctx.fillText(title.slice(0, 34), 480, 205);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 24px sans-serif';
      ctx.fillText(artist, 480, 245);

      // Kinetic lyrics lines
      if (lyricLines.length > 0) {
        const lineIdx = Math.floor((elapsed / renderDuration) * lyricLines.length) % lyricLines.length;
        const currentLine = lyricLines[lineIdx] || '';
        const nextLine = lyricLines[(lineIdx + 1) % lyricLines.length] || '';

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '600 28px sans-serif';
        ctx.fillText(currentLine.slice(0, 52), 480, 345);

        ctx.fillStyle = '#64748B';
        ctx.font = '400 22px sans-serif';
        ctx.fillText(nextLine.slice(0, 56), 480, 390);
      }

      // Live Spectrum Bars at bottom
      const bars = 48;
      const barW = 18;
      const gap = 6;
      const baseX = 72;
      const baseY = 635;
      for (let i = 0; i < bars; i++) {
        const val = freqData[i % freqData.length] / 255;
        const h = Math.max(8, val * 125);
        const grad = ctx.createLinearGradient(0, baseY, 0, baseY - h);
        grad.addColorStop(0, '#E11D48');
        grad.addColorStop(1, '#F59E0B');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(baseX + i * (barW + gap), baseY - h, barW, h, 4);
        ctx.fill();
      }

      if (elapsed >= renderDuration) {
        src.stop();
        recorder.stop();
        resolveLoop();
        return;
      }
      requestAnimationFrame(drawFrame);
    };
    requestAnimationFrame(drawFrame);
  });

  return recordingPromise;
}
