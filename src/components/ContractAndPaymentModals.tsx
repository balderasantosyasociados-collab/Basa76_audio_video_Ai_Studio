import React, { useState } from 'react';
import { FileSignature, CreditCard, Lock, CheckCircle2, X, Loader2 } from 'lucide-react';
import { CreativeProduction, LicenseTier } from '../types/radio';

interface ContractModalProps {
  production: CreativeProduction;
  defaultSignerName: string;
  onSign: (signerName: string, docId: string, hash: string) => Promise<void>;
  onClose: () => void;
}

export const CopyrightContractModal: React.FC<ContractModalProps> = ({
  production,
  defaultSignerName,
  onSign,
  onClose,
}) => {
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [documentId, setDocumentId] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signerName.trim().length < 3) {
      setError('Ingresa tu nombre completo legal para firmar el contrato.');
      return;
    }
    if (!acceptedTerms) {
      setError('Debes aceptar expresamente la cesión total de derechos de autor.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const raw = `${production.id}|${signerName.trim()}|${Date.now()}`;
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
      const hashHex = Array.from(new Uint8Array(digest))
        .slice(0, 12)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      await onSign(signerName.trim(), documentId.trim() || 'FIRMA-DIGITAL', `BASA-CR-${hashHex}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la firma del contrato.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-xl border border-white/15 bg-[#121722] overflow-hidden my-8"
      >
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSignature className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-semibold text-white">
              Contrato de Cesión Total de Derechos de Autor
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg bg-[#0B0E14] border border-white/10 p-4 text-xs text-slate-300 leading-relaxed max-h-56 overflow-y-auto space-y-2.5">
            <p className="font-semibold text-white">
              ACTA DE CESIÓN IRREVOCABLE DE PROPIEDAD INTELECTUAL Y DERECHOS PATRIMONIALES
            </p>
            <p>
              <strong>Obra:</strong> {production.title} ({production.format.toUpperCase()} · {production.resolution})
            </p>
            <p>
              Por medio del presente instrumento digital, el Cedente declara ser el creador de la idea,
              tema, guion o prompt original de la obra arriba descrita y cede de manera total, exclusiva,
              irrevocable y a nivel mundial todos los derechos patrimoniales de autor, reproducción,
              comunicación pública, distribución digital, sincronización musical, adaptación audiovisual y
              explotación comercial en radio, televisión, cine, YouTube, Netflix y plataformas digitales.
            </p>
            <p>
              Asimismo, el Cedente garantiza que la firma electrónica vinculada a su cuenta autenticada
              constituye consentimiento pleno y que la descarga del máster en alta definición queda
              sujeta a la verificación previa del pago de licencia de producción correspondiente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nombre Completo del Autor / Titular</label>
              <input
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Ej. Juan Carlos Baldera"
                className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Documento / ID (Opcional)</label>
              <input
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Cédula, Pasaporte o RNC"
                className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-sm text-white"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 accent-amber-500"
            />
            <span>
              Confirmo y firmo electrónicamente la cesión total y mundial de los derechos de autor de esta obra.
            </span>
          </label>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/8">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
              <span>Firmar Contrato Ahora</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

interface PaymentModalProps {
  production: CreativeProduction;
  onUnlock: (
    tier: Exclude<LicenseTier, 'none'>,
    amountUsd: number,
    paymentMethodLabel: string
  ) => Promise<void>;
  onClose: () => void;
}

const LICENSE_TIERS: {
  id: Exclude<LicenseTier, 'none'>;
  name: string;
  price: number;
  desc: string;
}[] = [
  {
    id: 'music_single',
    name: 'Licencia Audio & Letra',
    price: 9.99,
    desc: 'Descarga WAV 44.1 kHz + Letra + Guion completo.',
  },
  {
    id: 'video_5k',
    name: 'Licencia Video 4K / 5K High HD',
    price: 24.99,
    desc: 'Descarga Video Máster WebM 5K/4K + Banda Sonora WAV.',
  },
  {
    id: 'series_film_master',
    name: 'Máster Serie / Película Completa',
    price: 49.99,
    desc: 'Todos los episodios/escenas 5K, guion, audio y distribución streaming.',
  },
];

export const PaymentGateModal: React.FC<PaymentModalProps> = ({
  production,
  onUnlock,
  onClose,
}) => {
  const defaultTier: Exclude<LicenseTier, 'none'> =
    production.format === 'music'
      ? 'music_single'
      : production.format === 'video'
      ? 'video_5k'
      : 'series_film_master';

  const [selectedTier, setSelectedTier] = useState<Exclude<LicenseTier, 'none'>>(defaultTier);
  const [paymentLabel, setPaymentLabel] = useState('Tarjeta / Checkout BASA Pay');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlan = LICENSE_TIERS.find((t) => t.id === selectedTier)!;

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!production.contractSigned) {
      setError('Primero debes firmar el Contrato de Cesión de Derechos de Autor.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      await onUnlock(selectedTier, activePlan.price, paymentLabel);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error registrando la licencia de pago.');
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={handleConfirmPayment}
        className="w-full max-w-lg rounded-xl border border-white/15 bg-[#121722] overflow-hidden my-8"
      >
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-rose-400" />
            <h3 className="text-base font-semibold text-white">
              Licencia de Pago para Descarga
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg bg-[#0B0E14] border border-white/10 p-3.5 flex items-center justify-between text-xs">
            <span className="text-slate-300 truncate mr-3">{production.title}</span>
            <span className={production.contractSigned ? 'text-emerald-400 shrink-0' : 'text-amber-400 shrink-0'}>
              {production.contractSigned ? 'Contrato Firmado' : 'Falta Contrato'}
            </span>
          </div>

          <div className="space-y-2.5">
            {LICENSE_TIERS.map((tier) => {
              const active = selectedTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTier(tier.id)}
                  className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-rose-500/12 border-rose-500 text-white'
                      : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{tier.name}</span>
                    <span className="font-mono text-sm font-bold text-amber-300">
                      ${tier.price.toFixed(2)} USD
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{tier.desc}</p>
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Método de Liquidación</label>
            <select
              value={paymentLabel}
              onChange={(e) => setPaymentLabel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white"
            >
              <option value="Tarjeta / Checkout BASA Pay">Tarjeta / Checkout BASA Pay</option>
              <option value="PayPal Producción Digital">PayPal Producción Digital</option>
              <option value="Transferencia / Licencia Corporativa">Transferencia / Licencia Corporativa</option>
            </select>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex items-center justify-between pt-2 border-t border-white/8">
            <span className="font-mono text-sm font-semibold text-white">
              Total: ${activePlan.price.toFixed(2)} USD
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={processing || !production.contractSigned}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-xs font-semibold text-white cursor-pointer"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Pagar y Desbloquear Descarga</span>
              </button>
            </div>
          </div>

          {!production.contractSigned && (
            <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>Requisito legal: firma primero el contrato de cesión de derechos para habilitar el pago.</span>
            </p>
          )}
        </div>
      </form>
    </div>
  );
};
