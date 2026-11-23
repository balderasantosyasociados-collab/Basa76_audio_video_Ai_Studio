import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Play,
  Radio,
  Pencil,
  Trash2,
  Share2,
  Download,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Volume2,
  X,
  Mic,
} from 'lucide-react';
import {
  AiGeneratedSong,
  AiSongBlueprint,
  AiTrendItem,
  AiTrendSource,
} from '../types/radio';
import { renderAiSongToWav } from '../utils/aiMusicRenderer';
import { formatBytes, formatTime } from '../utils/id3Parser';
import { CoverArtwork } from './CoverArtwork';
import { PublishShareModal } from './PublishShareModal';

interface AiMusicStudioViewProps {
  aiSongs: AiGeneratedSong[];
  currentPlayingTrackId: string | null;
  isPlaying: boolean;
  onSaveAiSong: (song: AiGeneratedSong) => Promise<void>;
  onDeleteAiSong: (id: string) => Promise<void>;
  onPublishToRadio: (song: AiGeneratedSong, playImmediately?: boolean) => Promise<void>;
}

const GENRE_OPTIONS = [
  'Automático (Según Tendencia)',
  'Reggaetón Melódico',
  'Pop Urbano',
  'Synthwave Nocturno',
  'Afrobeats',
  'House Electrónico',
  'Trap / Hip-Hop',
  'Lo-Fi Chill',
  'Rock Alternativo',
];

const VOICE_OPTIONS = [
  { id: 'Kore', label: 'Voz Femenina Clara (Kore)' },
  { id: 'Puck', label: 'Voz Juvenil Dinámica (Puck)' },
  { id: 'Fenrir', label: 'Voz Urbana Grave (Fenrir)' },
  { id: 'Zephyr', label: 'Voz Suave Melódica (Zephyr)' },
];

