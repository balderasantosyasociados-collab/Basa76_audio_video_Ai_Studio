import React, { useEffect, useRef } from 'react';

interface StudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  isStreamMode: boolean;
}

export const StudioVisualizer: React.FC<StudioVisualizerProps> = ({
  analyser,
  isPlaying,
  isStreamMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vuLeftRef = useRef<HTMLDivElement | null>(null);
  const vuRightRef = useRef<HTMLDivElement | null>(null);
  const dbTextRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    let phase = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      let avgEnergy = 0;
      const barCount = 44;
      const gap = 3 * dpr;
      const barWidth = Math.max(2, (w - gap * (barCount - 1)) / barCount);

      if (analyser && isPlaying && !isStreamMode) {
        analyser.getByteFrequencyData(dataArray);
      } else if (isPlaying && isStreamMode) {
        // External streams play directly on <audio> without CORS hijack; render smooth ambient pulse
        phase += 0.08;
        for (let i = 0; i < bufferLength; i++) {
          const base = Math.sin(phase + i * 0.35) * 45 + Math.cos(phase * 1.4 - i * 0.2) * 35 + 95;
          const rolloff = Math.max(0.25, 1 - i / bufferLength);
          dataArray[i] = Math.max(12, Math.min(240, base * rolloff));
        }
      } else {
        dataArray.fill(0);
      }

      // Subtle reference baseline grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1 * dpr;
      for (let g = 1; g <= 3; g++) {
        const y = (h / 4) * g;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      for (let i = 0; i < barCount; i++) {
        const binIdx = Math.min(bufferLength - 1, Math.floor((i / barCount) * (bufferLength * 0.72)));
        const val = dataArray[binIdx] / 255;
        avgEnergy += val;

        const barHeight = Math.max(3 * dpr, val * (h - 6 * dpr));
        const x = i * (barWidth + gap);
        const y = h - barHeight;

        const grad = ctx.createLinearGradient(0, h, 0, y);
        grad.addColorStop(0, '#E11D48');
        grad.addColorStop(0.65, '#F59E0B');
        grad.addColorStop(1, '#FDE68A');

        ctx.fillStyle = isPlaying ? grad : 'rgba(255, 255, 255, 0.09)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2 * dpr);
        ctx.fill();
      }

      avgEnergy = avgEnergy / barCount;
      const leftPct = isPlaying ? Math.min(98, Math.max(6, avgEnergy * 138)) : 0;
      const rightPct = isPlaying ? Math.min(98, Math.max(6, avgEnergy * 130 + Math.sin(phase * 2) * 4)) : 0;

      if (vuLeftRef.current) {
        vuLeftRef.current.style.transform = `scaleX(${leftPct / 100})`;
      }
      if (vuRightRef.current) {
        vuRightRef.current.style.transform = `scaleX(${rightPct / 100})`;
      }
      if (dbTextRef.current) {
        if (!isPlaying || avgEnergy < 0.01) {
          dbTextRef.current.textContent = '-∞ dB';
        } else {
          const db = Math.max(-48, Math.min(0, 20 * Math.log10(avgEnergy * 1.35)));
          dbTextRef.current.textContent = `${db.toFixed(1)} dB`;
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [analyser, isPlaying, isStreamMode]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Espectro de Audio en Tiempo Real</span>
        <span ref={dbTextRef} className="font-mono text-slate-300">
          -∞ dB
        </span>
      </div>

      <div className="h-24 w-full rounded-lg bg-[#090C11] border border-white/8 p-2">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Stereo VU Meters */}
      <div className="grid grid-cols-2 gap-3 pt-0.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-slate-400 w-4">L</span>
          <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
            <div
              ref={vuLeftRef}
              className="h-full w-full origin-left bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-transform duration-75"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-slate-400 w-4">R</span>
          <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
            <div
              ref={vuRightRef}
              className="h-full w-full origin-left bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-transform duration-75"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
