import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  UserCog,
  MapPin,
  Building2,
  Layers,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Users,
  Store,
  Clock,
  Briefcase,
  AlertCircle
} from 'lucide-react';

export function ManagerDashboard() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const getRoleBadge = (role) => {
    switch (role) {
      case 'state_manager':
        return { label: 'State Agent Manager', level: 'State Tier', color: 'blue' };
      case 'district_manager':
        return { label: 'District Agent Manager', level: 'District Tier', color: 'emerald' };
      case 'division_manager':
        return { label: 'Division Agent Manager', level: 'Division Tier', color: 'indigo' };
      case 'pincode_manager':
        return { label: 'Pincode Agent Manager', level: 'Pincode Tier', color: 'purple' };
      default:
        return { label: 'Field Manager', level: 'Manager Tier', color: 'blue' };
    }
  };

  const badgeInfo = getRoleBadge(user?.role);
  const jurisdictionText = [user?.district, user?.state].filter(Boolean).join(', ') || user?.state || 'Assigned Jurisdiction';

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className={`p-6 sm:p-8 rounded-2xl border transition-all ${
        isDark 
          ? 'bg-slate-900/90 border-slate-800 text-white' 
          : 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white border-blue-800 shadow-md'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-blue-200 backdrop-blur-xs">
              <UserCog className="w-3.5 h-3.5" />
              <span>{badgeInfo.label}</span>
              <span className="w-1 h-1 rounded-full bg-blue-300"></span>
              <span>{badgeInfo.level}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.name || 'Manager'}!
            </h1>
            <p className="text-blue-200/90 text-sm max-w-2xl">
              You are assigned to oversee field operations for <span className="font-semibold text-white">{jurisdictionText}</span>. Your activities are synchronized with the related administrator.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              <span>Open Field Portal (Port 5173)</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className={`p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Jurisdiction</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className={`mt-3 text-lg font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {user?.district || user?.division || user?.state || 'State Territory'}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {user?.state || 'Tamil Nadu'}
          </p>
        </div>

        <div className={`p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Approval Status</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {user?.status === 'active' ? 'Active & Approved' : (user?.status || 'Pending Approval')}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            KYC: {user?.kycStatus || 'Verified'}
          </p>
        </div>

        <div className={`p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Admin</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className={`mt-3 text-lg font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {user?.targetAdminRole || 'Regional Admin'}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Supervisor: {user?.targetAdminName || user?.adminApprovedBy || 'Administrator'}
          </p>
        </div>

        <div className={`p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Access Scope</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className={`mt-3 text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Field Management
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Agents & Merchant Coordination
          </p>
        </div>
      </div>

      {/* Details & Field Operations Card */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Manager Jurisdiction & Credentials
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            ID: {user?._id || user?.id}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
            <div className="text-slate-400 font-medium">Full Name</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">{user?.name}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
            <div className="text-slate-400 font-medium">Registered Email</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">{user?.email}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
            <div className="text-slate-400 font-medium">Mobile Number</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">{user?.mobile || user?.phone || '-'}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
            <div className="text-slate-400 font-medium">Role Assignment</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">{badgeInfo.label}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
            <div className="text-slate-400 font-medium">State / Region</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">{user?.state || 'Tamil Nadu'}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
            <div className="text-slate-400 font-medium">District / Territory</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">{user?.district || 'All Districts'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default ManagerDashboard;
