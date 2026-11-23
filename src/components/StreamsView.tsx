import React, { useState } from 'react';
import { Radio, Play, Pause, Plus, Trash2, Globe } from 'lucide-react';
import { RadioStream } from '../types/radio';

interface StreamsViewProps {
  streams: RadioStream[];
  activeStreamId: string | null;
  isStreamPlaying: boolean;
  streamError: string | null;
  onPlayStream: (stream: RadioStream) => void;
  onTogglePlayPause: () => void;
  onAddCustomStream: (stream: Omit<RadioStream, 'id' | 'isCustom'>) => void;
  onDeleteStream: (id: string) => void;
}

export const StreamsView: React.FC<StreamsViewProps> = ({
  streams,
  activeStreamId,
  isStreamPlaying,
  streamError,
  onPlayStream,
  onTogglePlayPause,
  onAddCustomStream,
  onDeleteStream,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [genre, setGenre] = useState('');
  const [country, setCountry] = useState('Personalizada');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    onAddCustomStream({
      name: name.trim(),
      url: url.trim(),
      genre: genre.trim() || 'Radio Online',
      country: country.trim() || 'Personalizada',
      bitrate: 'Stream Externo',
    });
    setName('');
    setUrl('');
    setGenre('');
  };

  return (
    <div className="space-y-6">
      {/* Add Custom Stream URL */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-white/10 bg-[#121722] p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">Agregar Emisora o Stream Externo</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Conecta enlaces directos Icecast, Shoutcast, MP3 o AAC para sintonizarlos desde la consola.
            </p>
          </div>
          <Globe className="w-5 h-5 text-slate-400 shrink-0 hidden sm:block" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la emisora"
            className="px-3.5 py-2.5 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
          />
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://servidor.com/stream.mp3"
            className="lg:col-span-2 px-3.5 py-2.5 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
          />
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="Género (ej. Rock, Noticias)"
            className="px-3.5 py-2.5 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="País o Ciudad"
            className="w-full sm:w-56 px-3.5 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Guardar Emisora</span>
          </button>
        </div>
      </form>

      {streamError && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 px-4 py-3 text-xs text-rose-300">
          {streamError}
        </div>
      )}

      {/* Streams Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {streams.map((stream) => {
          const isActive = activeStreamId === stream.id;
          return (
            <div
              key={stream.id}
              className={`rounded-xl border p-5 flex items-center justify-between gap-4 transition-colors ${
                isActive
                  ? 'bg-rose-500/10 border-rose-500/35'
                  : 'bg-[#121722] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border ${
                    isActive
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-[#0B0E14] border-white/10 text-slate-400'
                  }`}
                >
                  <Radio className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate">{stream.name}</h4>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {stream.genre} · {stream.country}
                    {stream.bitrate ? ` · ${stream.bitrate}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => (isActive ? onTogglePlayPause() : onPlayStream(stream))}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive && isStreamPlaying
                      ? 'bg-white text-slate-950'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  {isActive && isStreamPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Sintonizar</span>
                    </>
                  )}
                </button>

                {stream.isCustom && (
                  <button
                    type="button"
                    onClick={() => onDeleteStream(stream.id)}
                    title="Eliminar emisora"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/8 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
