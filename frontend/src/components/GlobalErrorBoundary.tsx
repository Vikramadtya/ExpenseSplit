import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl p-8 max-w-md w-full shadow-2xl text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-text-main mb-2">Something went wrong</h1>
            <p className="text-text-muted mb-8">
              We've encountered an unexpected error. Our team has been notified.
            </p>

            {this.state.error && (
              <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 text-left overflow-auto max-h-32 mb-8">
                <code className="text-xs text-red-600 dark:text-red-400 font-mono">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <button onClick={() => window.location.reload()} className="btn-primary w-full py-3">
              <RefreshCw className="w-5 h-5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
