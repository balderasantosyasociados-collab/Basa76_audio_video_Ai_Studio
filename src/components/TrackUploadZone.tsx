import React, { useRef, useState } from 'react';
import { Upload, Music, CheckCircle2, Loader2 } from 'lucide-react';

interface TrackUploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => Promise<void>;
  isUploading: boolean;
  uploadSummary: { processed: number; total: number; lastAdded?: string } | null;
  compact?: boolean;
}

export const TrackUploadZone: React.FC<TrackUploadZoneProps> = ({
  onFilesSelected,
  isUploading,
  uploadSummary,
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onFilesSelected(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-xl border transition-colors ${
        isDragging
          ? 'border-rose-500 bg-rose-500/10'
          : 'border-dashed border-white/15 bg-[#121722] hover:border-white/25'
      } ${compact ? 'p-4' : 'p-6'}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.webm"
        onChange={handleInputChange}
        className="hidden"
      />

      <div className={`flex ${compact ? 'flex-row items-center justify-between gap-4' : 'flex-col sm:flex-row sm:items-center sm:justify-between gap-5'}`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0 text-rose-400">
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Music className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-white truncate">
              {isUploading && uploadSummary
                ? `Procesando audio (${uploadSummary.processed}/${uploadSummary.total})...`
                : 'Cargar tu propia música'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Arrastra archivos aquí o selecciónalos · MP3, WAV, FLAC, OGG, M4A · Se guardan en tu navegador
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {uploadSummary && !isUploading && uploadSummary.lastAdded && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="max-w-[180px] truncate">{uploadSummary.lastAdded}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Seleccionar Archivos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
