import { Component, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

class QrErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[QR page error]', error); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
            <p className="text-red-700 font-semibold">Page Error</p>
            <p className="text-red-600 text-sm mt-1">{this.state.error.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function QrLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <QrErrorBoundary>
        <Outlet />
      </QrErrorBoundary>
    </div>
  );
}
