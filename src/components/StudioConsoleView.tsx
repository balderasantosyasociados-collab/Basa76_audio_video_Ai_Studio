import React from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Mic,
  MicOff,
  Radio,
  Volume2,
  Shuffle,
  Repeat,
  Repeat1,
  ArrowUp,
  ArrowDown,
  X,
  Upload,
  Zap,
  Headphones,
} from 'lucide-react';
import { PlaybackState, RadioStream, StationConfig, Track } from '../types/radio';
import { formatTime } from '../utils/id3Parser';
import { CoverArtwork } from './CoverArtwork';
import { StudioVisualizer } from './StudioVisualizer';

interface StudioConsoleViewProps {
  config: StationConfig;
  playback: PlaybackState;
  analyser: AnalyserNode | null;
  currentTrack: Track | null;
  currentStream: RadioStream | null;
  queueTracks: Track[];
  jingles: Track[];
  micMonitorEnabled: boolean;
  onToggleMicMonitor: () => void;
  onToggleMic: () => void;
  onTogglePlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (sec: number) => void;
  onPlayTrack: (id: string) => void;
  onTriggerJingle: (track: Track) => void;
  onToggleAutoDj: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onMoveQueueItem: (index: number, direction: -1 | 1) => void;
  onRemoveQueueItem: (id: string) => void;
  onOpenUpload: () => void;
}

