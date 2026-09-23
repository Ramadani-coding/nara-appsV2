import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          role="alert" 
          aria-live="assertive" 
          className="min-h-screen bg-[#FAF8F5] dark:bg-[#0B0F19] text-black dark:text-white flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#181C2A] border-3 border-black dark:border-gray-700 rounded-2xl shadow-[8px_8px_0px_#000] p-6 sm:p-8 space-y-6 text-center">
            {/* Error Icon Badge */}
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950/70 border-2 border-black dark:border-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>

            {/* Error Copy */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black dark:text-white">
                Terjadi Kendala Teknis
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
                Halaman ini mengalami gangguan tak terduga. Tenang, data akun dan pesanan Anda tetap aman.
              </p>
            </div>

            {/* Error Details (collapsible / technical message) */}
            {this.state.error?.message && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border-2 border-dashed border-red-300 dark:border-red-800 rounded-xl text-left">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-700 dark:text-red-400 block mb-1">
                  Info Debug:
                </span>
                <p className="text-xs font-mono text-red-900 dark:text-red-300 break-all line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Actions: Minimum 44px height touch targets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                aria-label="Muat ulang halaman saat ini"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-yellow text-black font-black text-xs uppercase tracking-wider border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] neo-btn cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                <span>Muat Ulang</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                aria-label="Kembali ke halaman beranda"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-blue text-white font-black text-xs uppercase tracking-wider border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] neo-btn cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Ke Beranda</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
