import React, { useState, useEffect } from "react";
import { dataService } from "../../services/dataService";
import { useTheme } from "../../context/ThemeContext";
import { Download, FileText, BarChart2, RefreshCw } from "lucide-react";
import { ManagerReportsPanel } from "../../components/ManagerReportsPanel";
import { BusinessFinancialOverview } from "../../components/BusinessFinancialOverview";

export function DistrictReports() {
  const { isDark } = useTheme();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("business");

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await dataService.getBusinessReports();
      if (res.success) setReport(res.report);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const tabBase = "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition border cursor-pointer";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>District Business &amp; Financial Reports</h2>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Jurisdiction: {report?.adminScope || "District"}</p>
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

      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab("business")}
          className={`${tabBase} ${activeTab === "business" ? (isDark ? "bg-blue-900/60 text-blue-300 border-blue-700" : "bg-blue-600 text-white border-blue-600") : (isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-white text-slate-600 border-slate-200")}`}
        >
          <BarChart2 className="w-3.5 h-3.5" /> Business &amp; Financial
        </button>
        <button
          onClick={() => setActiveTab("manager")}
          className={`${tabBase} ${activeTab === "manager" ? (isDark ? "bg-emerald-900/60 text-emerald-300 border-emerald-700" : "bg-emerald-600 text-white border-emerald-600") : (isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-white text-slate-600 border-slate-200")}`}
        >
          <FileText className="w-3.5 h-3.5" /> Manager Field Reports
        </button>
      </div>

      {activeTab === "manager" && <ManagerReportsPanel />}

      {activeTab === "business" && (
        <BusinessFinancialOverview report={report} loading={loading} />
      )}
    </div>
  );
}
