import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Play,
  Pause,
  Download,
  Lock,
  FileSignature,
  CreditCard,
  Loader2,
  Film,
  Music,
  FileText,
} from 'lucide-react';
import { CreativeProduction, VideoResolution } from '../types/radio';
import { renderAiSongToWav } from '../utils/aiMusicRenderer';
import { drawCinemaFrame, exportProductionVideoWebM } from '../utils/cinemaVideoRenderer';

interface CinemaPlayerModalProps {
  production: CreativeProduction;
  isOwner: boolean;
  onOpenContract: () => void;
  onOpenPayment: () => void;
  onClose: () => void;
}

export const CinemaPlayerModal: React.FC<CinemaPlayerModalProps> = ({
  production,
  isOwner,
  onOpenContract,
  onOpenPayment,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const [soundtrackBlob, setSoundtrackBlob] = useState<Blob | null>(null);
  const [isPreparingAudio, setIsPreparingAudio] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportRes, setExportRes] = useState<VideoResolution>(production.resolution || '5K');
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  const canDownload = isOwner && production.contractSigned && production.isPaid;

  // Synthesize the production's original soundtrack WAV on mount
  useEffect(() => {
    let active = true;
    (async () => {
      setIsPreparingAudio(true);
      try {
        const { blob } = await renderAiSongToWav({
          title: production.title,
          artist: production.ownerName,
          genre: production.genre,
          bpm: production.bpm,
          musicalKey: 'Am',
          mood: production.genre,
          drumStyle: production.drumStyle,
          sunoPrompt: production.soundtrackPrompt,
          lyrics: production.lyrics,
          vocalHookText: '',
          vocalStyle: '',
          youtubeTitle: production.title,
          youtubeDescription: production.logline,
          youtubeTags: [],
          socialCaption: production.logline,
          chordProgression: production.chordProgression,
          bassNotes: production.bassNotes,
          melodyNotes: production.melodyNotes,
        });
        if (!active) return;
        setSoundtrackBlob(blob);
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        if (audioRef.current) {
          audioRef.current.src = url;
        }
      } catch {
        // ignore audio synth fallback
      }
      if (active) setIsPreparingAudio(false);
    })();

    return () => {
      active = false;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [production]);

  // Real-time 16:9 Cinema Canvas Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const render = () => {
      const audio = audioRef.current;
      const elapsed = audio && audio.currentTime > 0 ? audio.currentTime : activeSceneIndex * 4 + 3;
      const total = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 28;
      drawCinemaFrame(ctx, canvas.width, canvas.height, production, elapsed, total);
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [production, activeSceneIndex]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const jumpToScene = (idx: number) => {
    setActiveSceneIndex(idx);
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.duration) && audio.duration > 4) {
      const target = 2.8 + (idx / Math.max(1, production.scenes.length)) * (audio.duration - 2.8);
      audio.currentTime = target;
      if (!isPlaying) {
        audio.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const handleDownloadVideoMaster = async () => {
    if (!canDownload || !soundtrackBlob) return;
    setExportProgress(0);
    try {
      const webm = await exportProductionVideoWebM({
        production,
        soundtrackBlob,
        exportResolution: exportRes,
        onProgress: (pct) => setExportProgress(pct),
      });
      const url = URL.createObjectURL(webm);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${production.title.replace(/[^a-z0-9\-_ ]/gi, '_')}_${exportRes}_HighHD.webm`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setExportProgress(null);
    }
  };

  const handleDownloadAudio = () => {
    if (!canDownload || !soundtrackBlob) return;
    const url = URL.createObjectURL(soundtrackBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${production.title.replace(/[^a-z0-9\-_ ]/gi, '_')}_Soundtrack.wav`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handleDownloadScript = () => {
    if (!canDownload) return;
    const text = [
      `TÍTULO: ${production.title}`,
      `FORMATO: ${production.format.toUpperCase()} (${production.resolution})`,
      `ESTUDIO: ${production.studioStyle} · PLATAFORMA: ${production.targetPlatform}`,
      `GÉNERO: ${production.genre} · CLASIFICACIÓN: ${production.rating}`,
      `CONTRATO DE CESIÓN FIRMADO: ${production.contractSignerName} (${production.contractHash})`,
      '',
      `LOGLINE: ${production.logline}`,
      '',
      `SINOPSIS:\n${production.synopsis}`,
      '',
      'PERSONAJES:',
      ...production.characters.map((c) => `- ${c.name} (${c.role}): ${c.description}`),
      '',
      'ESCENAS / EPISODIOS:',
      ...production.scenes.map(
        (s) =>
          `\n${s.index}. ${s.title} (${s.durationLabel})\nCámara/Luz: ${s.cameraAndLighting}\nVisual: ${s.visualDescription}\nDiálogo: "${s.dialogue}"`
      ),
      '',
      `LETRA TEMA PRINCIPAL:\n${production.lyrics}`,
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${production.title.replace(/[^a-z0-9\-_ ]/gi, '_')}_Guion_Completo.txt`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl border border-white/15 bg-[#121722] overflow-hidden my-6">
        <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />

        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-amber-300 font-semibold">{production.studioStyle}</span>
              <span aria-hidden="true">·</span>
              <span>{production.resolution} High HD</span>
              <span aria-hidden="true">·</span>
              <span>{production.targetPlatform}</span>
            </div>
            <h3 className="text-lg font-bold text-white truncate mt-0.5">{production.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* 16:9 Interactive Cinema Theatre Viewport */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
            <canvas ref={canvasRef} width={1280} height={720} className="w-full aspect-video block" />
            <div className="px-4 py-3 bg-[#0B0E14] border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={isPreparingAudio}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
                >
                  {isPreparingAudio ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span>
                    {isPreparingAudio
                      ? 'Masterizando Audio...'
                      : isPlaying
                      ? 'Pausar Proyección'
                      : 'Reproducir Online'}
                  </span>
                </button>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Previsualización streaming gratuita · Descarga protegida
                </span>
              </div>

              {isOwner && (
                <div className="flex items-center gap-2">
                  <select
                    value={exportRes}
                    onChange={(e) => setExportRes(e.target.value as VideoResolution)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#121722] border border-white/10 text-xs text-white"
                  >
                    <option value="5K">5K High HD (5120×2880)</option>
                    <option value="4K">4K UHD (3840×2160)</option>
                    <option value="1080p">Full HD (1920×1080)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Strict Contract & Payment Download Gate */}
          {isOwner && (
            <div className="rounded-xl border border-white/10 bg-[#0B0E14] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    {canDownload ? (
                      <Film className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-amber-400" />
                    )}
                    <span>
                      {canDownload
                        ? 'Descarga Desbloqueada · Derechos Cedidos y Licencia Pagada'
                        : 'Descarga Bloqueada · Firma de Contrato y Pago Requeridos'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    {production.contractSigned
                      ? `Contrato firmado por ${production.contractSignerName} (${production.contractHash})`
                      : 'Paso 1: Firma el contrato de cesión total de derechos de autor.'}{' '}
                    · {production.isPaid ? `Licencia activa: ${production.licenseTier}` : 'Paso 2: Realiza el pago para habilitar descargas.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!production.contractSigned && (
                    <button
                      type="button"
                      onClick={onOpenContract}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      <span>1. Firmar Contrato</span>
                    </button>
                  )}

                  {!production.isPaid && (
                    <button
                      type="button"
                      onClick={onOpenPayment}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>2. Pagar Licencia</span>
                    </button>
                  )}

                  {canDownload && (
                    <>
                      <button
                        type="button"
                        onClick={handleDownloadVideoMaster}
                        disabled={exportProgress !== null || !soundtrackBlob}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
                      >
                        {exportProgress !== null ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {exportProgress !== null
                            ? `Renderizando ${exportProgress}%`
                            : `Video ${exportRes}`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadAudio}
                        disabled={!soundtrackBlob}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white cursor-pointer"
                      >
                        <Music className="w-3.5 h-3.5" />
                        <span>Audio WAV</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadScript}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Guion</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Synopsis, Characters & Scene/Episode Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#0B0E14] p-4 space-y-2">
                <h4 className="text-xs font-semibold text-amber-300">Sinopsis &amp; Logline</h4>
                <p className="text-xs text-white font-medium">{production.logline}</p>
                <p className="text-xs text-slate-400 whitespace-pre-line leading-relaxed">
                  {production.synopsis}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0B0E14] p-4 space-y-2.5">
                <h4 className="text-xs font-semibold text-slate-300">Reparto y Personajes</h4>
                {production.characters.map((c, idx) => (
                  <div key={idx} className="text-xs border-t border-white/6 pt-2 first:border-0 first:pt-0">
                    <p className="font-semibold text-white">
                      {c.name} · <span className="text-rose-400 font-normal">{c.role}</span>
                    </p>
                    <p className="text-slate-400 mt-0.5">{c.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#0B0E14] p-4 space-y-3">
              <h4 className="text-xs font-semibold text-slate-300">
                {production.format === 'series'
                  ? 'Episodios de Temporada (Clic para proyectar)'
                  : 'Escenas Cinematográficas (Clic para proyectar)'}
              </h4>
              <div className="space-y-2">
                {production.scenes.map((sc, i) => (
                  <button
                    key={sc.index}
                    type="button"
                    onClick={() => jumpToScene(i)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      activeSceneIndex === i
                        ? 'bg-rose-500/12 border-rose-500/40'
                        : 'bg-[#121722] border-white/8 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">
                        {sc.index}. {sc.title}
                      </span>
                      <span className="font-mono text-slate-400">{sc.durationLabel}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{sc.visualDescription}</p>
                    <p className="text-[11px] text-amber-300 mt-1 italic">
                      &ldquo;{sc.dialogue}&rdquo;
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