export const AiMusicStudioView: React.FC<AiMusicStudioViewProps> = ({
  aiSongs,
  currentPlayingTrackId,
  isPlaying,
  onSaveAiSong,
  onDeleteAiSong,
  onPublishToRadio,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [selectedGenre, setSelectedGenre] = useState(GENRE_OPTIONS[0]);
  const [language, setLanguage] = useState('Español');
  const [includeAiVocal, setIncludeAiVocal] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [autoPublishRadio, setAutoPublishRadio] = useState(true);

  // Autonomous 5-second live ticker & autopilot
  const [autoPilot, setAutoPilot] = useState(false);
  const [countdown5s, setCountdown5s] = useState(5);
  const [liveStatusLine, setLiveStatusLine] = useState('Monitor en vivo activo');

  // Trend Radar State
  const [trends, setTrends] = useState<AiTrendItem[]>([]);
  const [trendPulse, setTrendPulse] = useState('');
  const [trendSources, setTrendSources] = useState<AiTrendSource[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  // Song Generation Pipeline State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Modals & Editors
  const [editingSong, setEditingSong] = useState<AiGeneratedSong | null>(null);
  const [isReRendering, setIsReRendering] = useState(false);
  const [sharingSong, setSharingSong] = useState<AiGeneratedSong | null>(null);
  const [lyricsPreviewSong, setLyricsPreviewSong] = useState<AiGeneratedSong | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  const isGeneratingRef = useRef(isGenerating);
  isGeneratingRef.current = isGenerating;
  const trendsRef = useRef(trends);
  trendsRef.current = trends;

  const fetchTrends = useCallback(async (focusOverride?: string) => {
    setIsLoadingTrends(true);
    setTrendError(null);
    try {
      const resp = await fetch('/api/ai/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: 'Latinoamérica y Tendencias Globales',
          focus: focusOverride || 'música viral, YouTube, TikTok, cultura pop y noticias actuales',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setTrendError(data.error || 'No se pudo consultar el radar de tendencias.');
        setIsLoadingTrends(false);
        return null;
      }
      setTrends(data.trends || []);
      setTrendPulse(data.pulseSummary || '');
      setTrendSources(data.sources || []);
      setIsLoadingTrends(false);
      return (data.trends || []) as AiTrendItem[];
    } catch (err) {
      setTrendError(err instanceof Error ? err.message : 'Error de red consultando tendencias.');
      setIsLoadingTrends(false);
      return null;
    }
  }, []);

  // Load initial trends on first visit
  useEffect(() => {
    if (trends.length === 0 && !isLoadingTrends) {
      fetchTrends();
    }
  }, [fetchTrends, isLoadingTrends, trends.length]);

  const produceFullSong = useCallback(
    async (opts: { prompt: string; trend?: AiTrendItem; autoPlay?: boolean }) => {
      if (isGeneratingRef.current) return;
      setIsGenerating(true);
      setGenerationError(null);

      try {
        setGenerationStage('1/3 · Componiendo letra, género y estructura musical con Gemini AI...');
        const composeResp = await fetch('/api/ai/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: opts.prompt,
            genre:
              opts.trend?.suggestedGenre ||
              (selectedGenre === GENRE_OPTIONS[0] ? '' : selectedGenre),
            language,
            trendContext: opts.trend
              ? `${opts.trend.topic} (${opts.trend.sourcePlatform}): ${opts.trend.angle}`
              : '',
          }),
        });
        const blueprint = (await composeResp.json()) as AiSongBlueprint & { error?: string };
        if (!composeResp.ok) {
          throw new Error(blueprint.error || 'Fallo al componer el tema con IA.');
        }

        let vocalBase64: string | undefined;
        if (includeAiVocal && blueprint.vocalHookText) {
          setGenerationStage('2/3 · Grabando interpretación vocal IA...');
          try {
            const vocalResp = await fetch('/api/ai/vocal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: blueprint.vocalHookText,
                style: blueprint.vocalStyle || `Expressive ${blueprint.genre} radio vocalist`,
                voiceName: selectedVoice,
              }),
            });
            if (vocalResp.ok) {
              const vData = await vocalResp.json();
              vocalBase64 = vData.audioBase64;
            }
          } catch {
            // Continue cleanly with instrumental if vocal TTS fails
          }
        }

        setGenerationStage('3/3 · Masterizando pista estéreo WAV 44.1 kHz...');
        const { blob, duration } = await renderAiSongToWav(blueprint, vocalBase64);

        const newSong: AiGeneratedSong = {
          ...blueprint,
          id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          promptUsed: opts.prompt,
          trendTopic: opts.trend?.topic,
          engineLabel: vocalBase64 ? 'Gemini AI + Voz IA + Motor WAV' : 'Gemini AI + Motor WAV',
          hasVocal: Boolean(vocalBase64),
          duration,
          fileSize: blob.size,
          coverUrl:
            aiSongs.length % 2 === 0
              ? '/src/assets/images/basa_vinyl_night_1795431408333.jpg'
              : '/src/assets/images/basa_station_cover_1795431407775.jpg',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          audioBlob: blob,
        };

        await onSaveAiSong(newSong);

        if (autoPublishRadio) {
          setGenerationStage('Publicando pista lista en la Emisora BASA Radio...');
          await onPublishToRadio(newSong, Boolean(opts.autoPlay));
        }

        setGenerationStage('');
        setIsGenerating(false);
        setLiveStatusLine(`Última producción publicada: "${newSong.title}"`);
      } catch (err) {
        setGenerationError(
          err instanceof Error ? err.message : 'No se pudo completar la producción musical.'
        );
        setGenerationStage('');
        setIsGenerating(false);
      }
    },
    [
      aiSongs.length,
      autoPublishRadio,
      includeAiVocal,
      language,
      onPublishToRadio,
      onSaveAiSong,
      selectedGenre,
      selectedVoice,
    ]
  );

  // 5-second live refresh cycle + optional Autonomous Autopilot
  useEffect(() => {
    const interval = window.setInterval(async () => {
      setCountdown5s((prev) => {
        if (prev > 1) return prev - 1;

        // Trigger 5-second pulse check
        fetch('/api/health')
          .then((r) => r.json())
          .then((d) => {
            if (d.ok) {
              setLiveStatusLine(
                `Sincronizado · ${new Date().toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}`
              );
            }
          })
          .catch(() => {});

        // If AutoPilot is enabled and idle, autonomously pick a trend or refresh trends & compose a song
        if (autoPilot && !isGeneratingRef.current) {
          const list = trendsRef.current;
          if (list.length > 0) {
            const pick = list[Math.floor(Math.random() * list.length)];
            produceFullSong({ prompt: pick.musicPrompt, trend: pick, autoPlay: true });
          }
        }
        return 5;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [autoPilot, produceFullSong]);

  const handleManualCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = promptInput.trim();
    if (!prompt) return;
    produceFullSong({ prompt, autoPlay: true });
  };

  const handleAutonomousFromTopTrend = async () => {
    let list = trends;
    if (list.length === 0) {
      const fresh = await fetchTrends();
      if (fresh) list = fresh;
    }
    if (list.length > 0) {
      const pick = list[Math.floor(Math.random() * list.length)];
      produceFullSong({ prompt: pick.musicPrompt, trend: pick, autoPlay: true });
    } else {
      produceFullSong({
        prompt: 'Tema viral latino nocturno sobre música, radio digital y energía urbana actual',
        autoPlay: true,
      });
    }
  };

  const handleSaveEditedSong = async (e: React.FormEvent, reRenderAudio: boolean) => {
    e.preventDefault();
    if (!editingSong) return;

    let finalSong = { ...editingSong, updatedAt: Date.now() };

    if (reRenderAudio) {
      setIsReRendering(true);
      try {
        let vocalBase64: string | undefined;
        if (finalSong.hasVocal && finalSong.vocalHookText) {
          const vResp = await fetch('/api/ai/vocal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: finalSong.vocalHookText,
              style: finalSong.vocalStyle,
              voiceName: selectedVoice,
            }),
          });
          if (vResp.ok) {
            const vData = await vResp.json();
            vocalBase64 = vData.audioBase64;
          }
        }
        const { blob, duration } = await renderAiSongToWav(finalSong, vocalBase64);
        finalSong = {
          ...finalSong,
          audioBlob: blob,
          duration,
          fileSize: blob.size,
        };
      } catch {
        // Keep existing audio blob if re-render encounters an error
      }
      setIsReRendering(false);
    }

    await onSaveAiSong(finalSong);
    if (finalSong.publishedTrackId) {
      await onPublishToRadio(finalSong, false);
    }
    setEditingSong(null);
  };

  const copyPromptToClipboard = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPromptId(id);
      window.setTimeout(() => setCopiedPromptId(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Live 5s Sync & Autonomous Creation Bar */}
      <div className="rounded-xl border border-white/10 bg-[#121722] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="text-rose-400 font-semibold">IA Musical Autónoma</span>
            <span aria-hidden="true">·</span>
            <span>Actualización cada 5s</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-200">{countdown5s}s</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-300">{liveStatusLine}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            Productor Musical IA · Tendencias, Letra y Audio Maestro
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setAutoPilot((v) => !v)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              autoPilot
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            Piloto Automático: {autoPilot ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={handleAutonomousFromTopTrend}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Produciendo...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Crear Tema Autónomo Ahora</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Prompt Composer + Cultural Trend Radar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 5 Cols: Custom Prompt / Suno-style Composer */}
        <form
          onSubmit={handleManualCreate}
          className="xl:col-span-5 rounded-xl border border-white/10 bg-[#121722] p-5 space-y-4"
        >
          <div>
            <h3 className="text-base font-semibold text-white">
              Crear Música con Prompt (Estilo Suno / Mureka / Gemini)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Motor gratuito sin claves de usuario: genera letra, género, melodía y audio WAV listo para sonar.
            </p>
          </div>

          <textarea
            rows={3}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="Describe la canción, historia o tendencia (ej. Un reggaetón melódico sobre el verano digital y la radio en vivo, con coro pegajoso)..."
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Género Musical</label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                {GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Idioma</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                <option value="Español">Español</option>
                <option value="Inglés">Inglés</option>
                <option value="Spanglish">Spanglish</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-[#0B0E14] border border-white/8 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAiVocal}
                  onChange={(e) => setIncludeAiVocal(e.target.checked)}
                  className="accent-rose-500"
                />
                <Mic className="w-3.5 h-3.5 text-rose-400" />
                <span>Incluir Interpretación Vocal IA</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPublishRadio}
                  onChange={(e) => setAutoPublishRadio(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Publicar en Radio</span>
              </label>
            </div>

            {includeAiVocal && (
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full px-3 py-1.5 rounded-md bg-[#121722] border border-white/10 text-xs text-slate-200"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {generationStage && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 text-xs text-amber-200 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{generationStage}</span>
            </div>
          )}

          {generationError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3.5 py-2.5 text-xs text-rose-300">
              {generationError}
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating || !promptInput.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-45 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generar Letra, Música y Audio</span>
          </button>

          {/* Direct Links to External Free / Account AI Music Tools */}
          <div className="pt-2 border-t border-white/8">
            <p className="text-[11px] text-slate-400 mb-2">
              Compatibilidad directa de prompts con plataformas externas:
            </p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {[
                { label: 'Suno', url: 'https://suno.com' },
                { label: 'Mureka', url: 'https://www.mureka.ai' },
                { label: 'Udio', url: 'https://www.udio.com' },
                { label: 'Riffusion', url: 'https://www.riffusion.com' },
                { label: 'Gemini', url: 'https://gemini.google.com' },
                { label: 'ChatGPT', url: 'https://chatgpt.com' },
              ].map((ext) => (
                <a
                  key={ext.label}
                  href={ext.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B0E14] border border-white/10 text-slate-300 hover:text-white hover:border-white/25"
                >
                  <span>{ext.label}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ))}
            </div>
          </div>
        </form>

        {/* Right 7 Cols: Cultural & Social Trend Radar */}
        <div className="xl:col-span-7 rounded-xl border border-white/10 bg-[#121722] overflow-hidden">
          <div className="p-5 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-white">
                  Radar de Tendencias Culturales (YouTube · TikTok · Redes · Noticias)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {trendPulse || 'Búsqueda en tiempo real para inspirar nuevos éxitos'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchTrends()}
              disabled={isLoadingTrends}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTrends ? 'animate-spin' : ''}`} />
              <span>Actualizar Radar</span>
            </button>
          </div>

          {trendError && (
            <div className="m-5 rounded-lg bg-rose-500/10 border border-rose-500/25 px-4 py-3 text-xs text-rose-300">
              {trendError}
            </div>
          )}

          {isLoadingTrends && trends.length === 0 ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-[#0B0E14] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-white/6">
              {trends.map((trend) => (
                <div
                  key={trend.id}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02]"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="text-amber-300 font-medium">{trend.sourcePlatform}</span>
                      <span aria-hidden="true">·</span>
                      <span>{trend.suggestedGenre}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{trend.bpm} BPM</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">{trend.topic}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{trend.angle}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      produceFullSong({
                        prompt: trend.musicPrompt,
                        trend,
                        autoPlay: true,
                      })
                    }
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-rose-600 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Convertir en Música</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {trendSources.length > 0 && (
            <div className="px-5 py-3 border-t border-white/8 bg-[#0B0E14]/50">
              <p className="text-[11px] text-slate-400 mb-1.5">Fuentes consultadas en vivo:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {trendSources.map((src, i) => (
                  <a
                    key={`${src.uri}-${i}`}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-slate-300 hover:text-rose-300 underline truncate max-w-[220px]"
                  >
                    {src.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Persistent AI Music History */}
      <div className="rounded-xl border border-white/10 bg-[#121722] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              Histórico de Canciones Generadas por IA
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Repite, edita letra/estilo, publica en BASA Radio, descarga WAV o comparte en YouTube y redes.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-400">
            {aiSongs.length} {aiSongs.length === 1 ? 'producción' : 'producciones'}
          </span>
        </div>

        {aiSongs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-200">
              Aún no has generado canciones en el estudio IA
            </p>
            <p className="text-xs text-slate-400">
              Elige una tendencia del radar o escribe un prompt para producir tu primera pista con letra y audio.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/6">
            {aiSongs.map((song) => {
              const isOnAir =
                song.publishedTrackId &&
                currentPlayingTrackId === song.publishedTrackId &&
                isPlaying;

              return (
                <div
                  key={song.id}
                  className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02]"
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <CoverArtwork
                      src={song.coverUrl}
                      alt={song.title}
                      size="md"
                      className="w-14 h-14 rounded-lg border border-white/10 shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{song.genre}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{song.bpm} BPM</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{song.musicalKey}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{formatTime(song.duration)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatBytes(song.fileSize)}</span>
                        {isOnAir && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-rose-400 font-semibold">Sonando en Emisora</span>
                          </>
                        )}
                      </div>

                      <h4 className="text-sm sm:text-base font-semibold text-white truncate">
                        {song.title}
                      </h4>
                      <p className="text-xs text-slate-400 truncate">
                        {song.artist} · {song.engineLabel}
                        {song.trendTopic ? ` · Tendencia: ${song.trendTopic}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPublishToRadio(song, true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white cursor-pointer"
                    >
                      {isOnAir ? <Volume2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{isOnAir ? 'Al Aire' : 'Repetir / Emitir'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPublishToRadio(song, false)}
                      title="Publicar en biblioteca de emisora"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/8 hover:bg-white/12 text-xs text-slate-200 cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Publicar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLyricsPreviewSong(song)}
                      className="px-3 py-2 rounded-lg bg-white/6 hover:bg-white/12 text-xs text-slate-200 cursor-pointer"
                    >
                      Letra &amp; Prompt
                    </button>

                    <button
                      type="button"
                      onClick={() => setSharingSong(song)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-medium text-amber-200 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>YouTube / Redes</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingSong(song)}
                      title="Editar tema y letra"
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const url = URL.createObjectURL(song.audioBlob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${song.title.replace(/[^a-z0-9\-_ ]/gi, '_')}.wav`;
                        a.click();
                        window.setTimeout(() => URL.revokeObjectURL(url), 3000);
                      }}
                      title="Descargar Audio WAV"
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteAiSong(song.id)}
                      title="Borrar del histórico"
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/8 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lyrics & Multi-AI Prompt Viewer Modal */}
      {lyricsPreviewSong && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl border border-white/15 bg-[#121722] p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{lyricsPreviewSong.title}</h3>
                <p className="text-xs text-slate-400">
                  {lyricsPreviewSong.genre} · {lyricsPreviewSong.bpm} BPM · {lyricsPreviewSong.musicalKey}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLyricsPreviewSong(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-lg bg-[#0B0E14] border border-white/10 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-300">
                  Prompt Maestro (Suno / Mureka / Gemini / ChatGPT)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyPromptToClipboard(lyricsPreviewSong.id, lyricsPreviewSong.sunoPrompt)
                  }
                  className="inline-flex items-center gap-1 text-xs text-rose-400 cursor-pointer"
                >
                  {copiedPromptId === lyricsPreviewSong.id ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedPromptId === lyricsPreviewSong.id ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{lyricsPreviewSong.sunoPrompt}</p>
            </div>

            <div className="rounded-lg bg-[#0B0E14] border border-white/10 p-4">
              <p className="text-xs font-medium text-slate-400 mb-2">Letra Completa</p>
              <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                {lyricsPreviewSong.lyrics}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Edit & Re-render Song Modal */}
      {editingSong && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => handleSaveEditedSong(e, false)}
            className="w-full max-w-lg rounded-xl border border-white/15 bg-[#121722] p-6 space-y-4 max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Editar Tema IA</h3>
              <button
                type="button"
                onClick={() => setEditingSong(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={editingSong.title}
                  onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Género</label>
                <input
                  type="text"
                  required
                  value={editingSong.genre}
                  onChange={(e) => setEditingSong({ ...editingSong, genre: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">BPM (Tempo)</label>
                <input
                  type="number"
                  min={72}
                  max={155}
                  value={editingSong.bpm}
                  onChange={(e) =>
                    setEditingSong({ ...editingSong, bpm: Number(e.target.value) || 105 })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Base Rítmica</label>
                <select
                  value={editingSong.drumStyle}
                  onChange={(e) =>
                    setEditingSong({
                      ...editingSong,
                      drumStyle: e.target.value as AiGeneratedSong['drumStyle'],
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white"
                >
                  {['reggaeton', 'trap', 'house', 'lofi', 'pop', 'rock', 'afrobeat', 'synthwave'].map(
                    (d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Coro Vocal IA</label>
              <input
                type="text"
                value={editingSong.vocalHookText}
                onChange={(e) => setEditingSong({ ...editingSong, vocalHookText: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Letra Completa</label>
              <textarea
                rows={6}
                value={editingSong.lyrics}
                onChange={(e) => setEditingSong({ ...editingSong, lyrics: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={(e) => handleSaveEditedSong(e, true)}
                disabled={isReRendering}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-medium text-white cursor-pointer"
              >
                {isReRendering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Guardar y Re-generar Audio</span>
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Production Share & GitHub Modal */}
      {sharingSong && (
        <PublishShareModal
          song={sharingSong}
          allAiSongs={aiSongs}
          onClose={() => setSharingSong(null)}
        />
      )}
    </div>
  );
};
