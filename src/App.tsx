import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Radio,
  Music,
  ListMusic,
  Globe,
  Sliders,
  Upload,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import {
  AiGeneratedSong,
  NavSection,
  Playlist,
  RadioStream,
  StationConfig,
  Track,
} from './types/radio';
import {
  DEFAULT_CONFIG,
  DEFAULT_STREAMS,
  deleteAiSongFromDb,
  deleteTrackFromDb,
  isSeeded,
  loadAllAiSongs,
  loadAllTracks,
  loadConfig,
  loadPlaylists,
  loadStreams,
  markSeeded,
  saveAiSong,
  saveConfig,
  savePlaylists,
  saveStreams,
  saveTrack,
  saveTracksBatch,
} from './utils/storage';
import { createStarterStudioTracks } from './utils/audioSynth';
import { formatTime, parseAudioFile } from './utils/id3Parser';
import { useRadioEngine } from './audio/useRadioEngine';
import { CoverArtwork } from './components/CoverArtwork';
import { StudioConsoleView } from './components/StudioConsoleView';
import { AiMusicStudioView } from './components/AiMusicStudioView';
import { MusicLibraryView } from './components/MusicLibraryView';
import { PlaylistsView } from './components/PlaylistsView';
import { StreamsView } from './components/StreamsView';
import { EqualizerSettingsView } from './components/EqualizerSettingsView';

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'studio', label: 'Estudio en Vivo', icon: Radio },
  { id: 'ai-studio', label: 'IA Musical Autónoma', icon: Sparkles },
  { id: 'library', label: 'Mi Música', icon: Music },
  { id: 'playlists', label: 'Programas y Listas', icon: ListMusic },
  { id: 'streams', label: 'Emisoras Online', icon: Globe },
  { id: 'equalizer', label: 'Ecualizador y Ajustes', icon: Sliders },
];

