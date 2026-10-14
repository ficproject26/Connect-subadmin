import React, { useState, useEffect, useMemo, useCallback } from "react";
import { dataService } from "../services/dataService";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { StatusBadge } from "./Badge";
import { TerritoryHierarchyFilter } from "./TerritoryHierarchyFilter";
import { getTerritoryLocking } from "../utils/territoryHelper";
import {
  Users, UserCheck, Store, CheckCircle,
  Eye, X, Search, Calendar, RefreshCw,
  Download, Award, MapPin, Phone, Mail,
  TrendingUp, BarChart3, AlertCircle, Layers
} from "lucide-react";

export function AgentReportsPanel() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const locking = useMemo(() => getTerritoryLocking(user), [user]);

  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [levelFilter, setLevelFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilterState, setSelectedFilterState] = useState(locking.defaultState || "");
  const [selectedFilterDistrict, setSelectedFilterDistrict] = useState(locking.defaultDistrict || "");
  const [selectedFilterDivision, setSelectedFilterDivision] = useState(locking.defaultDivision || "");
  const [selectedFilterPincode, setSelectedFilterPincode] = useState(locking.defaultPincode || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal Dossier
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Territory hierarchy data
  const [territoryTree, setTerritoryTree] = useState([]);

  useEffect(() => {
    let isMounted = true;
    dataService.getTerritoryHierarchy().then(res => {
      if (isMounted && res?.data) setTerritoryTree(res.data);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        level: levelFilter !== "All" ? levelFilter : undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
        state: selectedFilterState || undefined,
        district: selectedFilterDistrict || undefined,
        division: selectedFilterDivision || undefined,
        pincode: selectedFilterPincode || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      };

      const res = await dataService.getAgentReports(params);
      if (res && res.success) {
        setReports(res.data || []);
        setSummary(res.summary || null);
      } else {
        setError(res?.message || "Failed to load agent reports.");
      }
    } catch (err) {
      console.error("Agent reports error:", err);
      setError(err?.message || "Error communicating with server.");
    } finally {
      setLoading(false);
    }
  }, [
    levelFilter,
    statusFilter,
    searchQuery,
    selectedFilterState,
    selectedFilterDistrict,
    selectedFilterDivision,
    selectedFilterPincode,
    startDate,
    endDate
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Territory cascading filter change
  const handleTerritoryFilterChange = useCallback((filters) => {
    setSelectedFilterState(filters.state || "");
    setSelectedFilterDistrict(filters.district || "");
    setSelectedFilterDivision(filters.division || "");
    setSelectedFilterPincode(filters.pincode || "");
  }, []);

  // CSV Export
  const handleExportCSV = () => {
    if (!reports || reports.length === 0) return;
    const headers = [
      "S.No",
      "Agent Name",
      "Agent ID",
      "Level",
      "State",
      "District",
      "Division",
      "Pincode",
      "Status",
      "Registration Date",
      "Vendor Referrals",
      "Vendors Onboarded",
      "Field Visits",
      "Performance Score"
    ];

    const rows = reports.map((r, i) => [
      i + 1,
      `"${r.name || ""}"`,
      `"${r.agentId || ""}"`,
      `"${r.level || ""}"`,
      `"${r.state || ""}"`,
      `"${r.district || ""}"`,
      `"${r.division || ""}"`,
      `"${r.pincode || ""}"`,
      `"${r.status || ""}"`,
      `"${r.registrationDate ? new Date(r.registrationDate).toLocaleDateString("en-IN") : "N/A"}"`,
      r.vendorReferrals || 0,
      r.vendorsOnboarded || 0,
      r.fieldVisits || 0,
      `${r.performanceScore || 0}%`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Agent_Business_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLevelBadgeCls = (lvl = "") => {
    const l = lvl.toLowerCase();
    if (l.includes("state")) return isDark ? "bg-purple-900/40 text-purple-300 border-purple-700" : "bg-purple-50 text-purple-700 border-purple-200";
    if (l.includes("district")) return isDark ? "bg-indigo-900/40 text-indigo-300 border-indigo-700" : "bg-indigo-50 text-indigo-700 border-indigo-200";
    if (l.includes("division")) return isDark ? "bg-amber-900/40 text-amber-300 border-amber-700" : "bg-amber-50 text-amber-700 border-amber-200";
    return isDark ? "bg-emerald-900/40 text-emerald-300 border-emerald-700" : "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={`p-4 rounded-2xl border transition ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Scoped Agents
            </span>
            <div className={`p-2 rounded-xl ${isDark ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black">{summary?.totalAgents || reports.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Within authorized territory</div>
        </div>

        <div className={`p-4 rounded-2xl border transition ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Active Agents
            </span>
            <div className={`p-2 rounded-xl ${isDark ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500">{summary?.activeAgents || reports.filter(r => r.status === "Active").length}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1">Ready for field operations</div>
        </div>

        <div className={`p-4 rounded-2xl border transition ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Vendor Referrals
            </span>
            <div className={`p-2 rounded-xl ${isDark ? "bg-violet-900/30 text-violet-400" : "bg-violet-50 text-violet-600"}`}>
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-violet-400">{summary?.totalReferrals ?? reports.reduce((a, b) => a + (b.vendorReferrals || 0), 0)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Total submitted leads</div>
        </div>

        <div className={`p-4 rounded-2xl border transition ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Vendors Onboarded
            </span>
            <div className={`p-2 rounded-xl ${isDark ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400">{summary?.totalOnboarded ?? reports.reduce((a, b) => a + (b.vendorsOnboarded || 0), 0)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Successfully approved</div>
        </div>

        <div className={`p-4 rounded-2xl border transition ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Avg Performance
            </span>
            <div className={`p-2 rounded-xl ${isDark ? "bg-amber-900/30 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-400">
            {summary?.avgScore ?? (reports.length > 0 ? Math.round(reports.reduce((a, b) => a + (b.performanceScore || 0), 0) / reports.length) : 0)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Quality benchmark</div>
        </div>
      </div>

      {/* Territory Filter Card */}
      <div className={`p-4 rounded-2xl border transition ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"}`}>
            Territory Hierarchy Filter
          </span>
          <span className="text-[11px] text-slate-400">Jurisdiction locked to {locking.level}</span>
        </div>
        <TerritoryHierarchyFilter
          territoryTree={territoryTree}
          locking={locking}
          selectedState={selectedFilterState}
          selectedDistrict={selectedFilterDistrict}
          selectedDivision={selectedFilterDivision}
          selectedPincode={selectedFilterPincode}
          onFilterChange={handleTerritoryFilterChange}
        />
      </div>

      {/* Secondary Controls Bar: Search, Status, Level, Dates, Actions */}
      <div className={`p-4 rounded-2xl border transition ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"} shadow-sm space-y-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by agent name, ID, phone, pincode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border outline-none transition ${
                isDark ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
              }`}
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 mr-1">Level:</span>
            {["All", "State", "District", "Division", "Pincode"].map(lvl => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                  levelFilter === lvl
                    ? isDark ? "bg-blue-600 text-white border-blue-500" : "bg-blue-600 text-white border-blue-600"
                    : isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 mr-1">Status:</span>
            {["All", "Active", "Pending"].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                  statusFilter === st
                    ? isDark ? "bg-emerald-600 text-white border-emerald-500" : "bg-emerald-600 text-white border-emerald-600"
                    : isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Refresh Reports"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-500" : ""}`} />
            </button>
            <button
              onClick={handleExportCSV}
              disabled={reports.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className={`rounded-2xl border overflow-hidden transition ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}>
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
            <p className="text-sm font-medium">Gathering territory agent metrics...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={loadData}
              className="mt-3 px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white"
            >
              Retry
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold text-slate-300">No agent performance reports found</p>
            <p className="text-xs text-slate-500 mt-1">No agents found for the selected territory filters or criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={`border-b text-slate-400 uppercase tracking-wider text-[11px] font-bold ${isDark ? "bg-slate-800/60 border-slate-800" : "bg-slate-50/80 border-slate-200"}`}>
                  <th className="py-3 px-4 w-12 text-center">S.No</th>
                  <th className="py-3 px-4">Agent Name &amp; ID</th>
                  <th className="py-3 px-4">Role / Level</th>
                  <th className="py-3 px-4">Territory Jurisdiction</th>
                  <th className="py-3 px-4">Registration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Referrals</th>
                  <th className="py-3 px-4 text-center">Onboarded</th>
                  <th className="py-3 px-4 text-center">Visits</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-slate-800" : "divide-slate-100"}`}>
                {reports.map((agent, index) => (
                  <tr key={agent.id || index} className={`transition hover:${isDark ? "bg-slate-800/40" : "bg-slate-50/60"}`}>
                    <td className="py-3 px-4 text-center font-bold text-slate-400">{index + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{agent.name}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">{agent.agentId}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold border capitalize ${getLevelBadgeCls(agent.level)}`}>
                        {agent.level} Agent
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-200 font-medium">
                        {agent.district && agent.district !== "N/A" ? `${agent.district}, ` : ""}{agent.state}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {agent.division && agent.division !== "N/A" ? `${agent.division} Div • ` : ""}PIN: {agent.pincode}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {agent.registrationDate ? new Date(agent.registrationDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={agent.status} />
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-violet-400">
                      {agent.vendorReferrals || 0}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-400">
                      {agent.vendorsOnboarded || 0}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-400">
                      {agent.fieldVisits || 0}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              agent.performanceScore >= 75
                                ? "bg-emerald-500"
                                : agent.performanceScore >= 50
                                ? "bg-blue-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${Math.min(100, agent.performanceScore)}%` }}
                          />
                        </div>
                        <span className="font-bold text-xs">{agent.performanceScore}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedAgent(agent);
                          setShowModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white transition border border-blue-500/20 cursor-pointer"
                        title="View Detailed Performance Dossier"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Agent Performance Dossier Modal */}
      {showModal && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition ${isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-5 border-b ${isDark ? "border-slate-800 bg-slate-800/40" : "border-slate-100 bg-slate-50/50"}`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-500">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base">Agent Performance Dossier</h3>
                  <p className="text-xs text-slate-400">Territory compliance &amp; vendor onboarding analytics</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Agent Profile Banner */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDark ? "bg-slate-800/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{selectedAgent.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getLevelBadgeCls(selectedAgent.level)}`}>
                      {selectedAgent.level} Agent
                    </span>
                    <StatusBadge status={selectedAgent.status} />
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">ID: {selectedAgent.agentId}</div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {selectedAgent.mobile}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {selectedAgent.email}</span>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:pl-4 border-slate-700/50">
                  <div className="text-[11px] text-slate-400">Registration Date</div>
                  <div className="text-xs font-semibold mt-0.5">
                    {selectedAgent.registrationDate ? new Date(selectedAgent.registrationDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">Wallet Balance</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">₹{selectedAgent.walletBalance || 0}</div>
                </div>
              </div>

              {/* Territory Jurisdiction */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" /> Authorized Territory Jurisdiction
                </h4>
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl border ${isDark ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                  <div>
                    <span className="text-[10px] text-slate-400 block">State</span>
                    <span className="text-xs font-bold">{selectedAgent.state || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">District</span>
                    <span className="text-xs font-bold">{selectedAgent.district || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Division</span>
                    <span className="text-xs font-bold">{selectedAgent.division || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Pincode</span>
                    <span className="text-xs font-bold font-mono">{selectedAgent.pincode || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Performance Analytics
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className={`p-3 rounded-xl border text-center ${isDark ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                    <div className="text-[11px] text-slate-400">Total Referrals</div>
                    <div className="text-xl font-black text-violet-400 mt-1">{selectedAgent.vendorReferrals || 0}</div>
                  </div>
                  <div className={`p-3 rounded-xl border text-center ${isDark ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                    <div className="text-[11px] text-slate-400">Onboarded Vendors</div>
                    <div className="text-xl font-black text-emerald-400 mt-1">{selectedAgent.vendorsOnboarded || 0}</div>
                  </div>
                  <div className={`p-3 rounded-xl border text-center ${isDark ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                    <div className="text-[11px] text-slate-400">Performance Score</div>
                    <div className="text-xl font-black text-amber-400 mt-1">{selectedAgent.performanceScore}%</div>
                  </div>
                </div>
              </div>

              {/* Referred Vendors Sub-list */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-blue-500" /> Referred Vendors Portfolio ({selectedAgent.referredVendorsList?.length || 0})
                </h4>
                {selectedAgent.referredVendorsList && selectedAgent.referredVendorsList.length > 0 ? (
                  <div className={`rounded-xl border overflow-hidden ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className={`border-b text-[10px] text-slate-400 uppercase font-bold ${isDark ? "bg-slate-800/50 border-slate-800" : "bg-slate-100/60 border-slate-200"}`}>
                          <th className="py-2 px-3">Business Name</th>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3">Submission Date</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? "divide-slate-800" : "divide-slate-100"}`}>
                        {selectedAgent.referredVendorsList.map((vend, vIdx) => (
                          <tr key={vend.id || vIdx}>
                            <td className="py-2 px-3 font-semibold">{vend.businessName}</td>
                            <td className="py-2 px-3 text-slate-400">{vend.category}</td>
                            <td className="py-2 px-3 text-slate-400">
                              {vend.createdAt ? new Date(vend.createdAt).toLocaleDateString("en-IN") : "N/A"}
                            </td>
                            <td className="py-2 px-3">
                              <StatusBadge status={vend.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl border text-center text-xs text-slate-400 ${isDark ? "bg-slate-800/20 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                    No vendor referrals recorded for this agent yet.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t flex justify-end ${isDark ? "border-slate-800 bg-slate-800/20" : "border-slate-100 bg-slate-50"}`}>
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
