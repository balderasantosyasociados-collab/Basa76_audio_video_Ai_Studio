import { Track } from '../types/radio';

function encodeWav(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const numSamples = left.length;
  const buffer = new ArrayBuffer(44 + numSamples * 4);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 4, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 2, true); // Stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 4, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function generateWarmPadTrack(
  durationSec: number,
  chords: number[][],
  tempoBpm: number,
  style: 'lounge' | 'pulse' | 'jingle'
): Blob {
  const sampleRate = 22050;
  const length = Math.floor(sampleRate * durationSec);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  const beatDur = 60 / tempoBpm;
  const chordDur = durationSec / chords.length;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.min(chords.length - 1, Math.floor(t / chordDur));
    const chord = chords[chordIdx];

    // Smooth fade in/out envelope
    const fadeIn = Math.min(1, t / 0.8);
    const fadeOut = Math.min(1, (durationSec - t) / 1.2);
    const env = fadeIn * fadeOut;

    let sampleL = 0;
    let sampleR = 0;

    // Warm electric piano / pad voices
    for (let v = 0; v < chord.length; v++) {
      const freq = chord[v];
      const detune = (v % 2 === 0 ? 1 : -1) * 0.35;
      const pan = 0.5 + (v - (chord.length - 1) / 2) * 0.14;
      const wave =
        Math.sin(2 * Math.PI * (freq + detune) * t) * 0.65 +
        Math.sin(2 * Math.PI * freq * 2 * t) * 0.18;

      const localBeat = (t % (beatDur * 2)) / (beatDur * 2);
      const pluck =
        style === 'jingle'
          ? Math.exp(-localBeat * 2.5)
          : style === 'pulse'
          ? 0.55 + 0.45 * Math.sin(Math.PI * localBeat)
          : 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.25 * t + v);

      sampleL += wave * pluck * (1 - pan) * 0.26;
      sampleR += wave * pluck * pan * 0.26;
    }

    // Subtle bass groove
    const rootFreq = chord[0] * 0.5;
    const beatPhase = (t % beatDur) / beatDur;
    const bassEnv = style === 'jingle' ? Math.exp(-beatPhase * 3) : 0.7 + 0.3 * Math.cos(Math.PI * beatPhase);
    const bass = Math.sin(2 * Math.PI * rootFreq * t) * 0.22 * bassEnv;

    // Gentle percussion tick on pulse/jingle
    let perc = 0;
    if (style !== 'lounge') {
      const subBeat = (t % (beatDur * 0.5)) / (beatDur * 0.5);
      if (subBeat < 0.04) {
        perc = (Math.sin(2 * Math.PI * 120 * Math.exp(-subBeat * 40) * t) * 0.12) * (1 - subBeat / 0.04);
      }
    }

    left[i] = (sampleL + bass + perc) * env;
    right[i] = (sampleR + bass + perc) * env;
  }

  return encodeWav(left, right, sampleRate);
}

export function createStarterStudioTracks(): Track[] {
  const now = Date.now();

  // Track 1: Studio Ambient Lounge Bed (24s)
  const loungeBlob = generateWarmPadTrack(
    24,
    [
      [220, 261.63, 329.63, 392], // Am7
      [174.61, 220, 261.63, 329.63], // Fmaj7
      [196, 246.94, 293.66, 392], // G6
      [164.81, 196, 246.94, 329.63], // Em7
    ],
    88,
    'lounge'
  );

  // Track 2: Pulso Nocturno (20s)
  const pulseBlob = generateWarmPadTrack(
    20,
    [
      [196, 233.08, 293.66, 349.23], // Gm7
      [155.56, 196, 233.08, 293.66], // Ebmaj7
      [174.61, 220, 261.63, 349.23], // F6
      [146.83, 174.61, 220, 293.66], // Dm7
    ],
    102,
    'pulse'
  );

  // Track 3: Identificación BASA Radio (Jingle 6s)
  const jingleBlob = generateWarmPadTrack(
    6,
    [
      [261.63, 329.63, 392, 493.88], // Cmaj7
      [293.66, 369.99, 440, 523.25], // D6/9
      [329.63, 392, 493.88, 587.33], // Em9
    ],
    120,
    'jingle'
  );

  return [
    {
      id: 'starter-lounge-1',
      title: 'Sesión Nocturna (Base Studio)',
      artist: 'BASA Radio Collective',
      album: 'Cortinas & Bases de Estudio',
      genre: 'Lounge / Ambient',
      duration: 24,
      fileSize: loungeBlob.size,
      mimeType: 'audio/wav',
      fileName: 'basa_sesion_nocturna.wav',
      coverUrl: '/src/assets/images/basa_station_cover_1795431407775.jpg',
      isFavorite: true,
      isJingle: false,
      isStarter: true,
      playCount: 0,
      addedAt: now - 3000,
      audioBlob: loungeBlob,
    },
    {
      id: 'starter-pulse-2',
      title: 'Frecuencia Urbana (Instrumental)',
      artist: 'BASA Studio Sessions',
      album: 'Cortinas & Bases de Estudio',
      genre: 'Deep Groove',
      duration: 20,
      fileSize: pulseBlob.size,
      mimeType: 'audio/wav',
      fileName: 'basa_frecuencia_urbana.wav',
      coverUrl: '/src/assets/images/basa_vinyl_night_1795431408333.jpg',
      isFavorite: false,
      isJingle: false,
      isStarter: true,
      playCount: 0,
      addedAt: now - 2000,
      audioBlob: pulseBlob,
    },
    {
      id: 'starter-jingle-1',
      title: 'Pisador Identificación BASA',
      artist: 'BASA Radio ID',
      album: 'Jingles de Emisora',
      genre: 'Jingle / Cortina',
      duration: 6,
      fileSize: jingleBlob.size,
      mimeType: 'audio/wav',
      fileName: 'basa_id_jingle.wav',
      coverUrl: '/src/assets/images/basa_station_cover_1795431407775.jpg',
      isFavorite: false,
      isJingle: true,
      isStarter: true,
      playCount: 0,
      addedAt: now - 1000,
      audioBlob: jingleBlob,
    },
  ];
}
