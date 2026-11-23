import React, { useState } from 'react';
import {
  X,
  Youtube,
  Share2,
  Copy,
  Check,
  Download,
  Video,
  Github,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { AiGeneratedSong } from '../types/radio';
import { renderMusicVideoWebM } from '../utils/aiMusicRenderer';

interface PublishShareModalProps {
  song: AiGeneratedSong;
  allAiSongs: AiGeneratedSong[];
  onClose: () => void;
}

export const PublishShareModal: React.FC<PublishShareModalProps> = ({
  song,
  allAiSongs,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'youtube' | 'social' | 'github'>('youtube');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // GitHub Sync State
  const [ghOwner, setGhOwner] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghFilePath, setGhFilePath] = useState('basa-radio-catalog.json');
  const [ghToken, setGhToken] = useState('');
  const [ghStatus, setGhStatus] = useState<{
    loading: boolean;
    error?: string;
    commitUrl?: string;
  }>({ loading: false });

  // Live Online Validation State
  const [validationState, setValidationState] = useState<{
    running: boolean;
    checks: { name: string; ok: boolean; detail: string }[];
  } | null>(null);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleDownloadWav = () => {
    const url = URL.createObjectURL(song.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${song.title.replace(/[^a-z0-9\-_ ]/gi, '_')}_BASA_Radio.wav`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handleGenerateVideo = async () => {
    setVideoError(null);
    setVideoProgress(0);
    try {
      const webmBlob = await renderMusicVideoWebM({
        title: song.title,
        artist: song.artist,
        genre: song.genre,
        lyrics: song.lyrics,
        audioBlob: song.audioBlob,
        coverUrl: song.coverUrl,
        onProgress: (pct) => setVideoProgress(pct),
      });
      const url = URL.createObjectURL(webmBlob);
      setVideoUrl(url);
      setVideoProgress(null);
    } catch (err) {
      setVideoProgress(null);
      setVideoError(
        err instanceof Error
          ? err.message
          : 'No se pudo generar el video en este navegador.'
      );
    }
  };

  const shareMessage = `${song.socialCaption}\n\nEscucha "${song.title}" (${song.genre}) producido en BASA Radio AI Studio.`;
  const appUrl = window.location.origin;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: song.youtubeTitle || song.title,
          text: shareMessage,
          url: appUrl,
        });
      } catch {
        // cancelled
      }
    } else {
      copyText('native', `${shareMessage}\n${appUrl}`);
    }
  };

  const handleRunOnlineValidation = async () => {
    setValidationState({ running: true, checks: [] });
    const checks: { name: string; ok: boolean; detail: string }[] = [];

    // 1. Backend Health Check
    const t0 = performance.now();
    try {
      const resp = await fetch('/api/health');
      const data = await resp.json();
      const ms = Math.round(performance.now() - t0);
      checks.push({
        name: 'Servidor Express & API Online',
        ok: resp.ok && data.ok,
        detail: resp.ok ? `HTTP 200 · ${ms} ms` : `HTTP ${resp.status}`,
      });
      checks.push({
        name: 'Motor Gemini AI Conectado',
        ok: Boolean(data.geminiConfigured),
        detail: data.geminiConfigured ? 'Disponible en servidor' : 'Sin clave en Secrets',
      });
    } catch {
      checks.push({
        name: 'Servidor Express & API Online',
        ok: false,
        detail: 'Sin respuesta del servidor',
      });
    }

    // 2. Audio Blob & Web Audio Integrity
    checks.push({
      name: 'Audio Maestro WAV Listo',
      ok: song.audioBlob.size > 1000,
      detail: `${(song.audioBlob.size / (1024 * 1024)).toFixed(2)} MB · ${Math.round(song.duration)}s`,
    });

    // 3. IndexedDB Persistence
    checks.push({
      name: 'Persistencia IndexedDB',
      ok: typeof indexedDB !== 'undefined' && allAiSongs.length > 0,
      detail: `${allAiSongs.length} temas guardados en histórico`,
    });

    setValidationState({ running: false, checks });
  };

  const handleGithubSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setGhStatus({ loading: true });

    const catalogPayload = {
      station: 'BASA Radio AI Studio',
      updatedAt: new Date().toISOString(),
      totalSongs: allAiSongs.length,
      tracks: allAiSongs.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        genre: s.genre,
        bpm: s.bpm,
        musicalKey: s.musicalKey,
        mood: s.mood,
        durationSeconds: Math.round(s.duration),
        sunoPrompt: s.sunoPrompt,
        lyrics: s.lyrics,
        youtubeTitle: s.youtubeTitle,
        youtubeTags: s.youtubeTags,
        socialCaption: s.socialCaption,
        createdAt: new Date(s.createdAt).toISOString(),
      })),
    };

    try {
      const resp = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: ghToken.trim(),
          owner: ghOwner.trim(),
          repo: ghRepo.trim(),
          branch: ghBranch.trim() || 'main',
          filePath: ghFilePath.trim() || 'basa-radio-catalog.json',
          commitMessage: `Actualizar catálogo BASA Radio: ${song.title}`,
          catalog: catalogPayload,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setGhStatus({ loading: false, error: data.error || 'Error al sincronizar con GitHub.' });
        return;
      }
      setGhStatus({ loading: false, commitUrl: data.commitUrl });
    } catch (err) {
      setGhStatus({
        loading: false,
        error: err instanceof Error ? err.message : 'Error de red con GitHub.',
      });
    }
  };

  const handleDownloadCatalogJson = () => {
    const catalogPayload = {
      station: 'BASA Radio AI Studio',
      updatedAt: new Date().toISOString(),
      tracks: allAiSongs.map(({ audioBlob: _b, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(catalogPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'basa-radio-catalog.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-white/15 bg-[#121722] overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white truncate">
              Publicar en Producción: {song.title}
            </h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {song.artist} · {song.genre} · {song.bpm} BPM
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4 flex items-center gap-2 border-b border-white/8 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('youtube')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'youtube'
                ? 'bg-rose-600 text-white'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white'
            }`}
          >
            <Youtube className="w-4 h-4" />
            <span>YouTube Studio</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('social')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'social'
                ? 'bg-rose-600 text-white'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Todas las Redes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'github'
                ? 'bg-rose-600 text-white'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>GitHub &amp; Validación</span>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {activeTab === 'youtube' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-[#0B0E14] border border-white/10 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      1. Renderizar Video Visualizer HD (1280x720) para YouTube
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Combina carátula, espectro de audio reactivo y letra en pantalla en un archivo WebM listo para subir.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadWav}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/8 hover:bg-white/12 text-xs font-medium text-white cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Audio WAV</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateVideo}
                      disabled={videoProgress !== null}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-medium text-white cursor-pointer"
                    >
                      {videoProgress !== null ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Renderizando {videoProgress}%</span>
                        </>
                      ) : (
                        <>
                          <Video className="w-3.5 h-3.5" />
                          <span>Crear Video YouTube</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {videoError && <p className="text-xs text-rose-400">{videoError}</p>}

                {videoUrl && (
                  <div className="pt-2 space-y-3">
                    <video src={videoUrl} controls className="w-full rounded-lg border border-white/10 max-h-56 bg-black" />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <a
                        href={videoUrl}
                        download={`${song.title.replace(/[^a-z0-9\-_ ]/gi, '_')}_YouTube.webm`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                      >
                        <Download className="w-4 h-4" />
                        <span>Descargar Video WebM</span>
                      </a>
                      <a
                        href="https://studio.youtube.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir YouTube Studio para Subir</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* SEO Metadata Copy */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Título SEO para YouTube</span>
                  <button
                    type="button"
                    onClick={() => copyText('yt-title', song.youtubeTitle)}
                    className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    {copiedKey === 'yt-title' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'yt-title' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <div className="px-3.5 py-2.5 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white">
                  {song.youtubeTitle}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-medium text-slate-300">Descripción + Letra + Etiquetas</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        'yt-desc',
                        `${song.youtubeDescription}\n\n${song.lyrics}\n\nTags: ${song.youtubeTags.join(', ')}`
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    {copiedKey === 'yt-desc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'yt-desc' ? 'Copiado' : 'Copiar Paquete'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto font-sans">
                  {`${song.youtubeDescription}\n\n${song.lyrics}\n\nEtiquetas: ${song.youtubeTags.join(', ')}`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-[#0B0E14] border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Texto Viral para Redes Sociales</span>
                  <button
                    type="button"
                    onClick={() => copyText('social-cap', shareMessage)}
                    className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    {copiedKey === 'social-cap' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'social-cap' ? 'Copiado' : 'Copiar Texto'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-200 whitespace-pre-wrap">{shareMessage}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareMessage}\n${appUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-lg bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium text-emerald-200 text-center"
                >
                  Compartir en WhatsApp
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(appUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-lg bg-white/8 border border-white/15 hover:bg-white/12 text-xs font-medium text-white text-center"
                >
                  Compartir en X
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(appUrl)}&quote=${encodeURIComponent(shareMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-lg bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-xs font-medium text-blue-200 text-center"
                >
                  Compartir en Facebook
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent(shareMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-lg bg-sky-600/20 border border-sky-500/30 hover:bg-sky-600/30 text-xs font-medium text-sky-200 text-center"
                >
                  Compartir en Telegram
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(appUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-lg bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-medium text-indigo-200 text-center"
                >
                  Compartir en LinkedIn
                </a>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="px-4 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white text-center cursor-pointer"
                >
                  TikTok / Instagram / Más
                </button>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-5">
              {/* Online Health Validator */}
              <div className="rounded-lg bg-[#0B0E14] border border-white/10 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-white">Validador Online en Vivo</h4>
                      <p className="text-xs text-slate-400">
                        Comprueba servidor, Gemini AI, audio maestro e IndexedDB en tiempo real.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunOnlineValidation}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white cursor-pointer"
                  >
                    Ejecutar Validación
                  </button>
                </div>

                {validationState && (
                  <div className="space-y-2 pt-2 border-t border-white/8">
                    {validationState.checks.map((c) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <span className={c.ok ? 'text-emerald-300' : 'text-rose-400'}>
                          {c.ok ? 'OK' : 'ERROR'} · {c.name}
                        </span>
                        <span className="font-mono text-slate-400">{c.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* GitHub Commit Sync */}
              <form
                onSubmit={handleGithubSync}
                className="rounded-lg bg-[#0B0E14] border border-white/10 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Sincronizar Catálogo e Histórico en GitHub
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Envía un commit directo con tu catálogo y letras en JSON usando la API de GitHub.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadCatalogJson}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 text-xs text-slate-200 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar JSON</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={ghOwner}
                    onChange={(e) => setGhOwner(e.target.value)}
                    placeholder="Usuario u organización GitHub"
                    className="px-3 py-2 rounded-lg bg-[#121722] border border-white/10 text-xs text-white placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    required
                    value={ghRepo}
                    onChange={(e) => setGhRepo(e.target.value)}
                    placeholder="Nombre del repositorio"
                    className="px-3 py-2 rounded-lg bg-[#121722] border border-white/10 text-xs text-white placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    value={ghBranch}
                    onChange={(e) => setGhBranch(e.target.value)}
                    placeholder="Rama (main)"
                    className="px-3 py-2 rounded-lg bg-[#121722] border border-white/10 text-xs text-white placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    value={ghFilePath}
                    onChange={(e) => setGhFilePath(e.target.value)}
                    placeholder="Archivo (basa-radio-catalog.json)"
                    className="px-3 py-2 rounded-lg bg-[#121722] border border-white/10 text-xs text-white placeholder:text-slate-500"
                  />
                </div>

                <input
                  type="password"
                  required
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  placeholder="GitHub Personal Access Token (permiso Contents: Read & Write)"
                  className="w-full px-3 py-2 rounded-lg bg-[#121722] border border-white/10 text-xs text-white placeholder:text-slate-500"
                />

                {ghStatus.error && <p className="text-xs text-rose-400">{ghStatus.error}</p>}
                {ghStatus.commitUrl && (
                  <div className="text-xs text-emerald-300 flex items-center justify-between">
                    <span>Commit publicado correctamente en GitHub</span>
                    <a
                      href={ghStatus.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline inline-flex items-center gap-1"
                    >
                      <span>Ver en GitHub</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={ghStatus.loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
                >
                  {ghStatus.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Actualizando Repositorio...</span>
                    </>
                  ) : (
                    <>
                      <Github className="w-4 h-4" />
                      <span>Actualizar GitHub Ahora</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
