import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useTheme } from '../context/ThemeContext';
import { Menu } from 'lucide-react';

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isDark } = useTheme();
  const location = useLocation();

  // Show header strictly on Dashboard pages only
  const isDashboardPage = location.pathname.endsWith('/dashboard');

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0b1322] text-slate-100' : 'bg-[#f8fafc] text-[#001D51]'} flex transition-colors duration-200 overflow-x-hidden`}>
      {/* Sidebar Navigation */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60 dashboard-content-area overflow-x-hidden">
        {/* Header is shown strictly on dashboard page only */}
        {isDashboardPage && <Header setIsSidebarOpen={setIsSidebarOpen} />}

        {/* Mobile menu bar when header is hidden on other pages */}
        {!isDashboardPage && (
          <div className={`lg:hidden flex items-center justify-between px-4 py-2.5 border-b ${
            isDark ? 'border-slate-800 bg-[#0c182b]' : 'border-slate-200 bg-white'
          }`}>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className={`p-1.5 rounded-lg border ${
                isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-[#001D51]'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-[#001D51]'}`}>Admin Management</span>
            <div className="w-8"></div>
          </div>
        )}

        <main className="flex-1 p-3.5 sm:p-5 lg:p-6 xl:p-8 w-full max-w-full 2xl:max-w-[1700px] mx-auto space-y-5 sm:space-y-6 box-border min-w-0">
          <Outlet />
        </main>

        <footer className={`py-4 px-6 border-t ${
          isDark ? 'border-slate-800/80 text-slate-400 bg-[#0c182b]/50' : 'border-slate-200 text-[#1e355b] bg-white/50'
        } text-center text-xs transition-colors`}>
          Admin Management System &copy; {new Date().getFullYear()} • Role-Based & Location-Based Administrative Portal
        </footer>
      </div>
    </div>
  );
}
