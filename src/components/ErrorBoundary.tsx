import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Ocurrió un error inesperado en la aplicación.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0E14] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-rose-500/30 bg-[#121722] p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-base font-semibold text-white">
                Se detectó un problema en la sesión
              </h2>
            </div>
            <p className="text-xs text-slate-300 break-words leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recargar Estudio</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
