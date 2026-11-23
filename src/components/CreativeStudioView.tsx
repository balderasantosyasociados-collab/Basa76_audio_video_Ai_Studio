import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Clapperboard,
  Film,
  Tv,
  Music,
  Video,
  FileSignature,
  CreditCard,
  Play,
  Globe,
  Lock,
  CheckCircle2,
  Loader2,
  UserCheck,
  LogIn,
} from 'lucide-react';
import {
  CreativeProduction,
  DrumStyle,
  LicenseTier,
  ProductionFormat,
  SourceBasis,
  VideoResolution,
} from '../types/radio';
import { CinemaPlayerModal } from './CinemaPlayerModal';
import { CopyrightContractModal, PaymentGateModal } from './ContractAndPaymentModals';

interface CreativeStudioViewProps {
  user: User | null;
  authLoading: boolean;
  userProductions: CreativeProduction[];
  onSignIn: () => Promise<void>;
  onCreateProduction: (
    draft: Omit<
      CreativeProduction,
      | 'ownerId'
      | 'ownerName'
      | 'contractSigned'
      | 'isPaid'
      | 'licenseTier'
      | 'isPublicCatalog'
      | 'createdAtMs'
      | 'updatedAtMs'
    >
  ) => Promise<void>;
  onSignContract: (
    production: CreativeProduction,
    signerName: string,
    docId: string,
    hash: string
  ) => Promise<void>;
  onUnlockPayment: (
    production: CreativeProduction,
    tier: Exclude<LicenseTier, 'none'>,
    amountUsd: number,
    paymentMethodLabel: string
  ) => Promise<void>;
  onTogglePublic: (production: CreativeProduction, makePublic: boolean) => Promise<void>;
  onOpenCinemaVault: () => void;
}

const FORMAT_OPTIONS: {
  id: ProductionFormat;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'series', label: 'Serie Streaming', desc: 'Temporada por episodios estilo Netflix', icon: Tv },
  { id: 'movie', label: 'Película', desc: 'Largometraje con guion, reparto y escenas', icon: Film },
  { id: 'video', label: 'Video Musical / 5K', desc: 'Videoclip cinematográfico y audio máster', icon: Video },
  { id: 'music', label: 'Música & Banda Sonora', desc: 'Tema original completo con letra y ritmo', icon: Music },
];

const SOURCE_OPTIONS: { id: SourceBasis; label: string; hint: string }[] = [
  { id: 'original', label: 'Historia Propia', hint: 'Universo y argumento 100% inéditos' },
  { id: 'myth', label: 'Basado en Mito o Leyenda', hint: 'Mitología universal o relatos ancestrales' },
  { id: 'real_history', label: 'Basado en Historia Real', hint: 'Crónica histórica o hechos reales' },
];

const STUDIO_STYLES = [
  'Walt Disney / Animación Épica',
  'Sony / Columbia Pictures',
  'Netflix Original Series',
  'BASA Pictures / YouTube 5K',
];

const TARGET_PLATFORMS = [
  'Netflix & Streaming',
  'YouTube 5K High HD',
  'Cine & Salas IMAX',
  'Spotify, TikTok & Todas las Redes',
];

const QUICK_SEEDS = [
  'Relámpago',
  'La ciudad sumergida bajo el Caribe guarda el último acorde perdido.',
  'Historia real de los pioneros que transmitieron radio desde la cima de los Andes.',
  'Mito del ave fénix dorado renaciendo en una metrópoli futurista.',
];

