import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Store,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Check,
  Trash2,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Clock,
  ExternalLink
} from 'lucide-react';

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification
  } = useNotifications();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'vendor' | 'task' | 'unread'
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = notifications.filter(n => {
    // Tab filter
    if (activeTab === 'unread' && n.isRead) return false;
    if (activeTab === 'vendor' && !(n.type?.startsWith('vendor') || n.entityType === 'vendor')) return false;
    if (activeTab === 'task' && !(n.type?.startsWith('task') || n.type?.startsWith('qc') || n.entityType === 'task')) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchMsg = n.message?.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg) return false;
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

  const getIcon = (n) => {
    if (n.type === 'vendor_onboarding') {
      return (
        <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
          <Store className="w-5 h-5" />
        </div>
      );
    }
    if (n.type === 'vendor_status') {
      return (
        <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      );
    }
    if (n.type === 'task_created' || n.type === 'task_update') {
      return (
        <div className="p-3 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
      );
    }
    if (n.type === 'qc_issue') {
      return (
        <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="p-3 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
        <Bell className="w-5 h-5" />
      </div>
    );
  };

  const handleNavigate = (n) => {
    markAsRead(n._id || n.id);
    if (n.actionUrl) {
      navigate(n.actionUrl);
    } else if (n.type?.startsWith('vendor') || n.entityType === 'vendor') {
      navigate('/state-admin/vendors');
    } else if (n.type?.startsWith('task') || n.entityType === 'task') {
      navigate('/state-admin/tasks');
    }
  };

  const vendorCount = notifications.filter(n => n.type?.startsWith('vendor') || n.entityType === 'vendor').length;
  const taskCount = notifications.filter(n => n.type?.startsWith('task') || n.type?.startsWith('qc') || n.entityType === 'task').length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-amber-500" />
            Operational Notifications
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time feed of merchant onboardings, compliance status transitions, and field task assignments
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="self-start sm:self-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Mark All as Read ({unreadCount})
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-200'
          } shadow-xs`}
        >
          <div className="text-xs font-bold text-slate-400">Total Alerts</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {notifications.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Recorded events</div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-200'
          } shadow-xs`}
        >
          <div className="text-xs font-bold text-amber-500">Unread</div>
          <div className="text-2xl font-black text-amber-500 mt-1">
            {unreadCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Require attention</div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-200'
          } shadow-xs`}
        >
          <div className="text-xs font-bold text-emerald-500">Vendor Updates</div>
          <div className="text-2xl font-black text-emerald-500 mt-1">
            {vendorCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Onboardings & KYC</div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-200'
          } shadow-xs`}
        >
          <div className="text-xs font-bold text-indigo-500">Task Updates</div>
          <div className="text-2xl font-black text-indigo-500 mt-1">
            {taskCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Field operations & QC</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-800/30 border-slate-700/60' : 'bg-white border-slate-200'
        } flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3`}
      >
        {/* Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'all', label: 'All', count: notifications.length },
            { id: 'unread', label: 'Unread', count: unreadCount },
            { id: 'vendor', label: 'Vendors', count: vendorCount },
            { id: 'task', label: 'Tasks', count: taskCount }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === tab.id
                    ? 'bg-slate-950/20 text-slate-950'
                    : isDark
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border outline-none transition ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500'
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-amber-500'
            }`}
          />
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div
            className={`p-12 text-center rounded-2xl border ${
              isDark ? 'bg-slate-800/20 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <Bell className="w-10 h-10 mx-auto mb-2 text-slate-400 opacity-50" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No matching notifications
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Real-time events will populate here as operations progress.
            </p>
          </div>
        ) : (
          filtered.map(n => {
            const notifId = n._id || n.id;
            return (
              <div
                key={notifId}
                className={`p-4 sm:p-5 rounded-2xl border transition-all duration-150 flex items-start gap-4 ${
                  !n.isRead
                    ? isDark
                      ? 'bg-slate-800/60 border-amber-500/40 shadow-sm'
                      : 'bg-amber-50/50 border-amber-200 shadow-sm'
                    : isDark
                    ? 'bg-slate-800/20 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {getIcon(n)}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-bold ${
                          !n.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {n.title}
                      </h3>
                      {!n.isRead && (
                        <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-amber-500 text-slate-950">
                          Unread
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        {getRelativeTime(n.createdAt)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                    {n.message}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center gap-2">
                      {n.scope?.pincode && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          PIN: {n.scope.pincode}
                        </span>
                      )}
                      {n.scope?.district && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {n.scope.district}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeNotification(notifId)}
                        className="px-2.5 py-1 text-slate-400 hover:text-rose-500 text-xs font-semibold rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNavigate(n)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                      >
                        View <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
