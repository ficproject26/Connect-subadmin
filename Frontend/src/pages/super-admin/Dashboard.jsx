import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import {
  Building2,
  Layers,
  MapPin,
  Users,
  Store,
  ShieldCheck,
  ShieldAlert,
  ShoppingBag,
  CalendarCheck,
  Briefcase,
  Truck,
  Wrench,
  UserCheck,
  Headphones,
  UserPlus,
  FileCheck2,
  IndianRupee,
  CreditCard,
  Wallet,
  BarChart3,
  Clock,
  CircleHelp,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Plus,
  UserCog
} from 'lucide-react';

export function SuperAdminDashboard() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState(null);
  const [statesCount, setStatesCount] = useState(0);
  const [districtsCount, setDistrictsCount] = useState(0);
  const [divisionsCount, setDivisionsCount] = useState(0);
  const [adminsCount, setAdminsCount] = useState(0);
  const [managersCount, setManagersCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      dataService.getDashboardSummary().catch(() => null),
      dataService.getStates().catch(() => null),
      dataService.getDistricts().catch(() => null),
      dataService.getDivisions().catch(() => null),
      dataService.getSubordinateAdmins().catch(() => null),
      dataService.getManagers().catch(() => null)
    ]).then(([summary, stRes, dstRes, divRes, subRes, mgrRes]) => {
      if (!isMounted) return;
      if (summary?.success) setSummaryData(summary);
      if (stRes?.states) setStatesCount(stRes.states.length);
      if (dstRes?.districts) setDistrictsCount(dstRes.districts.length);
      if (divRes?.divisions) setDivisionsCount(divRes.divisions.length);
      if (subRes?.admins) setAdminsCount(subRes.admins.length);
      if (mgrRes?.managers) setManagersCount(mgrRes.managers.length);
      else if (Array.isArray(mgrRes)) setManagersCount(mgrRes.length);
    });
    return () => { isMounted = false; };
  }, []);

  const metrics = summaryData?.metrics || {};

  const cardStyle = isDark
    ? 'bg-[#131f37] border-[#1f3358]'
    : 'bg-white border-slate-200/90 shadow-sm';

  // 1. Top Summary Cards (6 compact cards)
  const topSummaryCards = [
    {
      label: 'Total States',
      value: String(statesCount || 0),
      icon: Building2,
      path: '/super-admin/states',
      highlight: 'National Coverage',
      badgeColor: isDark ? 'bg-blue-950/80 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600',
      highlightColor: 'text-blue-600'
    },
    {
      label: 'Total Districts',
      value: String(districtsCount || 0),
      icon: Building2,
      path: '/super-admin/districts',
      highlight: 'Zonal Units',
      badgeColor: isDark ? 'bg-indigo-950/80 border-indigo-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600',
      highlightColor: 'text-indigo-600'
    },
    {
      label: 'Total Divisions',
      value: String(divisionsCount || 0),
      icon: Layers,
      path: '/super-admin/divisions',
      highlight: 'Urban & Rural Hubs',
      badgeColor: isDark ? 'bg-purple-950/80 border-purple-800 text-purple-400' : 'bg-purple-50 border-purple-100 text-purple-600',
      highlightColor: 'text-purple-600'
    },
    {
      label: 'Total Pincodes',
      value: String(metrics.totalPincodes || 0),
      icon: MapPin,
      path: '/super-admin/pincodes',
      highlight: 'Micro Postal Zones',
      badgeColor: isDark ? 'bg-sky-950/80 border-sky-800 text-sky-400' : 'bg-sky-50 border-sky-100 text-sky-600',
      highlightColor: 'text-sky-600'
    },
    {
      label: 'Sub-Admins',
      value: String(adminsCount || 0),
      icon: ShieldCheck,
      path: '/super-admin/states',
      highlight: 'Authorized Hierarchy',
      badgeColor: isDark ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600',
      highlightColor: 'text-emerald-600'
    },
    {
      label: 'Field Managers',
      value: String(managersCount || 0),
      icon: UserCog,
      path: '/super-admin/managers/state',
      highlight: 'Field Operations',
      badgeColor: isDark ? 'bg-amber-950/80 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-600',
      highlightColor: 'text-amber-600'
    }
  ];

  // 2. Quick Action Buttons
  const quickActions = [
    { label: '+ Add State Admin', path: '/super-admin/states', icon: Plus, color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: '+ Add District Admin', path: '/super-admin/districts', icon: Plus, color: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
    { label: '+ Add Division Admin', path: '/super-admin/divisions', icon: Plus, color: 'bg-purple-600 hover:bg-purple-700 text-white' },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Banner */}
      <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDark ? 'bg-[#101b33] border-slate-800' : 'bg-gradient-to-r from-blue-900 to-indigo-900 text-white'
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">National Headquarters</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Main Administrative Portal</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Central governance console. Provision State Sub-Admins (max 4 per state), oversee District/Division hierarchies, and supervise field managers across India.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quickActions.map((qa, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => navigate(qa.path)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5 ${qa.color}`}
            >
              <span>{qa.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 1. Top Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {topSummaryCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(card.path)}
              className={`admin-card p-4 ${cardStyle} hover:border-blue-300 transition cursor-pointer flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {card.label}
                </span>
                <div className={`p-1.5 rounded-lg border ${card.badgeColor}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>
                {card.value}
              </div>
              <div className={`text-[10px] ${card.highlightColor} font-semibold mt-0.5`}>
                {card.highlight}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Sub-Admin Capacity Policy Banner */}
      <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          Sub-Admin Quota Policy & Allocation Rules
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-blue-950/40 border-blue-800/60' : 'bg-blue-50/70 border-blue-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">State Sub-Admin</span>
              <span className="text-xs font-mono font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">4 Max</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Up to 4 State Sub-Admins per State for distributed governance.</p>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-indigo-950/40 border-indigo-800/60' : 'bg-indigo-50/70 border-indigo-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">District Sub-Admin</span>
              <span className="text-xs font-mono font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">1 Max</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Exactly 1 District Sub-Admin assigned per District.</p>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-purple-950/40 border-purple-800/60' : 'bg-purple-50/70 border-purple-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Division Sub-Admin</span>
              <span className="text-xs font-mono font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">1 Max</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Exactly 1 Division Sub-Admin assigned per Division.</p>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-sky-950/40 border-sky-800/60' : 'bg-sky-50/70 border-sky-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400">Pincode Sub-Admin</span>
              <span className="text-xs font-mono font-bold bg-sky-600 text-white px-2 py-0.5 rounded-full">1 Max</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Exactly 1 Pincode Sub-Admin assigned per PIN Code.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
