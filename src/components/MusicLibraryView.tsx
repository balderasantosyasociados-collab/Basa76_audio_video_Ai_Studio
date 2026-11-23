import React, { useMemo, useState } from 'react';
import {
  Play,
  Heart,
  Zap,
  ListPlus,
  Pencil,
  Trash2,
  Search,
  Check,
  X,
  ImagePlus,
} from 'lucide-react';
import { Track } from '../types/radio';
import { formatBytes, formatTime } from '../utils/id3Parser';
import { CoverArtwork } from './CoverArtwork';
import { TrackUploadZone } from './TrackUploadZone';

interface MusicLibraryViewProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isUploading: boolean;
  uploadSummary: { processed: number; total: number; lastAdded?: string } | null;
  onFilesSelected: (files: FileList | File[]) => Promise<void>;
  onPlayTrack: (id: string) => void;
  onAddToQueue: (id: string) => void;
  onAddAllToQueue: (ids: string[]) => void;
  onToggleFavorite: (id: string) => void;
  onToggleJingle: (id: string) => void;
  onUpdateTrack: (track: Track) => void;
  onDeleteTrack: (id: string) => void;
}

type FilterTab = 'all' | 'uploaded' | 'favorites' | 'jingles';

export const MusicLibraryView: React.FC<MusicLibraryViewProps> = ({
  tracks,
  currentTrackId,
  isPlaying,
  isUploading,
  uploadSummary,
  onFilesSelected,
  onPlayTrack,
  onAddToQueue,
  onAddAllToQueue,
  onToggleFavorite,
  onToggleJingle,
  onUpdateTrack,
  onDeleteTrack,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tracks.filter((t) => {
      if (filter === 'uploaded' && t.isStarter) return false;
      if (filter === 'favorites' && !t.isFavorite) return false;
      if (filter === 'jingles' && !t.isJingle) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
      );
    });
  }, [tracks, filter, search]);

  const uploadedCount = useMemo(() => tracks.filter((t) => !t.isStarter).length, [tracks]);

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTrack) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditingTrack({ ...editingTrack, coverUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrack) return;
    onUpdateTrack(editingTrack);
    setEditingTrack(null);
  };

  return (
    <div className="space-y-6">
      <TrackUploadZone
        onFilesSelected={onFilesSelected}
        isUploading={isUploading}
        uploadSummary={uploadSummary}
      />

      {/* Filter & Search Toolbar */}
      <div className="rounded-xl border border-white/10 bg-[#121722] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B0E14] border border-white/8 overflow-x-auto">
            {(
              [
                { id: 'all', label: `Todas (${tracks.length})` },
                { id: 'uploaded', label: `Mi Música (${uploadedCount})` },
                { id: 'favorites', label: 'Favoritas' },
                { id: 'jingles', label: 'Jingles' },
              ] as { id: FilterTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === tab.id
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar título, artista o género..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
            {filteredTracks.length > 0 && (
              <button
                type="button"
                onClick={() => onAddAllToQueue(filteredTracks.map((t) => t.id))}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ListPlus className="w-4 h-4" />
                <span>Enviar Filtro a Cola</span>
              </button>
            )}
          </div>
        </div>

        {/* Track Table */}
        {filteredTracks.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-200">
              No hay canciones que coincidan con este filtro
            </p>
            <p className="text-xs text-slate-400">
              Arrastra archivos MP3, WAV o FLAC en la zona superior para agregar tu propia música.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/8 text-xs text-slate-400">
                  <th className="py-3 pl-5 pr-3 font-medium">Pista</th>
                  <th className="py-3 px-3 font-medium hidden md:table-cell">Álbum / Género</th>
                  <th className="py-3 px-3 font-medium hidden lg:table-cell text-right">Tamaño</th>
                  <th className="py-3 px-3 font-medium text-right">Duración</th>
                  <th className="py-3 pl-3 pr-5 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {filteredTracks.map((track) => {
                  const isCurrent = currentTrackId === track.id;
                  return (
                    <tr
                      key={track.id}
                      className={`transition-colors ${
                        isCurrent ? 'bg-rose-500/10' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="py-3 pl-5 pr-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => onPlayTrack(track.id)}
                            title="Reproducir ahora"
                            className="relative group shrink-0 cursor-pointer"
                          >
                            <CoverArtwork
                              src={track.coverUrl}
                              alt={track.title}
                              size="sm"
                              className="w-10 h-10 rounded-md border border-white/10"
                            />
                            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                              <Play className="w-4 h-4 text-white fill-current" />
                            </div>
                          </button>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onPlayTrack(track.id)}
                              className={`text-sm font-medium truncate block text-left hover:underline cursor-pointer ${
                                isCurrent ? 'text-rose-300' : 'text-white'
                              }`}
                            >
                              {track.title}
                            </button>
                            <p className="text-xs text-slate-400 truncate">
                              {track.artist}
                              {track.isJingle && ' · Jingle de Emisora'}
                              {isCurrent && isPlaying && ' · Al Aire'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 hidden md:table-cell">
                        <p className="text-xs text-slate-300 truncate max-w-[220px]">
                          {track.album} · {track.genre}
                        </p>
                      </td>

                      <td className="py-3 px-3 hidden lg:table-cell text-right font-mono text-xs text-slate-400">
                        {formatBytes(track.fileSize)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-xs text-slate-300">
                        {formatTime(track.duration)}
                      </td>

                      <td className="py-3 pl-3 pr-5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onAddToQueue(track.id)}
                            title="Añadir a la cola de emisión"
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
                          >
                            <ListPlus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleFavorite(track.id)}
                            title="Marcar favorita"
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                              track.isFavorite
                                ? 'text-rose-400 bg-rose-500/10'
                                : 'text-slate-400 hover:text-white hover:bg-white/8'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${track.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleJingle(track.id)}
                            title="Usar como Jingle / Pisador en consola"
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                              track.isJingle
                                ? 'text-amber-400 bg-amber-500/10'
                                : 'text-slate-400 hover:text-white hover:bg-white/8'
                            }`}
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTrack(track)}
                            title="Editar información y carátula"
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTrack(track.id)}
                            title="Eliminar pista"
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/8 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Metadata Modal */}
      {editingTrack && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-xl border border-white/15 bg-[#121722] p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Editar Información de Pista</h3>
              <button
                type="button"
                onClick={() => setEditingTrack(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <CoverArtwork
                src={editingTrack.coverUrl}
                alt={editingTrack.title}
                className="w-20 h-20 rounded-lg border border-white/10 shrink-0"
              />
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-xs font-medium text-white cursor-pointer">
                <ImagePlus className="w-4 h-4" />
                <span>Cambiar Carátula</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={editingTrack.title}
                  onChange={(e) => setEditingTrack({ ...editingTrack, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Artista</label>
                <input
                  type="text"
                  required
                  value={editingTrack.artist}
                  onChange={(e) => setEditingTrack({ ...editingTrack, artist: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Álbum</label>
                  <input
                    type="text"
                    value={editingTrack.album}
                    onChange={(e) => setEditingTrack({ ...editingTrack, album: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Género</label>
                  <input
                    type="text"
                    value={editingTrack.genre}
                    onChange={(e) => setEditingTrack({ ...editingTrack, genre: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingTrack(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/8 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
