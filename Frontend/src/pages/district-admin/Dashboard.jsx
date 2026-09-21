import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import {
  Layers,
  MapPin,
  Users,
  Store,
  ShoppingBag,
  CalendarCheck,
  Briefcase,
  Wrench,
  UserPlus,
  Clock,
  IndianRupee,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';

export function DistrictAdminDashboard() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState(null);
  const [divisions, setDivisions] = useState([]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      dataService.getDashboardSummary().catch(() => null),
      dataService.getDivisions().catch(() => null)
    ]).then(([summary, divRes]) => {
      if (!isMounted) return;
      if (summary?.success) setSummaryData(summary);
      if (divRes?.divisions) setDivisions(divRes.divisions);
    });
    return () => { isMounted = false; };
  }, []);

  const metrics = summaryData?.metrics || {};
  const stats = {
    totalDivisions: divisions.length,
    totalPincodes: metrics.totalPincodes || 0,
    totalCustomers: metrics.totalCustomers || 0,
    totalVendors: metrics.totalVendors || 0,
    totalOrders: metrics.totalOrders || 0,
    totalBookings: metrics.totalBookings || 0,
    totalJobs: metrics.totalJobs || 0,
    totalTechnicians: metrics.totalTechnicians || 0,
    totalAgents: metrics.totalAgents || 0,
    pendingPayments: (metrics.pendingAgentPayouts || 0) + (metrics.pendingVendorPayouts || 0) > 0 ? 1 : 0
  };

  const donutData = [
    { name: 'Silver Tier', value: summaryData?.membershipDistribution?.Silver || 0, color: '#94a3b8' },
    { name: 'Gold Tier', value: summaryData?.membershipDistribution?.Gold || 0, color: '#f59e0b' },
    { name: 'Diamond Tier', value: summaryData?.membershipDistribution?.Diamond || 0, color: '#0ea5e9' }
  ];
  const totalCards = (summaryData?.membershipDistribution?.Silver || 0) + (summaryData?.membershipDistribution?.Gold || 0) + (summaryData?.membershipDistribution?.Diamond || 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Top 10 KPI Cards Grid (Exact 10 Requested by User) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* 1. Total Divisions */}
        <div
          onClick={() => navigate('/district-admin/divisions')}
          className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm hover:border-blue-300 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Divisions</span>
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-blue-950/80 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'
            }`}>
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>{stats.totalDivisions}</div>
          <div className="text-[10px] text-blue-600 font-semibold mt-0.5">{user?.district || 'District'} Divisions</div>
        </div>

        {/* 2. Total Pincodes */}
        <div
          onClick={() => navigate('/district-admin/pincodes')}
          className={`admin-card p-4 ${
            isDark ? 'bg-[#131f37] border-[#1f3358]' : 'bg-white border-slate-200/90 shadow-sm'
          } hover:border-blue-300 transition cursor-pointer flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Pincodes</span>
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-indigo-950/80 border-indigo-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'
            }`}>
              <MapPin className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>{stats.totalPincodes}</div>
          <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">Zonal Coverage</div>
        </div>

        {/* 3. Total Customers */}
        <div
          onClick={() => navigate('/district-admin/customers')}
          className={`admin-card p-4 ${
            isDark ? 'bg-[#131f37] border-[#1f3358]' : 'bg-white border-slate-200/90 shadow-sm'
          } hover:border-blue-300 transition cursor-pointer flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Customers</span>
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-sky-950/80 border-sky-800 text-sky-400' : 'bg-sky-50 border-sky-100 text-sky-600'
            }`}>
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>{stats.totalCustomers}</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">In {user?.district || 'Assigned'} District</div>
        </div>

        {/* 4. Total Vendors */}
        <div
          onClick={() => navigate('/district-admin/vendors')}
          className={`admin-card p-4 ${
            isDark ? 'bg-[#131f37] border-[#1f3358]' : 'bg-white border-slate-200/90 shadow-sm'
          } hover:border-blue-300 transition cursor-pointer flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Vendors</span>
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-amber-950/80 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-600'
            }`}>
              <Store className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>{stats.totalVendors}</div>
          <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Verified Shops</div>
        </div>

        {/* 5. Total Orders */}
        <div
          onClick={() => navigate('/district-admin/orders')}
          className={`admin-card p-4 ${
            isDark ? 'bg-[#131f37] border-[#1f3358]' : 'bg-white border-slate-200/90 shadow-sm'
          } hover:border-blue-300 transition cursor-pointer flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Orders</span>
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
            }`}>
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>{stats.totalOrders}</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">District dispatches</div>
        </div>

        {/* 6. Total Bookings */}
        <div
          onClick={() => navigate('/district-admin/bookings')}
          className={`admin-card p-4 ${
            isDark ? 'bg-[#131f37] border-[#1f3358]' : 'bg-white border-slate-200/90 shadow-sm'
          } hover:border-blue-300 transition cursor-pointer flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Bookings</span>
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-purple-950/80 border-purple-800 text-purple-400' : 'bg-purple-50 border-purple-100 text-purple-600'
            }`}>
              <CalendarCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>{stats.totalBookings}</div>
          <div className="text-[10px] text-purple-600 font-semibold mt-0.5">Services scheduled</div>
        </div>

        {/* 7. Total Jobs */}
        <div
          onClick={() => navigate('/district-admin/jobs')}
          className={`admin-card p-4 ${
            isDark ? 'bg-[#131f37] border-[#1f3358]' : 'bg-white border-slate-200/90 shadow-sm'
          } hover:border-blue-300 transition cursor-pointer flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Jobs</span>
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-cyan-950/80 border-cyan-800 text-cyan-400' : 'bg-cyan-50 border-cyan-100 text-cyan-600'
            }`}>
              <Briefcase className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>{stats.totalJobs}</div>
          <div className="text-[10px] text-cyan-600 font-semibold mt-0.5">Field service tickets</div>
        </div>

        {/* 8. Total Technicians */}
        <div
          onClick={() => navigate('/district-admin/technicians')}
          className={`admin-card p-4 ${
            isDark ? 'bg-[#131f37] border-[#1f3358]' : 'bg-white border-slate-200/90 shadow-sm'
          } hover:border-blue-300 transition cursor-pointer flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Technicians</span>
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-blue-950/80 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'
            }`}>
              <Wrench className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>{stats.totalTechnicians}</div>
          <div className="text-[10px] text-blue-600 font-semibold mt-0.5">On-duty engineers</div>
        </div>

        {/* 9. Total Agents */}
        <div
          onClick={() => navigate('/district-admin/agents')}
          className={`admin-card p-4 ${
            isDark ? 'bg-[#131f37] border-[#1f3358]' : 'bg-white border-slate-200/90 shadow-sm'
          } hover:border-blue-300 transition cursor-pointer flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Agents</span>
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-indigo-950/80 border-indigo-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'
            }`}>
              <UserPlus className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-2`}>{stats.totalAgents}</div>
          <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">Field acquisition partners</div>
        </div>

        {/* 10. Pending Payments */}
        <div
          onClick={() => navigate('/district-admin/payments')}
          className={`admin-card p-4 ${
            isDark ? 'bg-[#131f37] border-[#1f3358]' : 'bg-white border-slate-200/90 shadow-sm'
          } hover:border-rose-300 transition cursor-pointer flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pending Payments</span>
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-rose-950/80 border-rose-800 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-600'
            }`}>
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-rose-400' : 'text-rose-600'} mt-2`}>{stats.pendingPayments}</div>
          <div className="text-[10px] text-rose-600 font-semibold mt-0.5">Awaiting approval</div>
        </div>
      </div>

      {/* Row 2: Assigned Divisions & Membership Tier Share */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Assigned Divisions in District */}
        <div className="lg:col-span-8 admin-card p-5 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Assigned Divisions in {user?.district || 'Salem'}
              </h3>
              <p className="text-xs text-slate-500">Flow: District &rarr; Division &rarr; Pincode</p>
            </div>
            <button
              onClick={() => navigate('/district-admin/divisions')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Manage Divisions</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {divisions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No divisions assigned yet
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {divisions.map(div => (
                <div
                  key={div.id || div.name}
                  onClick={() => navigate(`/district-admin/pincodes?division=${encodeURIComponent(div.name)}`)}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 cursor-pointer transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{div.name}</h4>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                        ID: {div.id || div.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Covering {div.pincodes?.length || 0} registered Pincode zones</p>
                  </div>
                  {div.pincodes && div.pincodes.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {div.pincodes.map(pin => (
                        <span key={pin} className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-xs font-semibold">PIN: {pin}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Membership Cards Donut */}
        <div className="lg:col-span-4 admin-card p-5 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Membership Tier Share
            </span>
            <p className="text-[11px] text-slate-500">Cardholders in {user?.district || 'Salem'}</p>
          </div>

          <div className="relative w-36 h-36 mx-auto my-3 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  innerRadius={42}
                  outerRadius={56}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-base font-black text-slate-900 dark:text-white">{totalCards}</span>
              <span className="text-[9px] text-slate-500 font-semibold uppercase">Cards</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span>Silver</span>
              <span className="font-bold text-slate-900 dark:text-white">{summaryData?.membershipDistribution?.Silver || 0}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Gold</span>
              <span className="font-bold text-slate-900 dark:text-white">{summaryData?.membershipDistribution?.Gold || 0}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400"></span>Diamond</span>
              <span className="font-bold text-slate-900 dark:text-white">{summaryData?.membershipDistribution?.Diamond || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
