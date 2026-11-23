import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Film,
  Play,
  FileSignature,
  CreditCard,
  Globe,
  Lock,
  CheckCircle2,
  Trash2,
  Search,
  LogIn,
  PlusCircle,
} from 'lucide-react';
import { CreativeProduction, LicenseTier, ProductionFormat } from '../types/radio';
import { CinemaPlayerModal } from './CinemaPlayerModal';
import { CopyrightContractModal, PaymentGateModal } from './ContractAndPaymentModals';

interface CinemaVaultViewProps {
  user: User | null;
  userProductions: CreativeProduction[];
  publicCatalog: CreativeProduction[];
  onSignIn: () => Promise<void>;
  onOpenCreativeStudio: () => void;
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
  onDeleteProduction: (productionId: string) => Promise<void>;
}

const SOURCE_LABELS: Record<CreativeProduction['sourceBasis'], string> = {
  original: 'Historia Original',
  myth: 'Mito / Leyenda',
  real_history: 'Historia Real',
};

const FORMAT_LABELS: Record<ProductionFormat, string> = {
  series: 'Serie',
  movie: 'Película',
  video: 'Video 5K',
  music: 'Música',
};

export const CinemaVaultView: React.FC<CinemaVaultViewProps> = ({
  user,
  userProductions,
  publicCatalog,
  onSignIn,
  onOpenCreativeStudio,
  onSignContract,
  onUnlockPayment,
  onTogglePublic,
  onDeleteProduction,
}) => {
  const [scope, setScope] = useState<'personal' | 'public'>(user ? 'personal' : 'public');
  const [formatFilter, setFormatFilter] = useState<'all' | ProductionFormat>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [playerProduction, setPlayerProduction] = useState<CreativeProduction | null>(null);
  const [contractTarget, setContractTarget] = useState<CreativeProduction | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<CreativeProduction | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeList = scope === 'personal' ? userProductions : publicCatalog;

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeList.filter((item) => {
      if (formatFilter !== 'all' && item.format !== formatFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.genre.toLowerCase().includes(q) ||
        item.studioStyle.toLowerCase().includes(q) ||
        item.logline.toLowerCase().includes(q)
      );
    });
  }, [activeList, formatFilter, searchQuery]);

  const syncedPlayerProduction = useMemo(() => {
    if (!playerProduction) return null;
    return (
      userProductions.find((p) => p.id === playerProduction.id) ||
      publicCatalog.find((p) => p.id === playerProduction.id) ||
      playerProduction
    );
  }, [playerProduction, userProductions, publicCatalog]);

  const handleToggleCatalog = async (item: CreativeProduction) => {
    setBusyId(item.id);
    try {
      await onTogglePublic(item, !item.isPublicCatalog);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: CreativeProduction) => {
    setBusyId(item.id);
    try {
      await onDeleteProduction(item.id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <section className="rounded-xl border border-white/10 bg-[#121722] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-amber-300 font-semibold">Cinema &amp; Streaming 5K High HD</span>
              <span aria-hidden="true">·</span>
              <span>Catálogo Segregado por Usuario</span>
            </div>
            <h2 className="font-display text-xl font-bold text-white tracking-tight">
              Videoteca, Series y Películas 5K Online
            </h2>
          </div>

          <button
            type="button"
            onClick={onOpenCreativeStudio}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Crear Nueva Producción</span>
          </button>
        </div>

        {/* Scope Segmented Switch + Search + Format Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-white/8">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B0E14] border border-white/10 w-fit">
            <button
              type="button"
              onClick={() => setScope('personal')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'personal'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mi Histórico Personal ({userProductions.length})
            </button>
            <button
              type="button"
              onClick={() => setScope('public')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'public'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cartelera Online 5K ({publicCatalog.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar título, género o estudio..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white placeholder:text-slate-500 w-56"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B0E14] border border-white/10">
              {(['all', 'series', 'movie', 'video', 'music'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormatFilter(fmt)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    formatFilter === fmt
                      ? 'bg-white/15 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {fmt === 'all' ? 'Todo' : FORMAT_LABELS[fmt]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Personal Unauthenticated Notice */}
      {scope === 'personal' && !user ? (
        <div className="rounded-xl border border-white/10 bg-[#121722] p-8 text-center space-y-4">
          <Lock className="w-9 h-9 text-amber-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">
              Inicia sesión para ver tu histórico privado
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Cada usuario mantiene su propio catálogo segregado con sus series, películas, contratos de cesión de derechos y licencias 5K High HD.
            </p>
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Registrarse / Iniciar Sesión</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#121722] p-8 text-center space-y-3">
          <Film className="w-9 h-9 text-slate-500 mx-auto" />
          <h3 className="text-base font-semibold text-white">
            {scope === 'personal'
              ? 'Aún no tienes obras en tu histórico personal'
              : 'La Cartelera Online 5K aún no tiene estrenos publicados'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Usa Crear Espacio para producir una serie, película, video o tema musical desde una sola palabra o tema completo.
          </p>
          <button
            type="button"
            onClick={onOpenCreativeStudio}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ir a Crear Espacio</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredItems.map((item) => {
            const isOwner = Boolean(user && item.ownerId === user.uid);
            const canDownload = isOwner && item.contractSigned && item.isPaid;

            return (
              <article
                key={`${scope}-${item.id}`}
                className="rounded-xl border border-white/10 bg-[#121722] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="text-amber-300 font-semibold">{FORMAT_LABELS[item.format]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.resolution} High HD</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{SOURCE_LABELS[item.sourceBasis]}</span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-400 shrink-0">
                      {item.scenes.length} {item.format === 'series' ? 'ep.' : 'esc.'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-white leading-snug text-balance">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.studioStyle} · {item.targetPlatform} · Por {item.ownerName}
                    </p>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                    {item.logline}
                  </p>

                  {/* Legal & Download Status Line (No Pill Clutter) */}
                  <div className="flex flex-wrap items-center gap-3 text-xs pt-1 border-t border-white/8">
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        item.contractSigned ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      <span>{item.contractSigned ? 'Derechos Cedidos' : 'Sin Contrato'}</span>
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        canDownload ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {canDownload ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {item.isPaid ? 'Descarga 5K Habilitada' : 'Descarga bloqueada (requiere pago)'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Action Row */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/8">
                  <button
                    type="button"
                    onClick={() => setPlayerProduction(item)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Ver Online 5K</span>
                  </button>

                  {isOwner && !item.contractSigned && (
                    <button
                      type="button"
                      onClick={() => setContractTarget(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      <span>Firmar Contrato</span>
                    </button>
                  )}

                  {isOwner && !item.isPaid && (
                    <button
                      type="button"
                      onClick={() => setPaymentTarget(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pagar Licencia</span>
                    </button>
                  )}

                  {isOwner && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleToggleCatalog(item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                        item.isPublicCatalog
                          ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{item.isPublicCatalog ? 'Público 5K' : 'Publicar'}</span>
                    </button>
                  )}

                  {isOwner && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleDelete(item)}
                      aria-label="Eliminar producción"
                      className="ml-auto p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

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
