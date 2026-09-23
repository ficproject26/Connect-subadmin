import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Store, ClipboardCheck, AlertTriangle, Bell, X, ArrowRight } from 'lucide-react';

export default function NotificationToast() {
  const { latestToast, dismissToast, markAsRead } = useNotifications();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  if (!latestToast) return null;

  const getIcon = () => {
    switch (latestToast.type) {
      case 'vendor_onboarding':
        return <Store className="w-5 h-5 text-amber-500" />;
      case 'vendor_status':
        return <Store className="w-5 h-5 text-emerald-500" />;
      case 'task_created':
      case 'task_update':
        return <ClipboardCheck className="w-5 h-5 text-indigo-500" />;
      case 'qc_issue':
        return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const handleClick = () => {
    if (latestToast._id || latestToast.id) {
      markAsRead(latestToast._id || latestToast.id);
    }
    dismissToast();
    if (latestToast.actionUrl) {
      navigate(latestToast.actionUrl);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-bounce-in shadow-2xl">
      <div
        className={`p-4 rounded-2xl border backdrop-blur-xl transition-all duration-200 ${
          isDark
            ? 'bg-slate-900/95 border-amber-500/40 text-slate-100 shadow-amber-500/10'
            : 'bg-white/95 border-amber-400 text-slate-800 shadow-xl'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              isDark ? 'bg-slate-800 border border-slate-700' : 'bg-amber-50 border border-amber-200'
            }`}
          >
            {getIcon()}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                Real-time Alert
              </span>
              <button
                type="button"
                onClick={dismissToast}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h4 className="text-xs font-bold truncate leading-tight">{latestToast.title}</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-normal">
              {latestToast.message}
            </p>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-slate-400">Just now</span>
              <button
                type="button"
                onClick={handleClick}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                View Details <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
