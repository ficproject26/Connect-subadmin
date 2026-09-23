import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Store,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Check,
  Trash2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export default function NotificationDropdown({ isOpen, onClose }) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification
  } = useNotifications();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all'); // 'all' | 'vendors' | 'tasks'

  if (!isOpen) return null;

  // Filter list based on selected tab
  const filteredNotifications = notifications.filter(n => {
    if (tab === 'vendors') {
      return n.type?.startsWith('vendor') || n.entityType === 'vendor';
    }
    if (tab === 'tasks') {
      return n.type?.startsWith('task') || n.type?.startsWith('qc') || n.entityType === 'task';
    }
    return true;
  });

  const getRelativeTime = (isoString) => {
    if (!isoString) return 'Recent';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getItemIcon = (n) => {
    if (n.type === 'vendor_onboarding') {
      return (
        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
          <Store className="w-4 h-4" />
        </div>
      );
    }
    if (n.type === 'vendor_status') {
      return (
        <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      );
    }
    if (n.type === 'task_created' || n.type === 'task_update') {
      return (
        <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
          <ClipboardList className="w-4 h-4" />
        </div>
      );
    }
    if (n.type === 'qc_issue') {
      return (
        <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
        <Bell className="w-4 h-4" />
      </div>
    );
  };

  const handleNotificationClick = (n) => {
    markAsRead(n._id || n.id);
    onClose?.();

    if (n.actionUrl) {
      navigate(n.actionUrl);
    } else if (n.type?.startsWith('vendor') || n.entityType === 'vendor') {
      navigate('/state-admin/vendors');
    } else if (n.type?.startsWith('task') || n.entityType === 'task') {
      navigate('/state-admin/tasks');
    }
  };

  return (
    <div
      className={`absolute right-0 mt-3 w-96 max-w-[92vw] rounded-2xl border shadow-2xl backdrop-blur-xl z-50 overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
        isDark
          ? 'bg-[#0f1b2e]/98 border-slate-700/80 text-white'
          : 'bg-white/98 border-slate-200 text-slate-900 shadow-slate-200/80'
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-[#132238]/60' : 'border-slate-100 bg-slate-50/70'
        }`}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold tracking-tight">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-900 shadow-sm animate-pulse">
              {unreadCount} new
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead()}
            className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        className={`flex items-center gap-1 px-3 pt-2 pb-1 border-b ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}
      >
        {[
          { id: 'all', label: 'All' },
          { id: 'vendors', label: 'Vendors' },
          { id: 'tasks', label: 'Tasks' }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
              tab === t.id
                ? isDark
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              No notifications found
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Live updates for vendor onboarding and task progress will appear here
            </p>
          </div>
        ) : (
          filteredNotifications.map(n => {
            const notifId = n._id || n.id;
            return (
              <div
                key={notifId}
                onClick={() => handleNotificationClick(n)}
                className={`p-3.5 flex items-start gap-3 transition cursor-pointer relative group ${
                  !n.isRead
                    ? isDark
                      ? 'bg-slate-800/40 hover:bg-slate-800/80'
                      : 'bg-amber-50/40 hover:bg-amber-50/80'
                    : isDark
                    ? 'hover:bg-slate-800/30'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Unread indicator dot */}
                {!n.isRead && (
                  <span className="absolute top-4 right-3 w-2 h-2 rounded-full bg-amber-500" />
                )}

                {getItemIcon(n)}

                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h4
                      className={`text-xs font-bold truncate ${
                        !n.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {n.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 pt-0.5">
                    <span className="text-[10px] font-medium text-slate-400">
                      {getRelativeTime(n.createdAt)}
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-0.5">
                      Open <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                {/* Dismiss button */}
                <button
                  type="button"
                  title="Dismiss notification"
                  onClick={e => {
                    e.stopPropagation();
                    removeNotification(notifId);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        className={`p-2.5 text-center border-t ${
          isDark ? 'border-slate-800 bg-[#132238]/40' : 'border-slate-100 bg-slate-50/50'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            onClose?.();
            navigate('/state-admin/notifications');
          }}
          className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          View All Notifications <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
