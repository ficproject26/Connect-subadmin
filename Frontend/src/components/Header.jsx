import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { useLocation } from 'react-router-dom';
import { normalizeRole } from '../utils/permissions';
import NotificationDropdown from './NotificationDropdown';
import { GlobalSearch } from './GlobalSearch';
import {
  Menu,
  MapPin,
  Bell,
  Sun,
  Moon,
  Calendar,
  ChevronDown
} from 'lucide-react';

export function Header({ setIsSidebarOpen }) {
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const [dateFilter, setDateFilter] = useState('This Month');
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);


  if (!user) return null;

  const role = normalizeRole(user?.role);

  const getDashboardTitle = () => {
    const raw = (user?.role || '').toLowerCase().replace(/[_-]/g, ' ').trim();
    if (raw === 'super admin' || raw === 'superadmin' || raw === 'main admin') return 'SUPER ADMIN DASHBOARD';
    if (raw.includes('state') && !raw.includes('manager')) return 'STATE ADMIN DASHBOARD';
    if (raw.includes('district') && !raw.includes('manager')) return 'DISTRICT ADMIN DASHBOARD';
    if ((raw.includes('division') || raw.includes('divisional')) && !raw.includes('manager')) return 'DIVISION ADMIN DASHBOARD';
    if (raw.includes('pincode') && !raw.includes('manager')) return 'PINCODE ADMIN DASHBOARD';
    if (raw.includes('manager')) return 'MANAGER DASHBOARD';
    return (user.role || 'ADMIN').toUpperCase() + ' DASHBOARD';
  };

  const getLocationSubtitle = () => {
    const raw = (user?.role || '').toLowerCase().replace(/[_-]/g, ' ').trim();
    if (raw === 'super admin' || raw === 'superadmin' || raw === 'main admin' || user.state === 'All India') {
      return 'All India (Central HQ)';
    }
    if (raw.includes('pincode') && !raw.includes('manager')) {
      const pin = user.pincode || (user.scope && user.scope.pincode) || '';
      const area = user.areaName || user.division || user.district || '';
      return pin ? `PIN: ${pin}${area ? ` (${area})` : ''}` : (area || 'Assigned Pincode');
    }
    if ((raw.includes('division') || raw.includes('divisional')) && !raw.includes('manager')) {
      const div = user.division || (user.scope && user.scope.divisionName) || '';
      const divLabel = div ? (div.toLowerCase().endsWith('division') ? div : `${div} Division`) : 'Assigned Division';
      return user.district ? `${divLabel}, ${user.district}` : divLabel;
    }
    if (raw.includes('district') && !raw.includes('manager')) {
      const dist = user.district || (user.scope && user.scope.districtName) || '';
      return dist ? (dist.toLowerCase().endsWith('district') ? dist : `${dist} District`) : 'Assigned District';
    }
    if (raw.includes('state') && !raw.includes('manager')) {
      return user.state || (user.scope && user.scope.stateName) || 'Assigned State';
    }
    if (user.pincode) return `PIN: ${user.pincode} (${user.district || 'Territory'})`;
    if (user.division) return `${user.division} Division`;
    if (user.district) return `${user.district} District`;
    return user.state || 'Assigned Territory';
  };

  return (
    <header className={`sticky top-0 z-30 h-16 ${
      isDark
        ? 'bg-[#0c182b]/95 border-slate-800'
        : 'bg-white/95 border-slate-200 shadow-xs'
    } backdrop-blur-md border-b px-4 sm:px-6 flex items-center justify-between transition-colors duration-150`}>
      {/* Left: Mobile menu toggle + Unified Title & Location */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(prev => !prev)}
          className={`lg:hidden p-2 rounded-xl ${
            isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          } transition`}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col justify-center">
          <h1 className={`text-sm sm:text-base font-black ${
            isDark ? 'text-blue-400' : 'text-[#001D51]'
          } tracking-tight font-sans uppercase leading-tight`}>
            {getDashboardTitle()}
          </h1>

          {/* Location Badge */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border w-fit mt-0.5 ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-[#001D51]'
          } text-[10px] sm:text-[11px] font-semibold`}>
            <MapPin className={`w-3 h-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <span>{getLocationSubtitle()}</span>
          </div>
        </div>
      </div>

      {/* Right: Needed Controls (Date, Search, Theme Toggle, Notifications, Profile) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date Filter */}
        <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700/80'
            : 'bg-slate-50 border-slate-200 text-[#001D51] hover:bg-slate-100'
        } text-xs font-semibold shadow-sm cursor-pointer transition`}>
          <Calendar className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-[#1e355b]'}`} />
          <span>{dateFilter}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5 text-[#1e355b]" />
        </div>

        {/* Global Search */}
        <GlobalSearch isDark={isDark} />

        {/* Dark / Light Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
            isDark
              ? 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700'
              : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
          } text-xs font-semibold shadow-sm transition cursor-pointer active:scale-95 select-none`}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 text-[11px] font-bold">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-blue-600" />
              <span className="text-slate-800 text-[11px] font-bold">Dark</span>
            </>
          )}
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            title="Notifications"
            aria-label="Notifications"
            aria-expanded={showNotifications}
            aria-haspopup="dialog"
            onClick={() => setShowNotifications(prev => !prev)}
            className={`relative p-2 rounded-xl border ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-amber-400'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-amber-600'
            } shadow-sm transition cursor-pointer`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-md animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <NotificationDropdown
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            anchorRef={notifRef}
          />
        </div>

        {/* User Profile */}
        <div className={`flex items-center gap-2 pl-2 border-l ${
          isDark ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <img
            src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover border border-blue-400"
          />
          <div className="hidden sm:block text-left leading-tight">
            <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {user.name || 'Admin'}
            </div>
            <div className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {normalizeRole(user.role) || user.role}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
