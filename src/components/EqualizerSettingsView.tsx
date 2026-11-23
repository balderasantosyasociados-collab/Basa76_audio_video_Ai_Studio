import React from 'react';
import { Sliders, RotateCcw, Radio } from 'lucide-react';
import { StationConfig, Track } from '../types/radio';
import { EQ_LABELS, EQ_PRESETS } from '../audio/useRadioEngine';
import { formatBytes } from '../utils/id3Parser';

interface EqualizerSettingsViewProps {
  config: StationConfig;
  tracks: Track[];
  onUpdateConfig: (partial: Partial<StationConfig>) => void;
}

export const EqualizerSettingsView: React.FC<EqualizerSettingsViewProps> = ({
  config,
  tracks,
  onUpdateConfig,
}) => {
  const totalBytes = tracks.reduce((acc, t) => acc + t.fileSize, 0);
  const uploadedTracks = tracks.filter((t) => !t.isStarter).length;

  const handleBandChange = (idx: number, gain: number) => {
    const next = [...config.eqBands];
    next[idx] = gain;
    onUpdateConfig({ eqBands: next, eqPresetName: 'Personalizado' });
  };

  const applyPreset = (presetName: string) => {
    const bands = EQ_PRESETS[presetName];
    if (!bands) return;
    onUpdateConfig({ eqBands: [...bands], eqPresetName: presetName });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* 5-Band Broadcast Equalizer */}
      <div className="xl:col-span-7 rounded-xl border border-white/10 bg-[#121722] p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-base font-semibold text-white">Ecualizador Gráfico de Emisión</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ajuste en tiempo real de 5 bandas · Perfil activo: {config.eqPresetName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => applyPreset('Plano')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 border border-white/10 text-xs text-slate-300 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer Plano</span>
          </button>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {Object.keys(EQ_PRESETS).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                config.eqPresetName === preset
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Band Sliders */}
        <div className="grid grid-cols-5 gap-3 pt-2">
          {EQ_LABELS.map((label, idx) => {
            const val = config.eqBands[idx] ?? 0;
            return (
              <div
                key={label}
                className="rounded-lg bg-[#0B0E14] border border-white/8 p-3 flex flex-col items-center gap-3"
              >
                <span className="font-mono text-xs text-amber-300">
                  {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)} dB
                </span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={val}
                  onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                  aria-label={`Banda ${label}`}
                  className="studio-slider w-full"
                />
                <span className="font-mono text-[11px] text-slate-400">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Broadcast Compressor & Crossfade */}
        <div className="pt-4 border-t border-white/8 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">Duración Crossfade Auto-DJ</span>
              <span className="font-mono text-xs text-rose-400">{config.crossfadeSeconds}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={8}
              step={1}
              value={config.crossfadeSeconds}
              onChange={(e) => onUpdateConfig({ crossfadeSeconds: Number(e.target.value) })}
              className="studio-slider w-full"
            />
            <p className="text-[11px] text-slate-500">
              Fundido cruzado automático entre pistas para evitar silencios al aire.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg bg-[#0B0E14] border border-white/8 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-white">Limitador / Compresor FM</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Nivela el volumen entre distintas canciones
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateConfig({ compressorEnabled: !config.compressorEnabled })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                config.compressorEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              {config.compressorEnabled ? 'Activo' : 'Apagado'}
            </button>
          </div>
        </div>
      </div>

      {/* Station Identity & Local Storage Info */}
      <div className="xl:col-span-5 space-y-6">
        <div className="rounded-xl border border-white/10 bg-[#121722] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-semibold text-white">Identidad de la Emisora</h3>
              <p className="text-xs text-slate-400 mt-0.5">Personaliza el nombre y dial de tu radio</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nombre de la Emisora</label>
              <input
                type="text"
                value={config.stationName}
                onChange={(e) => onUpdateConfig({ stationName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Eslogan</label>
              <input
                type="text"
                value={config.slogan}
                onChange={(e) => onUpdateConfig({ slogan: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Frecuencia / Dial</label>
              <input
                type="text"
                value={config.frequencyLabel}
                onChange={(e) => onUpdateConfig({ frequencyLabel: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#121722] p-6 space-y-3">
          <h4 className="text-sm font-semibold text-white">Almacenamiento Local de Música</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tus canciones subidas se almacenan localmente en IndexedDB dentro de tu navegador para reproducción instantánea sin esperas de red.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-lg bg-[#0B0E14] border border-white/8 p-3">
              <p className="text-[11px] text-slate-400">Canciones Cargadas</p>
              <p className="font-mono text-lg font-semibold text-white mt-0.5">{uploadedTracks}</p>
            </div>
            <div className="rounded-lg bg-[#0B0E14] border border-white/8 p-3">
              <p className="text-[11px] text-slate-400">Espacio Utilizado</p>
              <p className="font-mono text-lg font-semibold text-white mt-0.5">
                {formatBytes(totalBytes)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
