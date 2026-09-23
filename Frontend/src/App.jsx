import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationToast from './components/NotificationToast';
import { AppRoutes } from './routes/AppRoutes';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('GlobalErrorBoundary caught runtime error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-6 sm:p-10 font-mono">
          <div className="max-w-3xl mx-auto bg-slate-800/90 border border-rose-500/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400 pb-3 border-b border-slate-700">
              <span className="text-lg font-bold">⚠️ Application Error</span>
            </div>
            <div className="text-rose-300 font-semibold text-sm">
              {this.state.error?.toString()}
            </div>
            {this.state.errorInfo?.componentStack && (
              <pre className="text-xs text-slate-300 bg-slate-950 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap border border-slate-800">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-xs font-bold rounded-xl transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { theme, isDark } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-[#0b1322] text-slate-100' : 'light bg-[#f8fafc] text-[#001D51]'} transition-colors duration-200`}>
      <AppRoutes />
      <NotificationToast />
    </div>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <AppContent />
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