export const CreativeStudioView: React.FC<CreativeStudioViewProps> = ({
  user,
  authLoading,
  userProductions,
  onSignIn,
  onCreateProduction,
  onSignContract,
  onUnlockPayment,
  onTogglePublic,
  onOpenCinemaVault,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [format, setFormat] = useState<ProductionFormat>('series');
  const [sourceBasis, setSourceBasis] = useState<SourceBasis>('original');
  const [studioStyle, setStudioStyle] = useState(STUDIO_STYLES[0]);
  const [targetPlatform, setTargetPlatform] = useState(TARGET_PLATFORMS[0]);
  const [resolution, setResolution] = useState<VideoResolution>('5K');
  const [language, setLanguage] = useState('Español');

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<CreativeProduction | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [playerProduction, setPlayerProduction] = useState<CreativeProduction | null>(null);
  const [contractTarget, setContractTarget] = useState<CreativeProduction | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<CreativeProduction | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const activeProduction = useMemo(() => {
    if (activeId) {
      const fromUser = userProductions.find((p) => p.id === activeId);
      if (fromUser) return fromUser;
    }
    if (localPreview && (!activeId || localPreview.id === activeId)) {
      return localPreview;
    }
    return userProductions[0] || null;
  }, [activeId, userProductions, localPreview]);

  const syncedPlayerProduction = useMemo(() => {
    if (!playerProduction) return null;
    return (
      userProductions.find((p) => p.id === playerProduction.id) ||
      (localPreview?.id === playerProduction.id ? localPreview : playerProduction)
    );
  }, [playerProduction, userProductions, localPreview]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) {
      setErrorMessage('Escribe al menos una palabra, oración o tema completo.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const resp = await fetch('/api/ai/create-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptInput: promptInput.trim(),
          format,
          sourceBasis,
          studioStyle,
          targetPlatform,
          resolution,
          language,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || 'No se pudo generar la producción creativa.');
      }

      const generatedId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const draft: Omit<
        CreativeProduction,
        | 'ownerId'
        | 'ownerName'
        | 'contractSigned'
        | 'isPaid'
        | 'licenseTier'
        | 'isPublicCatalog'
        | 'createdAtMs'
        | 'updatedAtMs'
      > = {
        id: generatedId,
        format,
        sourceBasis,
        studioStyle,
        targetPlatform,
        resolution,
        promptInput: promptInput.trim(),
        title: String(data.title || 'Producción Original BASA'),
        genre: String(data.genre || 'Cine & Música'),
        rating: String(data.rating || '+13'),
        logline: String(data.logline || 'Una obra original creada en BASA Espacio Creativo.'),
        synopsis: String(data.synopsis || ''),
        lyrics: String(data.lyrics || ''),
        soundtrackPrompt: String(data.soundtrackPrompt || ''),
        bpm: Number(data.bpm || 108),
        drumStyle: (data.drumStyle as DrumStyle) || 'pop',
        chordProgression: Array.isArray(data.chordProgression) ? data.chordProgression : [[57, 60, 64, 67]],
        bassNotes: Array.isArray(data.bassNotes) ? data.bassNotes : [45, 45, 41, 41, 43, 43, 40, 40],
        melodyNotes: Array.isArray(data.melodyNotes)
          ? data.melodyNotes
          : [69, 72, 76, 74, 72, 69, 67, 69, 72, 76, 79, 76, 74, 72, 71, 69],
        characters: Array.isArray(data.characters) ? data.characters : [],
        scenes: Array.isArray(data.scenes) ? data.scenes : [],
      };

      if (user) {
        await onCreateProduction(draft);
        setLocalPreview(null);
        setActiveId(generatedId);
      } else {
        setLocalPreview({
          ...draft,
          ownerId: 'guest',
          ownerName: 'Visitante (Sin guardar)',
          contractSigned: false,
          isPaid: false,
          licenseTier: 'none',
          isPublicCatalog: false,
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        });
        setActiveId(generatedId);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error generando tu película, serie o música.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGuestPreviewToAccount = async () => {
    if (!localPreview) return;
    if (!user) {
      await onSignIn();
      return;
    }
    const {
      ownerId: _o,
      ownerName: _on,
      contractSigned: _cs,
      isPaid: _ip,
      licenseTier: _lt,
      isPublicCatalog: _ipc,
      createdAtMs: _cm,
      updatedAtMs: _um,
      ...draft
    } = localPreview;
    await onCreateProduction(draft);
    setLocalPreview(null);
    setActiveId(draft.id);
  };

  const handleToggleCatalog = async (prod: CreativeProduction) => {
    if (!user || prod.ownerId !== user.uid) return;
    setPublishingId(prod.id);
    try {
      await onTogglePublic(prod, !prod.isPublicCatalog);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Account Banner (Segregated Per-User History) */}
      <section className="rounded-xl border border-white/10 bg-[#121722] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-amber-300 font-semibold">Espacio Creativo 5K High HD</span>
            <span aria-hidden="true">·</span>
            <span>Música, Videos, Series y Películas</span>
          </div>
          <h2 className="font-display text-xl font-bold text-white tracking-tight">
            {user
              ? `Estudio privado de ${user.displayName || user.email}`
              : 'Crea desde una palabra, oración o tema completo'}
          </h2>
          <p className="text-xs text-slate-400">
            {user
              ? `Tu histórico personal está aislado y guardado en tu cuenta (${userProductions.length} obras registradas).`
              : 'Regístrate o inicia sesión para guardar tu histórico personal segregado, firmar derechos de autor y publicar en 5K.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium whitespace-nowrap">
                <UserCheck className="w-4 h-4" />
                <span>Cuenta Verificada</span>
              </span>
              <button
                type="button"
                onClick={onOpenCinemaVault}
                className="px-4 py-2 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ver Cine y Series 5K
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={authLoading}
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Registrarse / Iniciar Sesión</span>
            </button>
          )}
        </div>
      </section>

      {/* Main Split: Creation Console + Live Production Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Creation Parameters & Prompt */}
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-5 rounded-xl border border-white/10 bg-[#121722] p-5 space-y-5"
        >
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-rose-400" />
              <span>Guionista, Director y Productor Autónomo</span>
            </h3>
            <p className="text-xs text-slate-400">
              Escribe una sola palabra, una oración o una historia completa para generar obra y banda sonora.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Tu palabra, oración o tema
            </label>
            <textarea
              rows={4}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Ej: 'Atlántida', o 'Un detective musical descubre un vinilo prohibido en Nueva York', o historia completa..."
              className="w-full rounded-lg bg-[#0B0E14] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SEEDS.map((seed, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPromptInput(seed)}
                  className="text-[11px] text-slate-400 hover:text-amber-300 bg-[#0B0E14] border border-white/8 px-2.5 py-1 rounded-md text-left truncate max-w-full cursor-pointer"
                >
                  {seed}
                </button>
              ))}
            </div>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">Formato de Producción</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = format === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormat(opt.id)}
                    className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-rose-600/15 border-rose-500 text-white'
                        : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap">
                      <Icon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source Basis Selector (Original, Myth, Real History) */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Origen Narrativo (Historia, Mito o Real)
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {SOURCE_OPTIONS.map((src) => {
                const active = sourceBasis === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setSourceBasis(src.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-500/12 border-amber-400/60 text-white'
                        : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <span className="font-medium whitespace-nowrap">{src.label}</span>
                    <span className="text-[11px] text-slate-400 truncate ml-2">{src.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Studio Style, Target Platform, Resolution, Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sello / Estilo de Estudio</label>
              <select
                value={studioStyle}
                onChange={(e) => setStudioStyle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white"
              >
                {STUDIO_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Plataforma de Estreno</label>
              <select
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white"
              >
                {TARGET_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Calidad Máster</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as VideoResolution)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white"
              >
                <option value="5K">5K High HD (5120×2880)</option>
                <option value="4K">4K Ultra HD (3840×2160)</option>
                <option value="1080p">Full HD (1920×1080)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Idioma de Obra</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white"
              >
                <option value="Español">Español</option>
                <option value="Inglés">Inglés</option>
                <option value="Bilingüe Español / Inglés">Bilingüe ES/EN</option>
              </select>
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-400 leading-relaxed">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Produciendo Historia, Guion y Banda Sonora...</span>
              </>
            ) : (
              <>
                <Clapperboard className="w-4 h-4" />
                <span>Crear Obra Completa Online</span>
              </>
            )}
          </button>
        </form>

        {/* Right: Active Production Result, Contract & Payment Gate */}
        <div className="lg:col-span-7 space-y-5">
          {!activeProduction ? (
            <div className="rounded-xl border border-white/10 bg-[#121722] p-8 text-center space-y-3">
              <Film className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-semibold text-white">
                Tu estudio de cine, series y música está listo
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Escribe una palabra, una oración o un argumento a la izquierda para generar el guion,
                personajes, escenas/episodios y música original lista para proyectar en 5K High HD.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#121722] p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="text-amber-300 font-semibold">{activeProduction.studioStyle}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeProduction.format.toUpperCase()}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeProduction.resolution} High HD</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{activeProduction.bpm} BPM</span>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white text-balance">
                    {activeProduction.title}
                  </h3>
                  <p className="text-xs text-slate-300">{activeProduction.logline}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPlayerProduction(activeProduction)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Proyectar 5K Online</span>
                  </button>
                </div>
              </div>

              {/* Guest Preview Notice OR Legal Contract + Paid Download Status */}
              {activeProduction.ownerId === 'guest' ? (
                <div className="rounded-lg bg-[#0B0E14] border border-amber-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-amber-300">
                      Vista previa temporal (aún no guardada en tu histórico personal)
                    </p>
                    <p className="text-xs text-slate-400">
                      Inicia sesión para guardar esta producción en tu archivo privado, firmar derechos y habilitar descargas 5K.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveGuestPreviewToAccount}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{user ? 'Guardar en Mi Histórico' : 'Entrar y Guardar'}</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-lg bg-[#0B0E14] border border-white/10 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white">
                        {activeProduction.contractSigned && activeProduction.isPaid ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Derechos Cedidos y Descarga 5K Habilitada</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 text-amber-400" />
                            <span>Descarga Protegida: Requiere Contrato de Derechos y Pago</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {activeProduction.contractSigned
                          ? `Contrato firmado por ${activeProduction.contractSignerName} (${activeProduction.contractHash})`
                          : 'Contrato pendiente de firma'}
                        <span aria-hidden="true"> · </span>
                        {activeProduction.isPaid
                          ? `Licencia pagada (${activeProduction.licenseTier})`
                          : 'Pago pendiente para descargar'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!activeProduction.contractSigned && (
                        <button
                          type="button"
                          onClick={() => setContractTarget(activeProduction)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <FileSignature className="w-3.5 h-3.5" />
                          <span>1. Firmar Cesión de Derechos</span>
                        </button>
                      )}

                      {!activeProduction.isPaid && (
                        <button
                          type="button"
                          onClick={() => setPaymentTarget(activeProduction)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>2. Pagar Licencia</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={publishingId === activeProduction.id}
                        onClick={() => handleToggleCatalog(activeProduction)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                          activeProduction.isPublicCatalog
                            ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-white/6 border-white/10 text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>
                          {activeProduction.isPublicCatalog
                            ? 'En Cartelera Online 5K'
                            : 'Publicar en Cartelera 5K'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Synopsis & Soundtrack Lyrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-amber-300">Sinopsis &amp; Argumento</h4>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {activeProduction.synopsis}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-rose-300">
                    Tema Musical Original ({activeProduction.genre})
                  </h4>
                  <p className="text-xs text-slate-400 italic">{activeProduction.soundtrackPrompt}</p>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto bg-[#0B0E14] rounded-lg p-3 border border-white/8">
                    {activeProduction.lyrics}
                  </pre>
                </div>
              </div>

              {/* Episodes / Scenes List */}
              <div className="space-y-2.5 pt-2 border-t border-white/8">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white">
                    {activeProduction.format === 'series'
                      ? `Episodios Generados (${activeProduction.scenes.length})`
                      : `Escenas de Producción (${activeProduction.scenes.length})`}
                  </h4>
                  <span className="text-xs text-slate-400">
                    {activeProduction.characters.length} personajes principales
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeProduction.scenes.map((sc) => (
                    <div
                      key={sc.index}
                      className="rounded-lg bg-[#0B0E14] border border-white/8 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-white truncate">
                          {sc.index}. {sc.title}
                        </span>
                        <span className="font-mono tabular-nums text-slate-400 shrink-0">
                          {sc.durationLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {sc.visualDescription}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Segregated User History Quick Strip */}
          {user && userProductions.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#121722] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  Tu Histórico Reciente ({userProductions.length})
                </h4>
                <button
                  type="button"
                  onClick={onOpenCinemaVault}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                >
                  Abrir Módulo Cine y Series 5K
                </button>
              </div>
              <div className="divide-y divide-white/8">
                {userProductions.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 flex items-center justify-between gap-4 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className="min-w-0 text-left hover:text-rose-300 cursor-pointer"
                    >
                      <p className="font-semibold text-white truncate">{item.title}</p>
                      <p className="text-slate-400 truncate">
                        {item.format.toUpperCase()} · {item.studioStyle} · {item.resolution} ·{' '}
                        {item.contractSigned ? 'Contrato OK' : 'Sin contrato'} ·{' '}
                        {item.isPaid ? 'Descarga Libre' : 'Bloqueado sin pago'}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlayerProduction(item)}
                      className="px-3 py-1.5 rounded-md bg-white/8 hover:bg-white/12 text-xs text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Abrir 5K
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {syncedPlayerProduction && (
        <CinemaPlayerModal
          production={syncedPlayerProduction}
          isOwner={Boolean(user && syncedPlayerProduction.ownerId === user.uid)}
          onOpenContract={() => setContractTarget(syncedPlayerProduction)}
          onOpenPayment={() => setPaymentTarget(syncedPlayerProduction)}
          onClose={() => setPlayerProduction(null)}
        />
      )}

      {contractTarget && (
        <CopyrightContractModal
          production={contractTarget}
          defaultSignerName={user?.displayName || ''}
          onSign={(signerName, docId, hash) =>
            onSignContract(contractTarget, signerName, docId, hash)
          }
          onClose={() => setContractTarget(null)}
        />
      )}

      {paymentTarget && (
        <PaymentGateModal
          production={paymentTarget}
          onUnlock={(tier, amountUsd, methodLabel) =>
            onUnlockPayment(paymentTarget, tier, amountUsd, methodLabel)
          }
          onClose={() => setPaymentTarget(null)}
        />
      )}
    </div>
  );
};
