import React, { useState } from 'react';
import { FolderPlus, Play, Trash2, Plus, Check, Youtube } from 'lucide-react';
import { Playlist, Track } from '../types/radio';
import { formatTime } from '../utils/id3Parser';
import { CoverArtwork } from './CoverArtwork';

interface PlaylistsViewProps {
  playlists: Playlist[];
  tracks: Track[];
  onCreatePlaylist: (name: string, description: string) => void;
  onDeletePlaylist: (id: string) => void;
  onToggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
  onBroadcastPlaylist: (playlist: Playlist) => void;
  onExportYouTubePlaylist: (playlist: Playlist) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  playlists,
  tracks,
  onCreatePlaylist,
  onDeletePlaylist,
  onToggleTrackInPlaylist,
  onBroadcastPlaylist,
  onExportYouTubePlaylist,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(playlists[0]?.id ?? null);

  const selectedPlaylist = playlists.find((p) => p.id === selectedId) || playlists[0] || null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreatePlaylist(name.trim(), description.trim() || 'Bloque musical personalizado');
    setName('');
    setDescription('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 5 cols: Create & List Programs */}
      <div className="lg:col-span-5 space-y-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-white/10 bg-[#121722] p-5 space-y-4"
        >
          <div>
            <h3 className="text-base font-semibold text-white">Nuevo Programa o Lista</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Organiza bloques musicales por horario, estilo o evento.
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del programa (ej. Tardes de Jazz)"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción breve (opcional)"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Crear Programa</span>
          </button>
        </form>

        <div className="rounded-xl border border-white/10 bg-[#121722] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/8 text-xs font-medium text-slate-400">
            Mis Programas ({playlists.length})
          </div>
          {playlists.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Aún no creaste programas. Crea el primero arriba para armar tu parrilla.
            </div>
          ) : (
            <div className="divide-y divide-white/6">
              {playlists.map((pl) => {
                const isSelected = selectedPlaylist?.id === pl.id;
                const count = pl.trackIds.filter((id) => tracks.some((t) => t.id === id)).length;
                return (
                  <div
                    key={pl.id}
                    className={`p-4 flex items-center justify-between gap-3 transition-colors ${
                      isSelected ? 'bg-rose-500/10' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(pl.id)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-rose-300' : 'text-white'}`}>
                        {pl.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {count} {count === 1 ? 'pista' : 'pistas'} · {pl.description}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onExportYouTubePlaylist(pl)}
                        disabled={count === 0}
                        title="Exportar lista a YouTube y crear estreno"
                        className="p-2 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                      >
                        <Youtube className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onBroadcastPlaylist(pl)}
                        disabled={count === 0}
                        title="Emitir este programa ahora"
                        className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePlaylist(pl.id)}
                        title="Eliminar programa"
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 cursor-pointer"
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
      </div>

      {/* Right 7 cols: Assign Tracks to Selected Playlist */}
      <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#121722] overflow-hidden">
        {!selectedPlaylist ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Selecciona o crea un programa para asignar tus canciones.
          </div>
        ) : (
          <>
            <div className="p-5 border-b border-white/8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white">{selectedPlaylist.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedPlaylist.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onExportYouTubePlaylist(selectedPlaylist)}
                  disabled={selectedPlaylist.trackIds.length === 0}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Youtube className="w-3.5 h-3.5 text-rose-400" />
                  <span>Exportar a YouTube y Estreno</span>
                </button>
                <button
                  type="button"
                  onClick={() => onBroadcastPlaylist(selectedPlaylist)}
                  disabled={selectedPlaylist.trackIds.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Emitir Lista en Auto-DJ</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-white/6 max-h-[520px] overflow-y-auto">
              {tracks.map((track) => {
                const included = selectedPlaylist.trackIds.includes(track.id);
                return (
                  <div
                    key={track.id}
                    className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CoverArtwork
                        src={track.coverUrl}
                        alt={track.title}
                        size="sm"
                        className="w-9 h-9 rounded-md border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{track.title}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {track.artist} · {formatTime(track.duration)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleTrackInPlaylist(selectedPlaylist.id, track.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        included
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      {included ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>En Lista</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
