import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from 'react-router-dom';
import { normalizeRole } from '../utils/permissions';
import {
  Menu,
  MapPin,
  Bell,
  Sun,
  Moon,
  Search,
  Calendar,
  ChevronDown
} from 'lucide-react';

export function Header({ setIsSidebarOpen }) {
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const location = useLocation();
  const [dateFilter, setDateFilter] = useState('This Month');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  if (!user) return null;

  const role = normalizeRole(user?.role);

  const isSuperAdmin =
    role === 'Super Admin' ||
    user.role === 'Super Admin' ||
    location.pathname.startsWith('/super-admin');

  const isDistrictAdmin =
    !isSuperAdmin && (
      role === 'District Admin' ||
      user.role === 'District Admin' ||
      (typeof user.role === 'string' && user.role.toLowerCase().includes('district') && !user.role.toLowerCase().includes('manager')) ||
      location.pathname.startsWith('/district-admin')
    );

  const getDashboardTitle = () => {
    if (isSuperAdmin) return 'MAIN ADMIN DASHBOARD';
    if (isDistrictAdmin) return 'DISTRICT ADMIN DASHBOARD';
    switch (role) {
      case 'Super Admin': return 'MAIN ADMIN DASHBOARD';
      case 'State Admin': return 'STATE ADMIN DASHBOARD';
      case 'Divisional Admin':
      case 'Division Admin': return 'DIVISION ADMIN DASHBOARD';
      case 'Pincode Admin': return 'PINCODE ADMIN DASHBOARD';
      case 'Manager':
      case 'state_manager':
      case 'district_manager':
      case 'division_manager':
      case 'pincode_manager': return 'MANAGER DASHBOARD';
      default: return 'ADMIN DASHBOARD';
    }
  };

  const getLocationSubtitle = () => {
    if (isSuperAdmin) {
      return 'National Headquarters (All India)';
    }
    // District Admin header must never display PIN code, only the dynamic assigned district name
    if (isDistrictAdmin) {
      const dist = user.district || (user.scope && user.scope.districtName) || 'Assigned';
      return dist.toLowerCase().endsWith('district') ? dist : `${dist} District`;
    }
    if (role === 'State Admin' || user.role === 'State Admin' || location.pathname.startsWith('/state-admin')) {
      return user.state || 'Tamil Nadu';
    }
    if (role === 'Divisional Admin' || user.role === 'Division Admin' || location.pathname.startsWith('/divisional-admin')) {
      const div = user.division || 'Division';
      const divLabel = div.toLowerCase().endsWith('division') ? div : `${div} Division`;
      return user.district ? `${divLabel}, ${user.district}` : divLabel;
    }
    if (role === 'Pincode Admin' || user.role === 'Pincode Admin' || location.pathname.startsWith('/pincode-admin')) {
      return `PIN: ${user.pincode || 'Pincode'} (${user.areaName || user.district || 'Local Zone'})`;
    }
    if (user.district) {
      const dist = user.district;
      return dist.toLowerCase().endsWith('district') ? dist : `${dist} District`;
    }
    return user.state || 'Tamil Nadu';
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

        {/* Search button / input */}
        <div className="relative">
          {showSearchInput ? (
            <div className="flex items-center">
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onBlur={() => !searchTerm && setShowSearchInput(false)}
                placeholder="Search..."
                className={`w-40 sm:w-56 px-3 py-1 text-xs rounded-xl border ${
                  isDark
                    ? 'bg-slate-800 border-slate-600 text-slate-100'
                    : 'bg-slate-100 border-slate-300 text-[#001D51]'
                } focus:outline-none`}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSearchInput(true)}
              title="Search records"
              className={`p-2 rounded-xl border ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-blue-400'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-blue-600'
              } shadow-sm transition cursor-pointer`}
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>

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
        <button
          type="button"
          title="Notifications"
          className={`relative p-2 rounded-xl border ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-blue-400'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-blue-600'
          } shadow-sm transition cursor-pointer`}
        >
          <Bell className="w-4 h-4" />
        </button>

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
              {user.role}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
