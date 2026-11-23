import React, { useMemo, useState } from 'react';
import {
  X,
  Youtube,
  Video,
  Download,
  Copy,
  Check,
  Sparkles,
  Loader2,
  ExternalLink,
  CalendarClock,
  TrendingUp,
  CheckSquare,
  Square,
  ListVideo,
  Share2,
} from 'lucide-react';
import { Track, YouTubePremierePlan } from '../types/radio';
import { formatTime } from '../utils/id3Parser';
import {
  buildYouTubeChapters,
  exportPlaylistAsM3U,
  renderPlaylistMixVideoWebM,
  renderPlaylistMixWav,
} from '../utils/youtubePlaylistRenderer';

interface YouTubePlaylistPremiereModalProps {
  listName: string;
  tracks: Track[];
  onClose: () => void;
}

export const YouTubePlaylistPremiereModal: React.FC<YouTubePlaylistPremiereModalProps> = ({
  listName,
  tracks,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'premiere'>('export');

  // Video & Audio Mix Export State
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');
  const [clipMode, setClipMode] = useState<'preview15' | 'full'>('preview15');
  const [premiereIntro, setPremiereIntro] = useState(true);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [wavBusy, setWavBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Premiere & Top #1 Growth Strategy State
  const defaultSchedule = useMemo(() => {
    const d = new Date(Date.now() + 2 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  }, []);
  const [premiereDateTime, setPremiereDateTime] = useState(defaultSchedule);
  const [launchGoal, setLaunchGoal] = useState(
    'Posicionar en Top #1 Tendencias Musicales y maximizar alcance masivo (meta 300M+ views en lanzamiento)'
  );
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [premierePlan, setPremierePlan] = useState<YouTubePremierePlan | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const maxPerTrackSec = clipMode === 'preview15' ? 14 : 0;
  const chapters = useMemo(
    () => buildYouTubeChapters(tracks, maxPerTrackSec, premiereIntro ? 2.5 : 0),
    [tracks, maxPerTrackSec, premiereIntro]
  );

  const chaptersText = useMemo(
    () =>
      chapters
        .map((c) => `${c.timestamp} ${c.track.title} — ${c.track.artist}`)
        .join('\n'),
    [chapters]
  );

  const totalMixSeconds = chapters.length > 0 ? chapters[chapters.length - 1].endSec : 0;

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleRenderVideoMix = async () => {
    setExportError(null);
    setVideoProgress(0);
    try {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
      const { webmBlob } = await renderPlaylistMixVideoWebM({
        listName,
        tracks,
        maxPerTrackSec,
        resolution,
        premiereMode: premiereIntro,
        onProgress: (pct) => setVideoProgress(pct),
      });
      setVideoUrl(URL.createObjectURL(webmBlob));
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'No se pudo generar el video de la lista.'
      );
    } finally {
      setVideoProgress(null);
    }
  };

  const handleDownloadWavMix = async () => {
    setExportError(null);
    setWavBusy(true);
    try {
      const { blob } = await renderPlaylistMixWav(tracks, maxPerTrackSec);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${listName.replace(/[^a-z0-9\-_ ]/gi, '_')}_YouTube_Mix.wav`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'No se pudo mezclar el audio WAV.');
    } finally {
      setWavBusy(false);
    }
  };

  const handleDownloadJsonList = () => {
    const payload = {
      playlist: listName,
      exportedAt: new Date().toISOString(),
      premiereSchedule: premiereDateTime,
      totalTracks: tracks.length,
      chapters: chapters.map((c) => ({
        index: c.index,
        timestamp: c.timestamp,
        title: c.track.title,
        artist: c.track.artist,
        genre: c.track.genre,
      })),
      premierePlan,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${listName.replace(/[^a-z0-9\-_ ]/gi, '_')}_YouTube_Premiere.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handleGeneratePremierePlan = async () => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const resp = await fetch('/api/ai/youtube-premiere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listName,
          premiereDateTime,
          goal: launchGoal,
          tracks: chapters.map((c) => ({
            title: c.track.title,
            artist: c.track.artist,
            genre: c.track.genre,
            timestamp: c.timestamp,
          })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || 'Error generando el plan de estreno.');
      }
      setPremierePlan(data as YouTubePremierePlan);
      setCheckedSteps({});
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Error conectando con el estratega IA.');
    } finally {
      setPlanLoading(false);
    }
  };

  const appUrl = window.location.origin;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl border border-white/15 bg-[#121722] overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-rose-400 font-semibold">YouTube Studio &amp; Estreno</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{tracks.length} pistas</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{formatTime(totalMixSeconds)}</span>
            </div>
            <h3 className="text-lg font-bold text-white truncate mt-0.5">{listName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-6 pt-4 pb-3 border-b border-white/8 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'export'
                ? 'bg-rose-600 text-white'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Exportar Lista a Video YouTube</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('premiere')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'premiere'
                ? 'bg-amber-600 text-white'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Crear Estreno &amp; Estrategia Top #1</span>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {activeTab === 'export' && (
            <div className="space-y-5">
              {/* Mix Configuration */}
              <div className="rounded-xl bg-[#0B0E14] border border-white/10 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Resolución Video</label>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value as '720p' | '1080p')}
                      className="w-full px-3 py-2 rounded-lg bg-[#121722] border border-white/10 text-xs text-white"
                    >
                      <option value="1080p">1080p Full HD (1920×1080)</option>
                      <option value="720p">720p HD Rápido (1280×720)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Duración de Exportación</label>
                    <select
                      value={clipMode}
                      onChange={(e) => setClipMode(e.target.value as 'preview15' | 'full')}
                      className="w-full px-3 py-2 rounded-lg bg-[#121722] border border-white/10 text-xs text-white"
                    >
                      <option value="preview15">Mix Estreno Rápido (14s/pista)</option>
                      <option value="full">Lista Completa (Duración real)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-xs text-slate-200 pb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={premiereIntro}
                        onChange={(e) => setPremiereIntro(e.target.checked)}
                        className="accent-rose-500"
                      />
                      <span>Intro Cuenta Regresiva de Estreno</span>
                    </label>
                  </div>
                </div>

                {exportError && <p className="text-xs text-rose-400">{exportError}</p>}

                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/8">
                  <button
                    type="button"
                    disabled={videoProgress !== null || tracks.length === 0}
                    onClick={handleRenderVideoMix}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
                  >
                    {videoProgress !== null ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Renderizando Video {videoProgress}%</span>
                      </>
                    ) : (
                      <>
                        <ListVideo className="w-4 h-4" />
                        <span>Renderizar Video Mix YouTube</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={wavBusy || tracks.length === 0}
                    onClick={handleDownloadWavMix}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white/8 hover:bg-white/12 text-xs font-medium text-white cursor-pointer"
                  >
                    {wavBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>Audio Mix WAV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportPlaylistAsM3U(listName, tracks)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white/8 hover:bg-white/12 text-xs font-medium text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Lista .M3U</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadJsonList}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white/8 hover:bg-white/12 text-xs font-medium text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Paquete JSON</span>
                  </button>
                </div>

                {videoUrl && (
                  <div className="pt-3 space-y-3 border-t border-white/8">
                    <video
                      src={videoUrl}
                      controls
                      className="w-full rounded-lg border border-white/10 max-h-64 bg-black"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <a
                        href={videoUrl}
                        download={`${listName.replace(/[^a-z0-9\-_ ]/gi, '_')}_YouTube_${resolution}.webm`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                      >
                        <Download className="w-4 h-4" />
                        <span>Descargar Video Mix ({resolution})</span>
                      </a>
                      <a
                        href="https://studio.youtube.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Subir y Programar Estreno en YouTube Studio</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Automatic YouTube Chapters */}
              <div className="rounded-xl bg-[#0B0E14] border border-white/10 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white">
                    Capítulos Automáticos para Descripción de YouTube ({chapters.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => copyText('chapters', chaptersText)}
                    className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    {copiedKey === 'chapters' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'chapters' ? 'Copiado' : 'Copiar Capítulos'}</span>
                  </button>
                </div>
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed">
                  {chaptersText}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'premiere' && (
            <div className="space-y-5">
              {/* Premiere Setup Form */}
              <div className="rounded-xl bg-[#0B0E14] border border-white/10 p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Fecha y Hora del Estreno en YouTube
                    </label>
                    <div className="relative">
                      <CalendarClock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="datetime-local"
                        value={premiereDateTime}
                        onChange={(e) => setPremiereDateTime(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#121722] border border-white/10 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Objetivo de Posicionamiento
                    </label>
                    <input
                      type="text"
                      value={launchGoal}
                      onChange={(e) => setLaunchGoal(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#121722] border border-white/10 text-xs text-white"
                    />
                  </div>
                </div>

                {planError && <p className="text-xs text-rose-400">{planError}</p>}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={planLoading}
                    onClick={handleGeneratePremierePlan}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
                  >
                    {planLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generando Plan de Estreno Top #1...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generar Estreno &amp; Estrategia Top #1 con IA</span>
                      </>
                    )}
                  </button>

                  <a
                    href="https://studio.youtube.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/8 hover:bg-white/12 text-xs font-medium text-white"
                  >
                    <Youtube className="w-4 h-4 text-rose-400" />
                    <span>Abrir YouTube Studio (Programar Estreno)</span>
                  </a>
                </div>
              </div>

              {premierePlan && (
                <div className="space-y-4">
                  {/* Title & A/B Variants */}
                  <div className="rounded-xl bg-[#0B0E14] border border-white/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-300">
                        Título Principal de Estreno (Alto CTR)
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText('p-title', premierePlan.premiereTitle)}
                        className="inline-flex items-center gap-1 text-xs text-rose-400 cursor-pointer"
                      >
                        {copiedKey === 'p-title' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'p-title' ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                    <p className="text-sm font-bold text-white">{premierePlan.premiereTitle}</p>
                    <div className="pt-2 border-t border-white/8 space-y-1">
                      <p className="text-[11px] text-slate-400">Variantes A/B Test:</p>
                      {premierePlan.alternativeTitles.map((alt, i) => (
                        <p key={i} className="text-xs text-slate-300">
                          {i + 1}. {alt}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Retention Hook, Thumbnail & Live Chat Pinned */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[#0B0E14] border border-white/10 p-4 space-y-2">
                      <h4 className="text-xs font-semibold text-rose-300">
                        Gancho Primeros 30 Segundos (Retención)
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {premierePlan.first30SecondsHook}
                      </p>
                      <h4 className="text-xs font-semibold text-amber-300 pt-2">
                        Concepto de Miniatura Alto CTR
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {premierePlan.thumbnailConcept}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#0B0E14] border border-white/10 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-emerald-300">
                          Mensaje Fijado Chat en Vivo del Estreno
                        </h4>
                        <button
                          type="button"
                          onClick={() => copyText('p-chat', premierePlan.pinnedLiveChatMessage)}
                          className="inline-flex items-center gap-1 text-xs text-rose-400 cursor-pointer"
                        >
                          {copiedKey === 'p-chat' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>Copiar</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {premierePlan.pinnedLiveChatMessage}
                      </p>
                      <h4 className="text-xs font-semibold text-slate-300 pt-2">
                        Guion Sala de Espera (Countdown)
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {premierePlan.premiereCountdownScript}
                      </p>
                    </div>
                  </div>

                  {/* Description & Tags */}
                  <div className="rounded-xl bg-[#0B0E14] border border-white/10 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">
                        Descripción SEO con Capítulos + Etiquetas
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            'p-desc',
                            `${premierePlan.premiereDescription}\n\nTags: ${premierePlan.youtubeTags.join(', ')}`
                          )
                        }
                        className="inline-flex items-center gap-1 text-xs text-rose-400 cursor-pointer"
                      >
                        {copiedKey === 'p-desc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'p-desc' ? 'Copiado' : 'Copiar Todo'}</span>
                      </button>
                    </div>
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-44 overflow-y-auto">
                      {premierePlan.premiereDescription}
                    </pre>
                    <p className="text-[11px] text-slate-400 pt-2 border-t border-white/8">
                      Etiquetas: {premierePlan.youtubeTags.join(' · ')}
                    </p>
                  </div>

                  {/* Top #1 First Hour Execution Checklist + Shorts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[#0B0E14] border border-white/10 p-4 space-y-2.5">
                      <h4 className="text-xs font-semibold text-amber-300">
                        Plan de Lanzamiento 1ª Hora (Rumbo al Top #1)
                      </h4>
                      <div className="space-y-2">
                        {premierePlan.topOneHourlyChecklist.map((step, i) => {
                          const done = Boolean(checkedSteps[i]);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() =>
                                setCheckedSteps((prev) => ({ ...prev, [i]: !prev[i] }))
                              }
                              className="w-full flex items-start gap-2 text-left text-xs cursor-pointer"
                            >
                              {done ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                              )}
                              <span className={done ? 'line-through text-slate-500' : 'text-slate-200'}>
                                {step}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#0B0E14] border border-white/10 p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-rose-300">
                        Cortes Verticales (Shorts / TikTok / Reels)
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {premierePlan.shortsHooks.map((sh, i) => (
                          <li key={i}>
                            {i + 1}. {sh}
                          </li>
                        ))}
                      </ul>

                      <div className="pt-2 border-t border-white/8 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <Share2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Difundir Estreno</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => copyText('p-social', premierePlan.viralSocialPost)}
                            className="text-xs text-rose-400 cursor-pointer"
                          >
                            {copiedKey === 'p-social' ? 'Copiado' : 'Copiar Post'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${premierePlan.viralSocialPost}\n${appUrl}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-md bg-emerald-600/20 border border-emerald-500/30 text-[11px] text-emerald-200"
                          >
                            WhatsApp
                          </a>
                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(premierePlan.viralSocialPost)}&url=${encodeURIComponent(appUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-md bg-white/10 text-[11px] text-white"
                          >
                            X / Twitter
                          </a>
                          <a
                            href={`https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent(premierePlan.viralSocialPost)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-md bg-sky-600/20 border border-sky-500/30 text-[11px] text-sky-200"
                          >
                            Telegram
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
