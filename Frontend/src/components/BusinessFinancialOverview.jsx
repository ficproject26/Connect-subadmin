import React from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  BarChart2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownRight,
  CheckCircle2,
  Percent,
  Clock,
  Layers,
  Award
} from 'lucide-react';
import { RecentTransactionsTable } from './RecentTransactionsTable';

export function BusinessFinancialOverview({ report = null, loading = false }) {
  const { isDark } = useTheme();

  const cardStyle = isDark ? "bg-[#131f37] border-[#1f3358]" : "bg-white border-slate-200/90 shadow-sm";
  const fmt = (n) => (n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '₹0');

  const s = report?.summary || {};
  const comparisons = report?.comparisons || {};
  const categoriesBreakdown = report?.categoriesBreakdown || [];
  const topVendors = report?.topVendors || [];
  const orders = report?.ordersList || [];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`h-24 ${isDark ? "bg-slate-800" : "bg-slate-200"} rounded-2xl`}></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`h-40 ${isDark ? "bg-slate-800" : "bg-slate-200"} rounded-2xl`}></div>
          <div className={`h-40 ${isDark ? "bg-slate-800" : "bg-slate-200"} rounded-2xl`}></div>
        </div>
        <div className={`h-64 ${isDark ? "bg-slate-800" : "bg-slate-200"} rounded-2xl`}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Complete Business Inflow and Outflow KPI Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"}`}>
            Financial Inflow &amp; Outflow Overview
          </h3>
          <span className={`text-[11px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Total Commerce Transactions: <span className="font-bold text-blue-500">{s.totalSalesVolume || orders.length}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Gross Transaction Value */}
          <div className={`p-4 rounded-2xl ${cardStyle} border transition-colors flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Gross Value
                </span>
                <div className={`p-1.5 rounded-lg ${isDark ? "bg-blue-950/60 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                  <BarChart2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"} mt-1.5`}>
                {fmt(s.grossTransactionValue || s.grossSalesValue)}
              </div>
            </div>
            <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"} mt-2`}>
              All commerce &amp; subscriptions
            </div>
          </div>

          {/* Successful Incoming Payments */}
          <div className={`p-4 rounded-2xl ${cardStyle} border transition-colors flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Collected Inflow
                </span>
                <div className={`p-1.5 rounded-lg ${isDark ? "bg-emerald-950/60 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
                {fmt(s.successfulIncomingPayments || s.netRevenue)}
              </div>
            </div>
            <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"} mt-2`}>
              Successful paid transactions
            </div>
          </div>

          {/* Outgoing Settlements & Payouts */}
          <div className={`p-4 rounded-2xl ${cardStyle} border transition-colors flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Outgoing Payouts
                </span>
                <div className={`p-1.5 rounded-lg ${isDark ? "bg-amber-950/60 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
                  <ArrowDownRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1.5">
                {fmt(s.outgoingPayments || 0)}
              </div>
            </div>
            <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"} mt-2`}>
              Disbursed merchant settlements
            </div>
          </div>

          {/* Net Business Inflow */}
          <div className={`p-4 rounded-2xl ${cardStyle} border transition-colors flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Net Inflow
                </span>
                <div className={`p-1.5 rounded-lg ${isDark ? "bg-emerald-950/60 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
                {fmt(s.netBusinessInflow || s.netRevenue)}
              </div>
            </div>
            <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"} mt-2`}>
              Post payouts &amp; refunds
            </div>
          </div>

          {/* Platform Commissions & Fees */}
          <div className={`p-4 rounded-2xl ${cardStyle} border transition-colors flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Commissions &amp; Fees
                </span>
                <div className={`p-1.5 rounded-lg ${isDark ? "bg-purple-950/60 text-purple-400" : "bg-purple-50 text-purple-600"}`}>
                  <Percent className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1.5">
                {fmt(s.commissionsAndFees || 0)}
              </div>
            </div>
            <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"} mt-2`}>
              Earned platform revenue
            </div>
          </div>

          {/* Pending & Reversals */}
          <div className={`p-4 rounded-2xl ${cardStyle} border transition-colors flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Pending / Hold
                </span>
                <div className={`p-1.5 rounded-lg ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className={`text-xl font-black ${isDark ? "text-slate-300" : "text-slate-700"} mt-1.5`}>
                {fmt((s.pendingPayments || 0) + (s.refundsAndReversals || 0))}
              </div>
            </div>
            <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"} mt-2`}>
              Awaiting settlement &amp; clearing
            </div>
          </div>
        </div>
      </div>

      {/* 2. Monthly and Yearly Growth Comparisons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Month-to-Date Comparison */}
        <div className={`p-5 rounded-2xl ${cardStyle} border transition-colors space-y-3`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Month-to-Date Comparison
              </h4>
              <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {comparisons.monthly?.currentPeriodLabel || "This Month"} vs{" "}
                {comparisons.monthly?.previousPeriodLabel || "Last Month (Same Period)"}
              </p>
            </div>

            <div
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                (comparisons.monthly?.trend || "up") === "up"
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
              }`}
            >
              {(comparisons.monthly?.trend || "up") === "up" ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>
                {(comparisons.monthly?.percentageChange || 0) > 0 ? "+" : ""}
                {comparisons.monthly?.percentageChange || 0}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <div className={`text-[10px] uppercase font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                This Month
              </div>
              <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {fmt(comparisons.monthly?.currentAmount)}
              </div>
            </div>
            <div>
              <div className={`text-[10px] uppercase font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Last Month
              </div>
              <div className={`text-base font-bold ${isDark ? "text-slate-300" : "text-slate-700"} mt-0.5`}>
                {fmt(comparisons.monthly?.previousAmount)}
              </div>
            </div>
            <div>
              <div className={`text-[10px] uppercase font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Net Difference
              </div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {(comparisons.monthly?.difference || 0) >= 0 ? "+" : ""}
                {fmt(comparisons.monthly?.difference)}
              </div>
            </div>
          </div>
        </div>

        {/* Year-to-Date Comparison */}
        <div className={`p-5 rounded-2xl ${cardStyle} border transition-colors space-y-3`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Year-to-Date Cumulative Growth
              </h4>
              <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {comparisons.yearly?.currentPeriodLabel || "This Year"} vs{" "}
                {comparisons.yearly?.previousPeriodLabel || "Last Year (Same Period)"}
              </p>
            </div>

            <div
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                (comparisons.yearly?.trend || "up") === "up"
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
              }`}
            >
              {(comparisons.yearly?.trend || "up") === "up" ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>
                {(comparisons.yearly?.percentageChange || 0) > 0 ? "+" : ""}
                {comparisons.yearly?.percentageChange || 0}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <div className={`text-[10px] uppercase font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                This Year
              </div>
              <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {fmt(comparisons.yearly?.currentAmount)}
              </div>
            </div>
            <div>
              <div className={`text-[10px] uppercase font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Last Year
              </div>
              <div className={`text-base font-bold ${isDark ? "text-slate-300" : "text-slate-700"} mt-0.5`}>
                {fmt(comparisons.yearly?.previousAmount)}
              </div>
            </div>
            <div>
              <div className={`text-[10px] uppercase font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Net Difference
              </div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {(comparisons.yearly?.difference || 0) >= 0 ? "+" : ""}
                {fmt(comparisons.yearly?.difference)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Highest-Performing Categories and Top Performing Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Categories Breakdown */}
        <div className={`p-5 rounded-2xl ${cardStyle} border transition-colors space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Top Performing Business Categories
              </h4>
            </div>
            <span className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {categoriesBreakdown.length} Categories
            </span>
          </div>

          {categoriesBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No category metrics recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full text-left text-xs ${isDark ? "text-slate-300" : "text-slate-800"}`}>
                <thead className={`${
                  isDark ? "bg-slate-950/40 text-slate-400" : "bg-slate-50 text-slate-500"
                } uppercase text-[10px] border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                  <tr>
                    <th className="px-2.5 py-2 w-10 text-center">S.No.</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-center">Orders</th>
                    <th className="px-3 py-2">Gross Value</th>
                    <th className="px-3 py-2">Share</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? "divide-slate-800/60" : "divide-slate-100"}`}>
                  {categoriesBreakdown.map((c, idx) => (
                    <tr key={c.category} className={`${isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50"}`}>
                      <td className="px-2.5 py-2.5 text-center font-mono text-[11px] text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5 font-semibold">
                        {c.category}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold">
                        {c.count}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold">
                        {fmt(c.grossValue)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, c.percentageContribution || 0)}%` }}
                            ></div>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">
                            {c.percentageContribution}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Performing Vendors */}
        <div className={`p-5 rounded-2xl ${cardStyle} border transition-colors space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Highest-Performing Merchants / Vendors
              </h4>
            </div>
            <span className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Top {topVendors.length} in Jurisdiction
            </span>
          </div>

          {topVendors.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No merchant sales records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full text-left text-xs ${isDark ? "text-slate-300" : "text-slate-800"}`}>
                <thead className={`${
                  isDark ? "bg-slate-950/40 text-slate-400" : "bg-slate-50 text-slate-500"
                } uppercase text-[10px] border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                  <tr>
                    <th className="px-2.5 py-2 w-10 text-center">S.No.</th>
                    <th className="px-3 py-2">Merchant Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-center">Completed</th>
                    <th className="px-3 py-2">Gross Value</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? "divide-slate-800/60" : "divide-slate-100"}`}>
                  {topVendors.map((v, idx) => (
                    <tr key={v.vendorId || idx} className={`${isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50"}`}>
                      <td className="px-2.5 py-2.5 text-center font-mono text-[11px] text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold truncate max-w-[130px]" title={v.vendorName}>
                          {v.vendorName}
                        </div>
                        <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {v.district !== '-' ? v.district : ''} {v.pincode !== '-' ? `(PIN: ${v.pincode})` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                          {v.category || "Products"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold">
                        {v.count}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {fmt(v.grossTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 4. Recent Transactions & Dispatches Table */}
      <RecentTransactionsTable orders={orders} loading={loading} />
    </div>
  );
}