export default function App() {
  const [activeView, setActiveView] = useState<NavSection>('studio');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [aiSongs, setAiSongs] = useState<AiGeneratedSong[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [streams, setStreams] = useState<RadioStream[]>(DEFAULT_STREAMS);
  const [config, setConfig] = useState<StationConfig>(DEFAULT_CONFIG);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{
    processed: number;
    total: number;
    lastAdded?: string;
  } | null>(null);
  const [globalDragActive, setGlobalDragActive] = useState(false);

  const [clockText, setClockText] = useState(() =>
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  const globalFileInputRef = useRef<HTMLInputElement | null>(null);
  const prevVolumeRef = useRef(0.85);

  // Live broadcast clock
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockText(
        new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Load persisted IndexedDB data on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [loadedConfig, loadedPlaylists, loadedStreams, loadedAiSongs, seeded] = await Promise.all([
        loadConfig(),
        loadPlaylists(),
        loadStreams(),
        loadAllAiSongs(),
        isSeeded(),
      ]);

      let loadedTracks = await loadAllTracks();
      if (!seeded && loadedTracks.length === 0) {
        const starters = createStarterStudioTracks();
        await saveTracksBatch(starters);
        await markSeeded();
        loadedTracks = starters;
      }

      if (!mounted) return;
      setConfig(loadedConfig);
      setPlaylists(loadedPlaylists);
      setStreams(loadedStreams);
      setAiSongs(loadedAiSongs);
      setTracks(loadedTracks);
      setQueueIds(loadedTracks.filter((t) => !t.isJingle).map((t) => t.id));
      setIsLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleIncrementPlayCount = useCallback((trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const updated = { ...t, playCount: t.playCount + 1 };
        saveTrack(updated).catch(() => {});
        return updated;
      })
    );
  }, []);

  const {
    playback,
    analyserNode,
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
  } = useRadioEngine({
    tracks,
    queueIds,
    config,
    onIncrementPlayCount: handleIncrementPlayCount,
  });

  // Derived objects
  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === playback.currentTrackId) || null,
    [tracks, playback.currentTrackId]
  );

  const currentStream = useMemo(
    () => streams.find((s) => s.id === playback.currentStreamId) || null,
    [streams, playback.currentStreamId]
  );

  const queueTracks = useMemo(() => {
    const map = new Map(tracks.map((t) => [t.id, t]));
    return queueIds.map((id) => map.get(id)).filter((t): t is Track => Boolean(t));
  }, [tracks, queueIds]);

  const jingles = useMemo(() => tracks.filter((t) => t.isJingle), [tracks]);

  // Config updater
  const updateConfig = useCallback((partial: Partial<StationConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      saveConfig(next).catch(() => {});
      return next;
    });
  }, []);

  // Handle multi-file music upload
  const handleFilesSelected = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(
        (f) =>
          f.type.startsWith('audio/') ||
          /\.(mp3|wav|ogg|flac|m4a|aac|webm)$/i.test(f.name)
      );
      if (files.length === 0) return;

      setIsUploading(true);
      setUploadSummary({ processed: 0, total: files.length });

      const createdTracks: Track[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const meta = await parseAudioFile(file);
        const newTrack: Track = {
          id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          genre: meta.genre,
          duration: meta.duration,
          fileSize: file.size,
          mimeType: file.type || 'audio/mpeg',
          fileName: file.name,
          coverUrl: meta.coverUrl,
          isFavorite: false,
          isJingle: false,
          isStarter: false,
          playCount: 0,
          addedAt: Date.now() + i,
          audioBlob: file,
        };
        createdTracks.push(newTrack);
        setUploadSummary({
          processed: i + 1,
          total: files.length,
          lastAdded: `${createdTracks.length} ${createdTracks.length === 1 ? 'pista cargada' : 'pistas cargadas'}`,
        });
      }

      await saveTracksBatch(createdTracks);

      setTracks((prev) => [...createdTracks.reverse(), ...prev]);
      setQueueIds((prev) => [...createdTracks.map((t) => t.id), ...prev]);
      setIsUploading(false);

      // Auto-start first uploaded song if studio wasn't playing anything yet
      if (!playback.isPlaying && createdTracks.length > 0 && !playback.currentTrackId) {
        playTrack(createdTracks[0].id, false);
      }
    },
    [playTrack, playback.currentTrackId, playback.isPlaying]
  );

  // Track actions
  const handleToggleFavorite = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, isFavorite: !t.isFavorite };
        saveTrack(updated).catch(() => {});
        return updated;
      })
    );
  }, []);

  const handleToggleJingle = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, isJingle: !t.isJingle };
        saveTrack(updated).catch(() => {});
        return updated;
      })
    );
  }, []);

  const handleUpdateTrack = useCallback((updated: Track) => {
    setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    saveTrack(updated).catch(() => {});
  }, []);

  const handleDeleteTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setQueueIds((prev) => prev.filter((qid) => qid !== id));
    deleteTrackFromDb(id).catch(() => {});
  }, []);

  // Queue manipulation
  const handleAddToQueue = useCallback((id: string) => {
    setQueueIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const handleAddAllToQueue = useCallback((ids: string[]) => {
    setQueueIds((prev) => {
      const set = new Set(prev);
      const merged = [...prev];
      for (const id of ids) {
        if (!set.has(id)) {
          set.add(id);
          merged.push(id);
        }
      }
      return merged;
    });
  }, []);

  const handlePlayFromLibrary = useCallback(
    (id: string) => {
      setQueueIds((prev) => (prev.includes(id) ? prev : [id, ...prev]));
      playTrack(id, false);
    },
    [playTrack]
  );

  const handleMoveQueueItem = useCallback((index: number, direction: -1 | 1) => {
    setQueueIds((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }, []);

  const handleRemoveQueueItem = useCallback((id: string) => {
    setQueueIds((prev) => prev.filter((item) => item !== id));
  }, []);

  // Playlist actions
  const handleCreatePlaylist = useCallback((name: string, description: string) => {
    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      name,
      description,
      trackIds: [],
      createdAt: Date.now(),
    };
    setPlaylists((prev) => {
      const next = [newPl, ...prev];
      savePlaylists(next).catch(() => {});
      return next;
    });
  }, []);

  const handleDeletePlaylist = useCallback((id: string) => {
    setPlaylists((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePlaylists(next).catch(() => {});
      return next;
    });
  }, []);

  const handleToggleTrackInPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) => {
      const next = prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const exists = pl.trackIds.includes(trackId);
        return {
          ...pl,
          trackIds: exists
            ? pl.trackIds.filter((id) => id !== trackId)
            : [...pl.trackIds, trackId],
        };
      });
      savePlaylists(next).catch(() => {});
      return next;
    });
  }, []);

  const handleBroadcastPlaylist = useCallback(
    (playlist: Playlist) => {
      const validIds = playlist.trackIds.filter((id) => tracks.some((t) => t.id === id));
      if (validIds.length === 0) return;
      setQueueIds(validIds);
      playTrack(validIds[0], false);
      setActiveView('studio');
    },
    [playTrack, tracks]
  );

  // Streams actions
  const handleAddCustomStream = useCallback((stream: Omit<RadioStream, 'id' | 'isCustom'>) => {
    const newStream: RadioStream = {
      ...stream,
      id: `stream-custom-${Date.now()}`,
      isCustom: true,
    };
    setStreams((prev) => {
      const next = [newStream, ...prev];
      saveStreams(next).catch(() => {});
      return next;
    });
  }, []);

  const handleDeleteStream = useCallback((id: string) => {
    setStreams((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveStreams(next).catch(() => {});
      return next;
    });
  }, []);

  // AI Song persistence & radio publishing
  const handleSaveAiSong = useCallback(async (song: AiGeneratedSong) => {
    await saveAiSong(song);
    setAiSongs((prev) => {
      const exists = prev.some((s) => s.id === song.id);
      if (exists) {
        return prev.map((s) => (s.id === song.id ? song : s));
      }
      return [song, ...prev];
    });
  }, []);

  const handleDeleteAiSong = useCallback(async (id: string) => {
    await deleteAiSongFromDb(id);
    setAiSongs((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handlePublishAiSongToRadio = useCallback(
    async (song: AiGeneratedSong, playImmediately = false) => {
      const trackId = song.publishedTrackId || `ai-track-${song.id}`;
      const radioTrack: Track = {
        id: trackId,
        title: song.title,
        artist: song.artist,
        album: 'BASA Radio IA Autónoma',
        genre: song.genre,
        duration: song.duration,
        fileSize: song.fileSize,
        mimeType: 'audio/wav',
        fileName: `${song.title}.wav`,
        coverUrl: song.coverUrl,
        isFavorite: false,
        isJingle: false,
        isStarter: false,
        isAiGenerated: true,
        lyrics: song.lyrics,
        playCount: 0,
        addedAt: Date.now(),
        audioBlob: song.audioBlob,
      };

      await saveTrack(radioTrack);
      setTracks((prev) => {
        const exists = prev.some((t) => t.id === trackId);
        return exists ? prev.map((t) => (t.id === trackId ? radioTrack : t)) : [radioTrack, ...prev];
      });
      setQueueIds((prev) => (prev.includes(trackId) ? prev : [trackId, ...prev]));

      if (song.publishedTrackId !== trackId) {
        const updatedSong = { ...song, publishedTrackId: trackId };
        await saveAiSong(updatedSong);
        setAiSongs((prev) => prev.map((s) => (s.id === song.id ? updatedSong : s)));
      }

      if (playImmediately) {
        // Ensure tracksRef in engine sees the newly published track on next tick
        window.setTimeout(() => {
          playTrack(trackId, false);
        }, 60);
      }
    },
    [playTrack]
  );

  // Global window drag-and-drop for effortless music upload from anywhere
  const handleWindowDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setGlobalDragActive(true);
    }
  };

  const handleWindowDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setGlobalDragActive(false);
    }
  };

  const handleWindowDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setGlobalDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFilesSelected(e.dataTransfer.files);
    }
  };

  const toggleMute = () => {
    if (config.masterVolume > 0) {
      prevVolumeRef.current = config.masterVolume;
      updateConfig({ masterVolume: 0 });
    } else {
      updateConfig({ masterVolume: prevVolumeRef.current || 0.85 });
    }
  };

  const activeNavItem = NAV_ITEMS.find((n) => n.id === activeView)!;
  const barTitle =
    playback.mode === 'stream' && currentStream
      ? currentStream.name
      : currentTrack?.title || config.stationName;
  const barSubtitle =
    playback.mode === 'stream' && currentStream
      ? `${currentStream.genre} · En Directo`
      : currentTrack
      ? currentTrack.artist
      : 'Listo para emitir';

  return (
    <div
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
      className="min-h-screen bg-[#0B0E14] text-[#F4F6F9] flex flex-col lg:flex-row"
    >
      {/* Hidden global file input */}
      <input
        ref={globalFileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.webm"
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            await handleFilesSelected(e.target.files);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Global Drag-Drop Overlay */}
      {globalDragActive && (
        <div className="fixed inset-0 z-50 bg-[#0B0E14]/90 border-2 border-dashed border-rose-500 flex flex-col items-center justify-center p-6 pointer-events-none">
          <Upload className="w-12 h-12 text-rose-400 mb-3" />
          <p className="text-xl font-semibold text-white">Suelta tus archivos de música aquí</p>
          <p className="text-sm text-slate-400 mt-1">
            MP3, WAV, FLAC, OGG o M4A se añadirán inmediatamente a {config.stationName}
          </p>
        </div>
      )}

      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
        />
      )}

      {/* Left Broadcast Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-[#0F131C] border-r border-white/8 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <CoverArtwork
                src="/src/assets/images/basa_station_cover_1795431407775.jpg"
                alt={config.stationName}
                size="sm"
                className="w-9 h-9 rounded-lg border border-white/10 shrink-0"
              />
              <span className="font-display text-lg font-bold tracking-tight text-white truncate">
                {config.stationName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveView(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-5 border-t border-white/8 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 truncate">{config.slogan}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{config.frequencyLabel}</span>
              <span className="font-mono text-slate-300">{tracks.length} pistas</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => globalFileInputRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Cargar Música</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area + Bottom Transport */}
      <div className="flex-1 flex flex-col min-w-0 pb-24">
        {/* Top Bar Contract: Breadcrumb on left — Clock & 1 primary CTA on right */}
        <header className="h-16 px-4 sm:px-8 border-b border-white/8 bg-[#0B0E14]/95 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menú"
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/8 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 whitespace-nowrap hidden sm:inline">
                {config.stationName}
              </span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-white truncate whitespace-nowrap">
                {activeNavItem.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
              <span className={playback.isPlaying ? 'text-rose-400 font-medium' : 'text-slate-500'}>
                {playback.isPlaying ? 'En Emisión' : 'En Espera'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-200">{clockText}</span>
            </div>

            <button
              type="button"
              onClick={() => globalFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir Música</span>
            </button>
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1320px] w-full mx-auto">
          {!isLoaded ? (
            <div className="space-y-4">
              <div className="h-64 rounded-xl bg-[#121722] border border-white/8 animate-pulse" />
              <div className="h-44 rounded-xl bg-[#121722] border border-white/8 animate-pulse" />
            </div>
          ) : (
            <>
              {activeView === 'studio' && (
                <StudioConsoleView
                  config={config}
                  playback={playback}
                  analyser={analyserNode}
                  currentTrack={currentTrack}
                  currentStream={currentStream}
                  queueTracks={queueTracks}
                  jingles={jingles}
                  micMonitorEnabled={micMonitorEnabled}
                  onToggleMicMonitor={() => setMicMonitorEnabled((v) => !v)}
                  onToggleMic={toggleMic}
                  onTogglePlayPause={togglePlayPause}
                  onNext={() => playNext(false)}
                  onPrev={playPrevious}
                  onSeek={seekTo}
                  onPlayTrack={(id) => playTrack(id, false)}
                  onTriggerJingle={triggerJingle}
                  onToggleAutoDj={() => updateConfig({ autoDjEnabled: !config.autoDjEnabled })}
                  onToggleShuffle={() => updateConfig({ shuffleEnabled: !config.shuffleEnabled })}
                  onCycleRepeat={() =>
                    updateConfig({
                      repeatMode:
                        config.repeatMode === 'all'
                          ? 'one'
                          : config.repeatMode === 'one'
                          ? 'off'
                          : 'all',
                    })
                  }
                  onMoveQueueItem={handleMoveQueueItem}
                  onRemoveQueueItem={handleRemoveQueueItem}
                  onOpenUpload={() => setActiveView('library')}
                />
              )}

              {activeView === 'ai-studio' && (
                <AiMusicStudioView
                  aiSongs={aiSongs}
                  currentPlayingTrackId={playback.mode === 'track' ? playback.currentTrackId : null}
                  isPlaying={playback.isPlaying}
                  onSaveAiSong={handleSaveAiSong}
                  onDeleteAiSong={handleDeleteAiSong}
                  onPublishToRadio={handlePublishAiSongToRadio}
                />
              )}

              {activeView === 'library' && (
                <MusicLibraryView
                  tracks={tracks}
                  currentTrackId={playback.mode === 'track' ? playback.currentTrackId : null}
                  isPlaying={playback.isPlaying}
                  isUploading={isUploading}
                  uploadSummary={uploadSummary}
                  onFilesSelected={handleFilesSelected}
                  onPlayTrack={handlePlayFromLibrary}
                  onAddToQueue={handleAddToQueue}
                  onAddAllToQueue={handleAddAllToQueue}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleJingle={handleToggleJingle}
                  onUpdateTrack={handleUpdateTrack}
                  onDeleteTrack={handleDeleteTrack}
                />
              )}

              {activeView === 'playlists' && (
                <PlaylistsView
                  playlists={playlists}
                  tracks={tracks}
                  onCreatePlaylist={handleCreatePlaylist}
                  onDeletePlaylist={handleDeletePlaylist}
                  onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
                  onBroadcastPlaylist={handleBroadcastPlaylist}
                />
              )}

              {activeView === 'streams' && (
                <StreamsView
                  streams={streams}
                  activeStreamId={playback.mode === 'stream' ? playback.currentStreamId : null}
                  isStreamPlaying={playback.mode === 'stream' && playback.isPlaying}
                  streamError={playback.streamError}
                  onPlayStream={playStream}
                  onTogglePlayPause={togglePlayPause}
                  onAddCustomStream={handleAddCustomStream}
                  onDeleteStream={handleDeleteStream}
                />
              )}

              {activeView === 'equalizer' && (
                <EqualizerSettingsView
                  config={config}
                  tracks={tracks}
                  onUpdateConfig={updateConfig}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Persistent Compact Bottom Broadcast Player Bar */}
      <footer className="fixed bottom-0 inset-x-0 lg:left-[260px] z-30 h-16 sm:h-[72px] bg-[#0F131C]/95 backdrop-blur-md border-t border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Track Identity */}
        <div className="flex items-center gap-3 min-w-0 flex-1 max-w-[300px]">
          <CoverArtwork
            src={playback.mode === 'track' ? currentTrack?.coverUrl : undefined}
            alt={barTitle}
            size="sm"
            className="w-10 h-10 rounded-md border border-white/10 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-white truncate">{barTitle}</p>
            <p className="text-[11px] text-slate-400 truncate">{barSubtitle}</p>
          </div>
        </div>

        {/* Center Controls + Progress */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={playPrevious}
            disabled={playback.mode === 'stream'}
            aria-label="Anterior"
            className="p-2 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer hidden sm:inline-flex"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={togglePlayPause}
            aria-label={playback.isPlaying ? 'Pausar' : 'Reproducir'}
            className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            {playback.isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => playNext(false)}
            disabled={playback.mode === 'stream'}
            aria-label="Siguiente"
            className="p-2 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {playback.mode === 'track' && (
            <div className="hidden md:flex items-center gap-2.5 w-52 lg:w-64">
              <span className="font-mono text-[11px] text-slate-400 w-10 text-right">
                {formatTime(playback.currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={playback.duration > 0 ? playback.duration : 100}
                step={0.5}
                value={playback.currentTime}
                disabled={playback.duration <= 0}
                onChange={(e) => seekTo(Number(e.target.value))}
                aria-label="Progreso"
                className="studio-slider flex-1"
              />
              <span className="font-mono text-[11px] text-slate-400 w-10">
                {formatTime(playback.duration)}
              </span>
            </div>
          )}
        </div>

        {/* Right Volume Control */}
        <div className="hidden sm:flex items-center gap-2.5 w-36 justify-end shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            aria-label="Silenciar"
            className="p-1.5 rounded text-slate-300 hover:text-white cursor-pointer"
          >
            {config.masterVolume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={config.masterVolume}
            onChange={(e) => updateConfig({ masterVolume: Number(e.target.value) })}
            aria-label="Volumen maestro"
            className="studio-slider w-24"
          />
        </div>
      </footer>
    </div>
  );
}
