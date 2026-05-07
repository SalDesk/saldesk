import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="card max-w-md w-full text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Algo correu mal</h1>
            <p className="text-sm text-gray-500 mb-1">Ocorreu um erro inesperado na aplicação.</p>
            {this.state.error?.message && (
              <code className="block text-xs bg-gray-100 rounded p-2 text-red-600 mb-4 text-left break-all">
                {this.state.error.message}
              </code>
            )}
            <button
              onClick={() => window.location.reload()}
              className="btn-primary px-6"
            >
              Recarregar a página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
