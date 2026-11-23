import { useCallback, useEffect, useRef, useState } from 'react';
import { PlaybackState, RadioStream, StationConfig, Track } from '../types/radio';

export const EQ_FREQUENCIES = [60, 230, 910, 3600, 14000];
export const EQ_LABELS = ['60 Hz', '230 Hz', '910 Hz', '3.6 kHz', '14 kHz'];

export const EQ_PRESETS: Record<string, number[]> = {
  'Radio Broadcast': [1.5, 0.5, 0, 1.5, 2.0],
  Plano: [0, 0, 0, 0, 0],
  'Graves Profundos': [5.5, 3.0, 0, -0.5, 1.0],
  'Voz Clara': [-2.0, -1.0, 3.5, 4.0, 1.5],
  Acústico: [2.0, 1.0, 0.5, 2.5, 3.0],
  'Club Nocturno': [4.5, 2.5, -1.0, 2.0, 4.0],
};

interface EngineProps {
  tracks: Track[];
  queueIds: string[];
  config: StationConfig;
  onTrackEndedOrAdvanced?: (trackId: string) => void;
  onIncrementPlayCount: (trackId: string) => void;
}

export function useRadioEngine({
  tracks,
  queueIds,
  config,
  onIncrementPlayCount,
}: EngineProps) {
  const [playback, setPlayback] = useState<PlaybackState>({
    mode: 'track',
    currentTrackId: null,
    currentStreamId: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isCrossfading: false,
    micActive: false,
    micError: null,
    streamError: null,
    activeJingleId: null,
  });

  const [micMonitorEnabled, setMicMonitorEnabled] = useState(false);

  // Refs for latest props inside async callbacks
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const queueIdsRef = useRef(queueIds);
  queueIdsRef.current = queueIds;
  const configRef = useRef(config);
  configRef.current = config;
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  // Web Audio graph refs
  const ctxRef = useRef<AudioContext | null>(null);
  const deckARef = useRef<HTMLAudioElement | null>(null);
  const deckBRef = useRef<HTMLAudioElement | null>(null);
  const activeDeckRef = useRef<'A' | 'B'>('A');
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);
  const musicBusGainRef = useRef<GainNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // Jingle audio
  const jingleAudioRef = useRef<HTMLAudioElement | null>(null);
  const jingleGainRef = useRef<GainNode | null>(null);
  const jingleUrlRef = useRef<string | null>(null);

  // External stream audio (direct element to avoid CORS silence)
  const streamAudioRef = useRef<HTMLAudioElement | null>(null);

  // Mic stream
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);

  // Blob URL cache cleanup
  const deckAUrlRef = useRef<string | null>(null);
  const deckBUrlRef = useRef<string | null>(null);
  const crossfadeTriggeredRef = useRef<string | null>(null);

  const ensureAudioGraph = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') {
        ctxRef.current.resume().catch(() => {});
      }
      return ctxRef.current;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;

    const deckA = new Audio();
    deckA.preload = 'auto';
    const deckB = new Audio();
    deckB.preload = 'auto';
    const jingleAudio = new Audio();
    jingleAudio.preload = 'auto';
    const streamAudio = new Audio();
    streamAudio.preload = 'none';

    deckARef.current = deckA;
    deckBRef.current = deckB;
    jingleAudioRef.current = jingleAudio;
    streamAudioRef.current = streamAudio;

    const srcA = ctx.createMediaElementSource(deckA);
    const srcB = ctx.createMediaElementSource(deckB);
    const srcJingle = ctx.createMediaElementSource(jingleAudio);

    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    const musicBus = ctx.createGain();
    const jingleGain = ctx.createGain();
    const masterGain = ctx.createGain();

    gainA.gain.value = 1;
    gainB.gain.value = 0;
    musicBus.gain.value = 1;
    jingleGain.gain.value = 1;
    masterGain.gain.value = configRef.current.masterVolume;

    gainARef.current = gainA;
    gainBRef.current = gainB;
    musicBusGainRef.current = musicBus;
    jingleGainRef.current = jingleGain;
    masterGainRef.current = masterGain;

    // 5-band EQ
    const eqNodes = EQ_FREQUENCIES.map((freq, idx) => {
      const filter = ctx.createBiquadFilter();
      filter.type = idx === 0 ? 'lowshelf' : idx === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.1;
      filter.gain.value = configRef.current.eqBands[idx] ?? 0;
      return filter;
    });
    eqNodesRef.current = eqNodes;

    // Broadcast Compressor
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;
    compressorRef.current = compressor;

    // Analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    // Wire graph:
    // srcA -> gainA -> musicBus
    // srcB -> gainB -> musicBus
    // musicBus -> eq0 -> eq1 -> eq2 -> eq3 -> eq4 -> (compressor or bypass) -> analyser -> masterGain -> destination
    // srcJingle -> jingleGain -> analyser
    srcA.connect(gainA);
    srcB.connect(gainB);
    gainA.connect(musicBus);
    gainB.connect(musicBus);

    let chainNode: AudioNode = musicBus;
    for (const eq of eqNodes) {
      chainNode.connect(eq);
      chainNode = eq;
    }

    chainNode.connect(compressor);
    compressor.connect(analyser);
    srcJingle.connect(jingleGain);
    jingleGain.connect(analyser);

    analyser.connect(masterGain);
    masterGain.connect(ctx.destination);

    return ctx;
  }, []);

  // Sync Master Volume
  useEffect(() => {
    const ctx = ctxRef.current;
    if (ctx && masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(config.masterVolume, ctx.currentTime, 0.04);
    }
    if (streamAudioRef.current) {
      streamAudioRef.current.volume = config.masterVolume;
    }
  }, [config.masterVolume]);

  // Sync EQ Gains
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    eqNodesRef.current.forEach((node, idx) => {
      const targetGain = config.eqBands[idx] ?? 0;
      node.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.04);
    });
  }, [config.eqBands]);

  // Sync Compressor ratio (soft bypass when disabled)
  useEffect(() => {
    const ctx = ctxRef.current;
    const comp = compressorRef.current;
    if (ctx && comp) {
      comp.ratio.setTargetAtTime(config.compressorEnabled ? 4.5 : 1, ctx.currentTime, 0.05);
      comp.threshold.setTargetAtTime(config.compressorEnabled ? -16 : 0, ctx.currentTime, 0.05);
    }
  }, [config.compressorEnabled]);

  // Duck music when mic or jingle is active
  const updateDucking = useCallback((micOn: boolean, jingleOn: boolean) => {
    const ctx = ctxRef.current;
    const bus = musicBusGainRef.current;
    if (!ctx || !bus) return;
    const target = micOn ? 0.22 : jingleOn ? 0.35 : 1.0;
    bus.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
  }, []);

  const stopStreamElement = useCallback(() => {
    const s = streamAudioRef.current;
    if (s) {
      s.pause();
      s.removeAttribute('src');
      s.load();
    }
  }, []);

  const getActiveAudio = useCallback(() => {
    return activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
  }, []);

  const getNextTrackId = useCallback((currentId: string | null): string | null => {
    const q = queueIdsRef.current;
    if (q.length === 0) return null;
    if (configRef.current.shuffleEnabled && q.length > 1) {
      const candidates = q.filter((id) => id !== currentId);
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    if (!currentId) return q[0];
    const idx = q.indexOf(currentId);
    if (idx === -1) return q[0];
    if (idx + 1 < q.length) return q[idx + 1];
    if (configRef.current.repeatMode === 'all') return q[0];
    return null;
  }, []);

  const getPrevTrackId = useCallback((currentId: string | null): string | null => {
    const q = queueIdsRef.current;
    if (q.length === 0) return null;
    if (!currentId) return q[0];
    const idx = q.indexOf(currentId);
    if (idx <= 0) return q[q.length - 1];
    return q[idx - 1];
  }, []);

  const playTrack = useCallback(
    async (trackId: string, withCrossfade = false) => {
      const track = tracksRef.current.find((t) => t.id === trackId);
      if (!track || !track.audioBlob) return;

      const ctx = ensureAudioGraph();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      stopStreamElement();

      const useCrossfade =
        withCrossfade &&
        configRef.current.crossfadeSeconds > 0 &&
        playbackRef.current.mode === 'track' &&
        playbackRef.current.isPlaying;

      const outgoingDeck = activeDeckRef.current;
      const incomingDeck: 'A' | 'B' = useCrossfade ? (outgoingDeck === 'A' ? 'B' : 'A') : outgoingDeck;

      const outAudio = outgoingDeck === 'A' ? deckARef.current! : deckBRef.current!;
      const inAudio = incomingDeck === 'A' ? deckARef.current! : deckBRef.current!;
      const outGain = outgoingDeck === 'A' ? gainARef.current! : gainBRef.current!;
      const inGain = incomingDeck === 'A' ? gainARef.current! : gainBRef.current!;

      // Clean old blob URL on incoming deck
      const urlRef = incomingDeck === 'A' ? deckAUrlRef : deckBUrlRef;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
      const nextUrl = URL.createObjectURL(track.audioBlob);
      urlRef.current = nextUrl;

      if (!useCrossfade) {
        // Stop the other deck cleanly
        const otherAudio = incomingDeck === 'A' ? deckBRef.current! : deckARef.current!;
        const otherGain = incomingDeck === 'A' ? gainBRef.current! : gainARef.current!;
        otherAudio.pause();
        otherAudio.currentTime = 0;
        otherGain.gain.setValueAtTime(0, ctx.currentTime);
        inGain.gain.setValueAtTime(1, ctx.currentTime);
      } else {
        const cfSec = configRef.current.crossfadeSeconds;
        const now = ctx.currentTime;
        outGain.gain.cancelScheduledValues(now);
        outGain.gain.setValueAtTime(outGain.gain.value, now);
        outGain.gain.linearRampToValueAtTime(0, now + cfSec);

        inGain.gain.cancelScheduledValues(now);
        inGain.gain.setValueAtTime(0, now);
        inGain.gain.linearRampToValueAtTime(1, now + cfSec);

        setPlayback((prev) => ({ ...prev, isCrossfading: true }));
        window.setTimeout(() => {
          outAudio.pause();
          outAudio.currentTime = 0;
          setPlayback((prev) => ({ ...prev, isCrossfading: false }));
        }, cfSec * 1000 + 80);
      }

      activeDeckRef.current = incomingDeck;
      crossfadeTriggeredRef.current = null;
      inAudio.src = nextUrl;
      inAudio.currentTime = 0;

      try {
        await inAudio.play();
        onIncrementPlayCount(track.id);
        setPlayback((prev) => ({
          ...prev,
          mode: 'track',
          currentTrackId: track.id,
          currentStreamId: null,
          isPlaying: true,
          currentTime: 0,
          duration: track.duration || inAudio.duration || 0,
          streamError: null,
        }));
      } catch {
        setPlayback((prev) => ({
          ...prev,
          isPlaying: false,
          streamError: 'No se pudo iniciar la reproducción automática. Pulsa Reproducir.',
        }));
      }
    },
    [ensureAudioGraph, onIncrementPlayCount, stopStreamElement]
  );

  const playStream = useCallback(
    async (stream: RadioStream) => {
      ensureAudioGraph();
      // Pause track decks
      deckARef.current?.pause();
      deckBRef.current?.pause();

      const sAudio = streamAudioRef.current;
      if (!sAudio) return;

      sAudio.src = stream.url;
      sAudio.volume = configRef.current.masterVolume;

      setPlayback((prev) => ({
        ...prev,
        mode: 'stream',
        currentStreamId: stream.id,
        isPlaying: true,
        currentTime: 0,
        duration: 0,
        streamError: null,
      }));

      try {
        await sAudio.play();
      } catch {
        setPlayback((prev) => ({
          ...prev,
          isPlaying: false,
          streamError: 'No se pudo conectar a esta emisora externa (URL bloqueada o sin conexión).',
        }));
      }
    },
    [ensureAudioGraph]
  );

  const togglePlayPause = useCallback(async () => {
    const pb = playbackRef.current;
    if (pb.mode === 'stream' && pb.currentStreamId) {
      const sAudio = streamAudioRef.current;
      if (!sAudio) return;
      if (pb.isPlaying) {
        sAudio.pause();
        setPlayback((p) => ({ ...p, isPlaying: false }));
      } else {
        try {
          await sAudio.play();
          setPlayback((p) => ({ ...p, isPlaying: true, streamError: null }));
        } catch {
          setPlayback((p) => ({ ...p, streamError: 'Error al reanudar la emisora.' }));
        }
      }
      return;
    }

    const activeAudio = getActiveAudio();
    if (!pb.currentTrackId || !activeAudio || !activeAudio.src) {
      const firstId = queueIdsRef.current[0] || tracksRef.current[0]?.id;
      if (firstId) {
        await playTrack(firstId, false);
      }
      return;
    }

    const ctx = ensureAudioGraph();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    if (pb.isPlaying) {
      activeAudio.pause();
      setPlayback((p) => ({ ...p, isPlaying: false }));
    } else {
      await activeAudio.play().catch(() => {});
      setPlayback((p) => ({ ...p, isPlaying: true }));
    }
  }, [ensureAudioGraph, getActiveAudio, playTrack]);

  const playNext = useCallback(
    async (withCrossfade = false) => {
      const nextId = getNextTrackId(playbackRef.current.currentTrackId);
      if (nextId) {
        await playTrack(nextId, withCrossfade);
      } else {
        const active = getActiveAudio();
        active?.pause();
        setPlayback((p) => ({ ...p, isPlaying: false, currentTime: 0 }));
      }
    },
    [getActiveAudio, getNextTrackId, playTrack]
  );

  const playPrevious = useCallback(async () => {
    const active = getActiveAudio();
    if (active && active.currentTime > 3) {
      active.currentTime = 0;
      setPlayback((p) => ({ ...p, currentTime: 0 }));
      return;
    }
    const prevId = getPrevTrackId(playbackRef.current.currentTrackId);
    if (prevId) {
      await playTrack(prevId, false);
    }
  }, [getActiveAudio, getPrevTrackId, playTrack]);

  const seekTo = useCallback(
    (timeSec: number) => {
      if (playbackRef.current.mode !== 'track') return;
      const active = getActiveAudio();
      if (active && Number.isFinite(timeSec)) {
        active.currentTime = Math.max(0, Math.min(timeSec, active.duration || timeSec));
        setPlayback((p) => ({ ...p, currentTime: active.currentTime }));
      }
    },
    [getActiveAudio]
  );

  const triggerJingle = useCallback(
    async (jingleTrack: Track) => {
      if (!jingleTrack.audioBlob) return;
      const ctx = ensureAudioGraph();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      const jAudio = jingleAudioRef.current;
      if (!jAudio) return;

      if (jingleUrlRef.current) {
        URL.revokeObjectURL(jingleUrlRef.current);
      }
      const url = URL.createObjectURL(jingleTrack.audioBlob);
      jingleUrlRef.current = url;

      jAudio.src = url;
      jAudio.currentTime = 0;
      updateDucking(playbackRef.current.micActive, true);
      setPlayback((p) => ({ ...p, activeJingleId: jingleTrack.id }));

      jAudio.onended = () => {
        setPlayback((p) => ({ ...p, activeJingleId: null }));
        updateDucking(playbackRef.current.micActive, false);
      };

      try {
        await jAudio.play();
      } catch {
        setPlayback((p) => ({ ...p, activeJingleId: null }));
        updateDucking(playbackRef.current.micActive, false);
      }
    },
    [ensureAudioGraph, updateDucking]
  );

  const toggleMic = useCallback(async () => {
    const ctx = ensureAudioGraph();
    if (playbackRef.current.micActive) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micSourceRef.current?.disconnect();
      micGainRef.current?.disconnect();
      micStreamRef.current = null;
      micSourceRef.current = null;
      micGainRef.current = null;
      setPlayback((p) => ({ ...p, micActive: false, micError: null }));
      updateDucking(false, Boolean(playbackRef.current.activeJingleId));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const src = ctx.createMediaStreamSource(stream);
      const micGain = ctx.createGain();
      micGain.gain.value = micMonitorEnabled ? 0.9 : 0;

      src.connect(micGain);
      if (analyserRef.current) {
        micGain.connect(analyserRef.current);
      }

      micStreamRef.current = stream;
      micSourceRef.current = src;
      micGainRef.current = micGain;

      setPlayback((p) => ({ ...p, micActive: true, micError: null }));
      updateDucking(true, Boolean(playbackRef.current.activeJingleId));
    } catch {
      setPlayback((p) => ({
        ...p,
        micActive: false,
        micError: 'Permiso de micrófono denegado o dispositivo no disponible.',
      }));
    }
  }, [ensureAudioGraph, micMonitorEnabled, updateDucking]);

  // Update mic monitor gain dynamically
  useEffect(() => {
    const ctx = ctxRef.current;
    if (ctx && micGainRef.current) {
      micGainRef.current.gain.setTargetAtTime(micMonitorEnabled ? 0.9 : 0, ctx.currentTime, 0.05);
    }
  }, [micMonitorEnabled]);

  // Polling loop for timeupdate + Auto-DJ Crossfade trigger
  useEffect(() => {
    const interval = window.setInterval(() => {
      const pb = playbackRef.current;
      if (pb.mode !== 'track' || !pb.isPlaying) return;

      const active = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
      if (!active) return;

      const ct = active.currentTime || 0;
      const dur = Number.isFinite(active.duration) && active.duration > 0 ? active.duration : pb.duration;

      setPlayback((prev) => {
        if (Math.abs(prev.currentTime - ct) < 0.2 && prev.duration === dur) return prev;
        return { ...prev, currentTime: ct, duration: dur };
      });

      const cfg = configRef.current;
      // Trigger crossfade when approaching end
      if (
        cfg.autoDjEnabled &&
        cfg.crossfadeSeconds > 0 &&
        cfg.repeatMode !== 'one' &&
        dur > cfg.crossfadeSeconds + 2 &&
        dur - ct <= cfg.crossfadeSeconds &&
        crossfadeTriggeredRef.current !== pb.currentTrackId
      ) {
        const nextId = getNextTrackId(pb.currentTrackId);
        if (nextId && nextId !== pb.currentTrackId) {
          crossfadeTriggeredRef.current = pb.currentTrackId;
          playTrack(nextId, true);
        }
      }

      // Handle natural track end
      if (active.ended) {
        if (cfg.repeatMode === 'one' && pb.currentTrackId) {
          active.currentTime = 0;
          active.play().catch(() => {});
        } else if (cfg.autoDjEnabled) {
          playNext(false);
        } else {
          setPlayback((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
        }
      }
    }, 200);

    return () => window.clearInterval(interval);
  }, [getNextTrackId, playNext, playTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deckAUrlRef.current) URL.revokeObjectURL(deckAUrlRef.current);
      if (deckBUrlRef.current) URL.revokeObjectURL(deckBUrlRef.current);
      if (jingleUrlRef.current) URL.revokeObjectURL(jingleUrlRef.current);
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return {
    playback,
    analyserNode: analyserRef.current,
    micMonitorEnabled,
    setMicMonitorEnabled,
    playTrack,
    playStream,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    triggerJingle,
    toggleMic,
  };
}
