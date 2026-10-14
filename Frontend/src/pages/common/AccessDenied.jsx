import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ShieldAlert, ArrowLeft, LogOut, LayoutDashboard } from 'lucide-react';
import { getRoleDashboardPath } from '../../utils/permissions';

export function AccessDenied() {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const userDashboard = getRoleDashboardPath(user?.role);

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className={`w-full max-w-md p-8 rounded-2xl border shadow-2xl text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-black tracking-tight">Access Denied</h1>
        <p className="text-xs text-rose-400 font-bold uppercase tracking-wider mt-1">HTTP 403 Forbidden</p>

        <p className={`text-xs mt-3 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          You do not have administrative security clearance to access Sub-Admin management pages.
          Your credentials are restricted to your assigned role jurisdiction.
        </p>

        {user && (
          <div className={`mt-5 p-3.5 rounded-xl border text-left text-xs space-y-1.5 ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex justify-between">
              <span className="text-slate-400">Account:</span>
              <span className="font-semibold">{user.name || user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Database Role:</span>
              <span className="font-mono font-bold text-rose-400 uppercase">{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Jurisdiction:</span>
              <span className="font-medium">{user.district || user.division || user.state || 'Assigned Territory'}</span>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => navigate(userDashboard, { replace: true })}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" /> Go to Authorized Portal
          </button>

          <button
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
export default AccessDenied;