export const StudioConsoleView: React.FC<StudioConsoleViewProps> = ({
  config,
  playback,
  analyser,
  currentTrack,
  currentStream,
  queueTracks,
  jingles,
  micMonitorEnabled,
  onToggleMicMonitor,
  onToggleMic,
  onTogglePlayPause,
  onNext,
  onPrev,
  onSeek,
  onPlayTrack,
  onTriggerJingle,
  onToggleAutoDj,
  onToggleShuffle,
  onCycleRepeat,
  onMoveQueueItem,
  onRemoveQueueItem,
  onOpenUpload,
}) => {
  const isStream = playback.mode === 'stream' && Boolean(currentStream);
  const displayTitle = isStream
    ? currentStream!.name
    : currentTrack?.title || 'Estudio listo para emitir';
  const displaySubtitle = isStream
    ? `${currentStream!.genre} · ${currentStream!.country}${currentStream!.bitrate ? ` · ${currentStream!.bitrate}` : ''}`
    : currentTrack
    ? `${currentTrack.artist} · ${currentTrack.album} · ${currentTrack.genre}`
    : 'Carga tus canciones MP3/WAV o inicia la rotación automática';

  const duration = playback.duration || currentTrack?.duration || 0;
  const currentTime = Math.min(playback.currentTime, duration || playback.currentTime);

  return (
    <div className="space-y-6">
      {/* Main Broadcast Deck Hero + Visualizer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Active Broadcast Console */}
        <div className="xl:col-span-7 rounded-xl border border-white/10 bg-[#121722] overflow-hidden flex flex-col justify-between">
          {/* Studio Backdrop Header */}
          <div className="relative h-36 sm:h-44 w-full overflow-hidden border-b border-white/10">
            <img
              src="/src/assets/images/basa_studio_banner_1795431408758.jpg"
              alt="Estudio de emisión BASA Radio"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#121722] via-[#121722]/65 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className={playback.isPlaying ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                    {playback.isPlaying ? 'AL AIRE' : 'EN ESPERA'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{config.frequencyLabel}</span>
                  {playback.isCrossfading && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-400">Mezcla Crossfade</span>
                    </>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5 truncate">
                  {config.stationName}
                </h2>
              </div>

              <button
                type="button"
                onClick={onOpenUpload}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Subir Música</span>
              </button>
            </div>
          </div>

          {/* Now Playing Info + Transport */}
          <div className="p-5 sm:p-6 space-y-5 flex-1 flex flex-col justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <CoverArtwork
                src={isStream ? undefined : currentTrack?.coverUrl}
                alt={displayTitle}
                size="lg"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg border border-white/10 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400">
                  {isStream ? 'Emisora Externa Sintonizada' : 'Pista en Emisión'}
                </p>
                <h3 className="text-lg sm:text-2xl font-semibold text-white truncate mt-0.5">
                  {displayTitle}
                </h3>
                <p className="text-sm text-slate-400 truncate mt-1">
                  {displaySubtitle}
                </p>
              </div>
            </div>

            {playback.streamError && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3.5 py-2.5 text-xs text-rose-300">
                {playback.streamError}
              </div>
            )}

            {/* Scrubber */}
            <div className="space-y-1.5">
              <input
                type="range"
                min={0}
                max={duration > 0 ? duration : 100}
                step={0.1}
                value={isStream ? 100 : currentTime}
                disabled={isStream || duration <= 0}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="Progreso de reproducción"
                className="studio-slider w-full disabled:opacity-40"
              />
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>{isStream ? 'EN DIRECTO' : formatTime(currentTime)}</span>
                <span>{isStream ? 'STREAMING' : formatTime(duration)}</span>
              </div>
            </div>

            {/* Transport Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-white/8">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={isStream}
                  title="Pista anterior"
                  className="p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/8 disabled:opacity-35 transition-colors cursor-pointer"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={onTogglePlayPause}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {playback.isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pausar Emisión</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Iniciar Emisión</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={isStream}
                  title="Siguiente pista"
                  className="p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/8 disabled:opacity-35 transition-colors cursor-pointer"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleAutoDj}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.autoDjEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Auto-DJ {config.autoDjEnabled ? 'Activo' : 'Manual'}
                </button>

                <button
                  type="button"
                  onClick={onToggleShuffle}
                  title="Modo aleatorio"
                  className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                    config.shuffleEnabled
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onCycleRepeat}
                  title={`Repetición: ${config.repeatMode}`}
                  className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                    config.repeatMode !== 'off'
                      ? 'bg-white/12 border-white/20 text-white'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {config.repeatMode === 'one' ? (
                    <Repeat1 className="w-4 h-4" />
                  ) : (
                    <Repeat className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Real-Time Analyzer & Live Locutor Console */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <div className="rounded-xl border border-white/10 bg-[#121722] p-5">
            <StudioVisualizer
              analyser={analyser}
              isPlaying={playback.isPlaying}
              isStreamMode={isStream}
            />
            <div className="mt-4 pt-3 border-t border-white/8 flex items-center justify-between text-xs text-slate-400">
              <span>Crossfade Automático</span>
              <span className="font-mono text-slate-200">
                {config.crossfadeSeconds > 0 ? `${config.crossfadeSeconds}s suave` : 'Corte directo'}
              </span>
            </div>
          </div>

          {/* Live Microphone + Jingle Soundboard */}
          <div className="rounded-xl border border-white/10 bg-[#121722] p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Consola de Locución y Pisadores</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Activa tu micrófono o lanza cortinas sobre la música con auto-atenuación.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleMicMonitor}
                title="Escuchar retorno de micrófono por altavoces"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  micMonitorEnabled
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Retorno {micMonitorEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {playback.micError && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs text-rose-300">
                {playback.micError}
              </div>
            )}

            <button
              type="button"
              onClick={onToggleMic}
              className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                playback.micActive
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-[#181F2E] border-white/10 text-slate-200 hover:border-white/20 hover:bg-white/8'
              }`}
            >
              {playback.micActive ? (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Micrófono Abierto (Música Atenuada)</span>
                </>
              ) : (
                <>
                  <MicOff className="w-4 h-4 text-slate-400" />
                  <span>Hablar en Vivo (Auto-Ducking)</span>
                </>
              )}
            </button>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Cartuchera de Jingles y Cortinas</span>
                <span className="font-mono">{jingles.length} disponibles</span>
              </div>
              {jingles.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  Marca cualquier audio subido como &ldquo;Jingle&rdquo; en Mi Música para dispararlo desde aquí.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {jingles.slice(0, 4).map((jingle) => {
                    const isFiring = playback.activeJingleId === jingle.id;
                    return (
                      <button
                        key={jingle.id}
                        type="button"
                        onClick={() => onTriggerJingle(jingle)}
                        className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          isFiring
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                            : 'bg-[#0B0E14] border-white/10 text-slate-200 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Zap className={`w-3.5 h-3.5 shrink-0 ${isFiring ? 'text-amber-400' : 'text-rose-400'}`} />
                          <span className="text-xs font-medium truncate">{jingle.title}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400 shrink-0">
                          {formatTime(jingle.duration)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Queue / Up Next Table */}
      <div className="rounded-xl border border-white/10 bg-[#121722] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Cola de Emisión (Rotación en Vivo)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Orden de reproducción para el Auto-DJ · Haz clic en cualquier pista para emitirla al instante
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            {queueTracks.length} {queueTracks.length === 1 ? 'pista en cola' : 'pistas en cola'}
          </div>
        </div>

        {queueTracks.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Radio className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">La cola de emisión está vacía</p>
              <p className="text-xs text-slate-400">
                Sube tus canciones MP3 o WAV o añade pistas desde tu biblioteca.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar Música Ahora</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/6">
            {queueTracks.map((track, idx) => {
              const isCurrent = playback.mode === 'track' && playback.currentTrackId === track.id;
              return (
                <div
                  key={track.id}
                  className={`px-5 py-3 flex items-center justify-between gap-4 transition-colors ${
                    isCurrent ? 'bg-rose-500/10' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onPlayTrack(track.id)}
                    className="flex items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <span className="font-mono text-xs text-slate-500 w-5 text-right shrink-0">
                      {isCurrent && playback.isPlaying ? (
                        <Volume2 className="w-4 h-4 text-rose-400 inline" />
                      ) : (
                        String(idx + 1).padStart(2, '0')
                      )}
                    </span>
                    <CoverArtwork
                      src={track.coverUrl}
                      alt={track.title}
                      size="sm"
                      className="w-10 h-10 rounded-md border border-white/10 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isCurrent ? 'text-rose-300' : 'text-white'}`}>
                        {track.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {track.artist} · {track.genre}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-slate-400 mr-2 hidden sm:inline">
                      {formatTime(track.duration)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onMoveQueueItem(idx, -1)}
                      disabled={idx === 0}
                      title="Subir en la cola"
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-25 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveQueueItem(idx, 1)}
                      disabled={idx === queueTracks.length - 1}
                      title="Bajar en la cola"
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-25 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveQueueItem(track.id)}
                      title="Quitar de la cola"
                      className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-white/8 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
