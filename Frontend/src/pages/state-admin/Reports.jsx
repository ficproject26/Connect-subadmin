import React, { useState, useEffect } from "react";
import { dataService } from "../../services/dataService";
import { useTheme } from "../../context/ThemeContext";
import { Download, FileText, BarChart2, MapPin, User, Store, RefreshCw } from "lucide-react";
import { ManagerReportsPanel } from "../../components/ManagerReportsPanel";
import { RecentTransactionsTable } from "../../components/RecentTransactionsTable";

export function StateReports() {
  const { isDark } = useTheme();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("business");

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await dataService.getBusinessReports();
      if (res.success) setReport(res.report);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadReport(); }, []);

  const cardStyle = isDark ? "bg-[#131f37] border-[#1f3358]" : "bg-white border-slate-200/90 shadow-sm";
  const tabBase = "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition border cursor-pointer";

  const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '₹0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>State Reports</h2>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Jurisdiction: {report?.adminScope}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadReport}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
              isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Print / Export
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab("business")}
          className={`${tabBase} ${activeTab === "business"
            ? (isDark ? "bg-blue-900/60 text-blue-300 border-blue-700" : "bg-blue-600 text-white border-blue-600")
            : (isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-white text-slate-600 border-slate-200")}`}
        >
          <BarChart2 className="w-3.5 h-3.5" /> Business &amp; Financial
        </button>
        <button
          onClick={() => setActiveTab("manager")}
          className={`${tabBase} ${activeTab === "manager"
            ? (isDark ? "bg-emerald-900/60 text-emerald-300 border-emerald-700" : "bg-emerald-600 text-white border-emerald-600")
            : (isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-white text-slate-600 border-slate-200")}`}
        >
          <FileText className="w-3.5 h-3.5" /> Manager Field Reports
        </button>
      </div>

      {/* Manager Reports Tab */}
      {activeTab === "manager" && <ManagerReportsPanel />}

      {/* Business Reports Tab */}
      {activeTab === "business" && (
        <>
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className={`h-8 ${isDark ? "bg-slate-800" : "bg-slate-200"} rounded w-1/4`}></div>
              <div className={`h-48 ${isDark ? "bg-slate-800" : "bg-slate-200"} rounded`}></div>
            </div>
          ) : (() => {
            const s = report?.summary || {};
            const orders = report?.ordersList || [];
            return (
              <>
                {/* KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Gross Sales Value", value: fmt(s.grossSalesValue), sub: "Total revenue generated", color: isDark ? "text-white" : "text-slate-900" },
                    { label: "Card Discounts Given", value: fmt(s.discountsGiven), sub: "Silver / Gold / Diamond", color: isDark ? "text-amber-400" : "text-amber-600" },
                    { label: "Net Collected Revenue", value: fmt(s.netRevenue), sub: "Post customer discounts", color: "text-emerald-600" },
                    { label: "Active Customers", value: s.activeCustomerBase || 0, sub: "Across all state districts", color: isDark ? "text-indigo-400" : "text-blue-600" }
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} className={`admin-card p-5 rounded-2xl ${cardStyle} border transition-colors`}>
                      <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"} font-semibold uppercase`}>{label}</div>
                      <div className={`text-2xl font-black ${color} mt-1`}>{value}</div>
                      <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"} mt-1`}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Recent Transactions Table */}
                <RecentTransactionsTable orders={orders} loading={loading} />
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

