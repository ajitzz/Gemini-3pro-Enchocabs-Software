
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to server if needed
    try {
      fetch('/api/perf-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'react-error',
          value: 1,
          rating: 'critical',
          route: window.location.pathname,
          id: error.message
        })
      }).catch(() => {});
    } catch (e) {
      console.error("Failed to send error metrics", e);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-rose-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-slate-600 mb-8">
              We encountered an unexpected error. Our team has been notified.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-8 p-4 bg-slate-100 rounded-xl text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-rose-700 font-bold mb-1">{this.state.error.toString()}</p>
                <p className="text-[10px] font-mono text-slate-500 whitespace-pre">
                  {this.state.errorInfo?.componentStack}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200"
              >
                <RefreshCw size={18} />
                Reload Application
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Home size={18} />
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
