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
  Plus
} from 'lucide-react';

export function StateAdminDashboard() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState(null);
  const [districtsCount, setDistrictsCount] = useState(0);
  const [divisionsCount, setDivisionsCount] = useState(0);
  const [pincodesCount, setPincodesCount] = useState(0);
  const [adminsCount, setAdminsCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      dataService.getDashboardSummary().catch(() => null),
      dataService.getDistricts().catch(() => null),
      dataService.getDivisions().catch(() => null),
      dataService.getPincodes().catch(() => null),
      dataService.getSubordinateAdmins().catch(() => null)
    ]).then(([summary, dstRes, divRes, pinRes, subRes]) => {
      if (!isMounted) return;
      if (summary?.success) setSummaryData(summary);
      if (dstRes?.districts) setDistrictsCount(dstRes.districts.length);
      if (divRes?.divisions) setDivisionsCount(divRes.divisions.length);
      if (pinRes?.pincodes) setPincodesCount(pinRes.pincodes.length);
      if (subRes?.admins) setAdminsCount(subRes.admins.length);
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
      label: 'Total Districts',
      value: String(districtsCount),
      icon: Building2,
      path: '/state-admin/districts',
      highlight: user?.state || 'Tamil Nadu',
      badgeColor: isDark ? 'bg-blue-950/80 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600',
      highlightColor: 'text-blue-600'
    },
    {
      label: 'Total Divisions',
      value: String(divisionsCount),
      icon: Layers,
      path: '/state-admin/divisions',
      highlight: 'Active Zones',
      badgeColor: isDark ? 'bg-indigo-950/80 border-indigo-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600',
      highlightColor: 'text-indigo-600'
    },
    {
      label: 'Total Pincodes',
      value: String(pincodesCount || metrics.totalPincodes || 0),
      icon: MapPin,
      path: '/state-admin/pincodes',
      highlight: 'Micro Coverage',
      badgeColor: isDark ? 'bg-sky-950/80 border-sky-800 text-sky-400' : 'bg-sky-50 border-sky-100 text-sky-600',
      highlightColor: 'text-indigo-600'
    },
    {
      label: 'Total Customers',
      value: String(metrics.totalCustomers || 0),
      icon: Users,
      path: '/state-admin/customers',
      highlight: 'Registered Base',
      badgeColor: isDark ? 'bg-sky-950/80 border-sky-800 text-sky-400' : 'bg-sky-50 border-sky-100 text-sky-600',
      highlightColor: 'text-emerald-600'
    },
    {
      label: 'Total Vendors',
      value: String(metrics.totalVendors || 0),
      icon: Store,
      path: '/state-admin/vendors',
      highlight: 'Verified Partners',
      badgeColor: isDark ? 'bg-amber-950/80 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-600',
      highlightColor: 'text-amber-600'
    },
    {
      label: 'Total Admins',
      value: String(adminsCount),
      icon: ShieldCheck,
      path: '/state-admin/districts',
      highlight: 'Nodal Officers',
      badgeColor: isDark ? 'bg-purple-950/80 border-purple-800 text-purple-400' : 'bg-purple-50 border-purple-100 text-purple-600',
      highlightColor: 'text-purple-600'
    }
  ];

  // 3. Operations Overview (8 items)
  const operationsList = [
    {
      label: 'Orders',
      count: String(metrics.totalOrders || 0),
      subtext: 'Orders Fulfilled',
      icon: ShoppingBag,
      path: '/state-admin/orders',
      badgeColor: isDark ? 'bg-blue-950/80 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600',
      highlightColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Bookings',
      count: String(metrics.totalBookings || 0),
      subtext: 'Scheduled',
      icon: CalendarCheck,
      path: '/state-admin/bookings',
      badgeColor: isDark ? 'bg-indigo-950/80 border-indigo-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600',
      highlightColor: 'text-indigo-600 dark:text-indigo-400'
    },
    {
      label: 'Jobs',
      count: String(metrics.totalJobs || 0),
      subtext: 'In Progress',
      icon: Briefcase,
      path: '/state-admin/jobs',
      badgeColor: isDark ? 'bg-amber-950/80 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-600',
      highlightColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      label: 'Delivery Partners',
      count: '0',
      subtext: 'On Duty',
      icon: Truck,
      path: '/state-admin/delivery-partners',
      badgeColor: isDark ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600',
      highlightColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      label: 'Technicians',
      count: String(metrics.totalTechnicians || 0),
      subtext: 'Field Ready',
      icon: Wrench,
      path: '/state-admin/technicians',
      badgeColor: isDark ? 'bg-purple-950/80 border-purple-800 text-purple-400' : 'bg-purple-50 border-purple-100 text-purple-600',
      highlightColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      label: 'Executives',
      count: String(metrics.totalExecutives || 0),
      subtext: 'Active',
      icon: UserCheck,
      path: '/state-admin/executives',
      badgeColor: isDark ? 'bg-cyan-950/80 border-cyan-800 text-cyan-400' : 'bg-cyan-50 border-cyan-100 text-cyan-600',
      highlightColor: 'text-cyan-600 dark:text-cyan-400'
    },
    {
      label: 'Support Team',
      count: String(metrics.totalSupportTickets || 0),
      subtext: 'Tickets Logged',
      icon: Headphones,
      path: '/state-admin/support-team',
      badgeColor: isDark ? 'bg-rose-950/80 border-rose-800 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-600',
      highlightColor: 'text-rose-600 dark:text-rose-400'
    },
    {
      label: 'Agents',
      count: String(metrics.totalAgents || 0),
      subtext: 'Active Agents',
      icon: UserPlus,
      path: '/state-admin/agents',
      badgeColor: isDark ? 'bg-teal-950/80 border-teal-800 text-teal-400' : 'bg-teal-50 border-teal-100 text-teal-600',
      highlightColor: 'text-teal-600 dark:text-teal-400'
    }
  ];

  // 4. Finance & Compliance (6 items)
  const financeComplianceList = [
    {
      label: 'Pending KYC',
      value: String(metrics.totalKYC || 0),
      detail: 'Verifications Due',
      icon: FileCheck2,
      alert: (metrics.totalKYC || 0) > 0,
      path: '/state-admin/kyc',
      badgeColor: isDark ? 'bg-amber-950/80 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-600',
      highlightColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      label: 'Pending Payments',
      value: `₹${((metrics.pendingAgentPayouts || 0) + (metrics.pendingVendorPayouts || 0)).toLocaleString()}`,
      detail: 'Invoices Pending',
      icon: Wallet,
      alert: ((metrics.pendingAgentPayouts || 0) + (metrics.pendingVendorPayouts || 0)) > 0,
      path: '/state-admin/payments',
      badgeColor: isDark ? 'bg-rose-950/80 border-rose-800 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-600',
      highlightColor: 'text-rose-600 dark:text-rose-400'
    },
    {
      label: 'Vendor Payments',
      value: `₹${(metrics.totalRevenue || 0).toLocaleString()}`,
      detail: 'Settled this cycle',
      icon: Store,
      path: '/state-admin/vendor-payments',
      badgeColor: isDark ? 'bg-indigo-950/80 border-indigo-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600',
      highlightColor: 'text-indigo-600 dark:text-indigo-400'
    },
    {
      label: 'Agent Payments',
      value: '₹0',
      detail: 'Commission Payouts',
      icon: IndianRupee,
      path: '/state-admin/agent-payments',
      badgeColor: isDark ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600',
      highlightColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      label: 'Pending Payouts',
      value: '0',
      detail: 'Batches Queued',
      icon: CreditCard,
      path: '/state-admin/payments',
      badgeColor: isDark ? 'bg-blue-950/80 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600',
      highlightColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Business Reports',
      value: '0',
      detail: 'Monthly Statements',
      icon: BarChart3,
      path: '/state-admin/reports',
      badgeColor: isDark ? 'bg-purple-950/80 border-purple-800 text-purple-400' : 'bg-purple-50 border-purple-100 text-purple-600',
      highlightColor: 'text-purple-600 dark:text-purple-400'
    }
  ];

  // 5. Pending Actions (7 actionable items with count and arrow)
  const pendingActions = [
    { label: 'District Admin Requests', count: 0, path: '/state-admin/districts', icon: Building2 },
    { label: 'Division Admin Requests', count: 0, path: '/state-admin/divisions', icon: Layers },
    { label: 'Pincode Admin Requests', count: 0, path: '/state-admin/pincodes', icon: MapPin },
    { label: 'KYC Verification', count: metrics.totalKYC || 0, path: '/state-admin/kyc', icon: FileCheck2, highlight: (metrics.totalKYC || 0) > 0 },
    { label: 'Payment Requests', count: 0, path: '/state-admin/payments', icon: IndianRupee, highlight: false },
    { label: 'Queries', count: 0, path: '/state-admin/queries', icon: CircleHelp },
    { label: 'Tasks', count: 0, path: '/state-admin/tasks', icon: ClipboardList }
  ];

  // 6. Recent Activities
  const recentActivities = [];

  // 7. Quick Actions (6 compact buttons)
  const quickActionButtons = [
    { label: 'View District', path: '/state-admin/districts', icon: Building2 },
    { label: 'View Division', path: '/state-admin/divisions', icon: Layers },
    { label: 'View Pincode', path: '/state-admin/pincodes', icon: MapPin },
    { label: 'Assign Admin', path: '/state-admin/districts', icon: ShieldAlert },
    { label: 'Add Vendor', path: '/state-admin/vendors', icon: Store },
    { label: 'Create Task', path: '/state-admin/tasks', icon: ClipboardList }
  ];

  return (
    <div className="space-y-5 pb-8">
      {/* 1. TOP SUMMARY CARDS (6 compact cards) */}
      <div>
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
      </div>


      {/* 3. OPERATIONS OVERVIEW (8 compact cards / rows, NOT charts) */}
      <div className={`admin-card p-4 sm:p-5 ${cardStyle} border rounded-2xl`}>
        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Operations Overview
            </div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Key workload metrics across statewide operations
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {operationsList.map((op, idx) => {
            const Icon = op.icon;
            return (
              <div
                key={idx}
                onClick={() => navigate(op.path)}
                className={`p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xs transition cursor-pointer flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} truncate`}>
                    {op.label}
                  </span>
                  <div className={`p-1.5 rounded-lg border ${op.badgeColor} shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>
                  {op.count}
                </div>
                <div className={`text-[10px] ${op.highlightColor} font-semibold mt-0.5 truncate`}>
                  {op.subtext}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LOWER SECTION: Two Columns (Finance & Activities VS Pending Actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Finance & Compliance + Recent Activities */}
        <div className="lg:col-span-7 space-y-5">
          {/* 4. FINANCE & COMPLIANCE */}
          <div className={`admin-card p-4 sm:p-5 ${cardStyle} border rounded-2xl`}>
            <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Finance & Compliance
                </div>
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Ledger status, escrow payouts, and compliance verification
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {financeComplianceList.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    onClick={() => navigate(item.path)}
                    className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xs transition cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} truncate`}>
                        {item.label}
                      </span>
                      <div className={`p-1.5 rounded-lg border ${item.badgeColor} shrink-0`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2 truncate`}>
                      {item.value}
                    </div>
                    <div className={`text-[10px] ${item.highlightColor} font-semibold mt-0.5 truncate`}>
                      {item.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. RECENT ACTIVITIES */}
          <div className={`admin-card p-4 sm:p-5 ${cardStyle} border rounded-2xl`}>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Recent Activities
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Live Audit Stream
              </span>
            </div>

            {recentActivities.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No recent activity records found
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {recentActivities.map((act, idx) => {
                  const Icon = act.icon;
                  return (
                    <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mt-0.5 shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {act.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {act.desc}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-400 shrink-0 mt-0.5">
                        {act.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): 5. PENDING ACTIONS */}
        <div className="lg:col-span-5">
          <div className={`admin-card p-4 sm:p-5 ${cardStyle} border rounded-2xl h-full flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Pending Actions
                  </div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Items requiring immediate administrative sign-off
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                  {pendingActions.reduce((acc, curr) => acc + curr.count, 0)} Total
                </span>
              </div>

              <div className="space-y-2">
                {pendingActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <div
                      key={idx}
                      onClick={() => navigate(action.path)}
                      className="p-3 rounded-xl bg-slate-50/70 hover:bg-slate-100/90 dark:bg-slate-800/30 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {action.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          action.highlight
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                            : 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {action.count}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-400">
              <span>All escalations monitored</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">State SLA: 24h</span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS AT BOTTOM */}
      <div className={`admin-card p-4 sm:p-5 ${cardStyle} border rounded-2xl`}>
        <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">
          Quick Actions
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {quickActionButtons.map((btn, idx) => {
            const Icon = btn.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => navigate(btn.path)}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/50 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-slate-800 dark:hover:text-blue-400 text-xs font-bold text-slate-900 dark:text-white transition-all cursor-pointer group"
              >
                <Icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">{btn.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
