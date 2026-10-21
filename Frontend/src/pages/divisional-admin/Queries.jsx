import React, { useState, useEffect, useCallback } from "react";
import { DataTable } from "../../components/DataTable";
import { StatusBadge } from "../../components/Badge";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import {
  CircleHelp, Clock, AlertCircle, CheckCircle2,
  Calendar, Building2, Tag, User, ShieldAlert,
  X, ChevronDown, Phone, MapPin, FileText
} from "lucide-react";

const PRIORITY_CONFIG = {
  Urgent: { bg: "bg-rose-50 dark:bg-rose-950/60", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-900/50" },
  High:   { bg: "bg-amber-50 dark:bg-amber-950/60", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-900/50" },
  Medium: { bg: "bg-blue-50 dark:bg-blue-950/60", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-900/50" },
  Normal: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700" }
};

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Normal;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      {priority === "Urgent" && <ShieldAlert className="w-3 h-3" />}
      {priority || "Normal"}
    </span>
  );
}

function TicketDetailModal({ ticket, onClose, onUpdateStatus }) {
  const [status, setStatus] = useState(ticket?.status || "Pending");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const statusOptions = ["Pending", "In Review", "Resolved", "Closed"];
  async function handleSave() {
    setSaving(true);
    try { await onUpdateStatus(ticket._id || ticket.id, { status, resolution: note }); onClose(); }
    finally { setSaving(false); }
  }
  if (!ticket) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0f1929] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1f3358] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#1f3358]">
          <div>
            <div className="font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold">{ticket.ticketId || ticket.id}</div>
            <div className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{ticket.subject}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700"><Tag className="w-3 h-3" /> {ticket.category}</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5"><FileText className="w-3 h-3" /> Description</div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">{ticket.description || "No description provided."}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5"><User className="w-3 h-3" /> Agent</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">{ticket.raisedBy}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{ticket.userRole}</div>
              {ticket.agentId && <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400">{ticket.agentId}</div>}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5"><Phone className="w-3 h-3" /> Contact</div>
              <div className="text-xs text-slate-700 dark:text-slate-300">{ticket.agentPhone || "—"}</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Territory</div>
            <div className="text-xs text-slate-700 dark:text-slate-300 flex flex-wrap gap-2">
              {ticket.division && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">{ticket.division}</span>}
              {ticket.pincode && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">{ticket.pincode}</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Submitted</div>
              <div className="text-xs text-slate-700 dark:text-slate-300">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">SLA Due</div>
              <div className="text-xs font-mono text-slate-700 dark:text-slate-300">{ticket.slaDate || "—"}</div>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-[#1f3358] pt-4">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Update Status</div>
            <div className="relative mb-3">
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500">
                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Resolution note (optional)..." rows={2} className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3" />
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 text-xs font-semibold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">{saving ? "Saving..." : "Update Ticket"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DivisionalQueries() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [error, setError] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const division = user?.division || "";

  const filterOptions = [
    { label: "All Queries", value: "All" },
    { label: "Pending", value: "Pending" },
    { label: "In Review", value: "In Review" },
    { label: "Resolved", value: "Resolved" },
    { label: "Closed", value: "Closed" }
  ];

  const fetchTickets = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("/tickets", { skipCache: force, fresh: force });
      setQueries(res?.tickets || res?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load queries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleRefresh = () => fetchTickets(true);

  const handleUpdateStatus = async (ticketId, updates) => {
    await apiRequest(`/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify(updates), skipCache: true });
    await fetchTickets(true);
  };

  const filteredQueries = statusFilter === "All"
    ? queries
    : queries.filter(q => (q.status || "").toLowerCase() === statusFilter.toLowerCase());

  const totalCount = queries.length;
  const inReviewCount = queries.filter(q => q.status === "In Review").length;
  const pendingCount = queries.filter(q => q.status === "Pending").length;
  const resolvedCount = queries.filter(q => q.status === "Resolved").length;

  const columns = [
    {
      header: "Query ID & Subject", accessor: "subject",
      render: (row) => (
        <button onClick={() => setSelectedTicket(row)} className="flex items-start gap-3 text-left w-full hover:opacity-80 transition-opacity">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 mt-0.5 shrink-0"><CircleHelp className="w-4 h-4" /></div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{row.subject}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 shrink-0">{row.ticketId || row.id}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate"><Tag className="w-3 h-3 text-slate-400 shrink-0" /> {row.category}</span>
            </div>
          </div>
        </button>
      )
    },
    {
      header: "Raised By", accessor: "raisedBy", className: "whitespace-nowrap",
      render: (row) => (
        <div>
          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1"><User className="w-3 h-3 text-slate-400 shrink-0" /> {row.raisedBy}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{row.userRole}</div>
          {row.agentId && <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400">{row.agentId}</div>}
        </div>
      )
    },
    {
      header: "Division", accessor: "division", className: "whitespace-nowrap",
      render: (row) => (
        <div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1"><Building2 className="w-3 h-3 text-slate-400 shrink-0" /> {row.division || "—"}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{row.pincode || ""}</div>
        </div>
      )
    },
    { header: "Priority", accessor: "priority", className: "whitespace-nowrap", render: (row) => <PriorityBadge priority={row.priority} /> },
    {
      header: "Resolution SLA", accessor: "slaDate", className: "whitespace-nowrap",
      render: (row) => (
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-mono whitespace-nowrap">{row.slaDate || "—"}</span>
        </div>
      )
    },
    {
      header: "Status", accessor: "status", className: "whitespace-nowrap",
      render: (row) => <button onClick={() => setSelectedTicket(row)} className="hover:opacity-80 transition-opacity"><StatusBadge status={row.status} /></button>
    }
  ];

  return (
    <div className="space-y-6">
      {selectedTicket && <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onUpdateStatus={handleUpdateStatus} />}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Divisional Queries & Grievance Desk</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage field queries and escalations across {division ? `${division} Division` : "assigned division"}.
        </p>
      </div>
      {error && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
          <button onClick={handleRefresh} className="ml-auto text-xs font-semibold underline">Retry</button>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Queries</span><div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40"><CircleHelp className="w-4 h-4" /></div></div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{totalCount}</div>
        </div>
        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">In Review</span><div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40"><Clock className="w-4 h-4" /></div></div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{inReviewCount}</div>
        </div>
        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Pending</span><div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40"><AlertCircle className="w-4 h-4" /></div></div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{pendingCount}</div>
        </div>
        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Resolved</span><div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40"><CheckCircle2 className="w-4 h-4" /></div></div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{resolvedCount}</div>
        </div>
      </div>
      <DataTable
        title="Divisional Queries Ledger"
        subtitle="Track inquiry status, SLA compliance, and field escalations"
        columns={columns} data={filteredQueries} loading={loading} onRefresh={handleRefresh}
        searchPlaceholder="Search by ID, subject, or submitter..."
        filterOptions={filterOptions} activeFilter={statusFilter} onFilterChange={setStatusFilter}
        exportFileName="divisional_queries.csv"
      />
    </div>
  );
}