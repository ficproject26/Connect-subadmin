import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { useTheme } from '../../context/ThemeContext';
import {
  CircleHelp,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Calendar,
  Building2,
  Tag,
  User
} from 'lucide-react';

const INITIAL_DISTRICT_QUERIES = [];

export function DistrictQueries() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [queries, setQueries] = useState(INITIAL_DISTRICT_QUERIES);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  const district = user?.district || '';

  const filterOptions = [
    { label: 'All Queries', value: 'All' },
    { label: 'In Review', value: 'In Review' },
    { label: 'Pending', value: 'Pending' },
    { label: 'Resolved', value: 'Resolved' }
  ];

  const filteredQueries = statusFilter === 'All'
    ? queries
    : queries.filter(q => q.status.toLowerCase() === statusFilter.toLowerCase());

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 400);
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'Urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/50">
            <ShieldAlert className="w-3 h-3" /> Urgent
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/50">
            High
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/50">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            Normal
          </span>
        );
    }
  };

  const columns = [
    {
      header: 'Query ID & Subject',
      accessor: 'subject',
      render: (row) => (
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 mt-0.5 shrink-0">
            <CircleHelp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug">{row.subject}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 shrink-0">{row.id}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                <Tag className="w-3 h-3 text-slate-400 shrink-0" /> {row.category}
              </span>
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Raised By',
      accessor: 'raisedBy',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400 shrink-0" />
            {row.raisedBy}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{row.userRole}</div>
        </div>
      )
    },
    {
      header: 'Jurisdiction',
      accessor: 'district',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
            {row.district}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{row.division}</div>
        </div>
      )
    },
    {
      header: 'Priority',
      accessor: 'priority',
      className: 'whitespace-nowrap',
      render: (row) => getPriorityBadge(row.priority)
    },
    {
      header: 'Resolution SLA',
      accessor: 'slaDate',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-mono whitespace-nowrap">{row.slaDate}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      className: 'whitespace-nowrap',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  const totalCount = queries.length;
  const inReviewCount = queries.filter(q => q.status === 'In Review').length;
  const pendingCount = queries.filter(q => q.status === 'Pending').length;
  const resolvedCount = queries.filter(q => q.status === 'Resolved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          District Queries & Grievance Desk
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Review, investigate, and resolve field queries, merchant disputes, and territorial escalations across {district ? `${district} District` : 'assigned district'}.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Queries</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
              <CircleHelp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{totalCount}</div>
        </div>

        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">In Review</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{inReviewCount}</div>
        </div>

        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Pending</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{pendingCount}</div>
        </div>

        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Resolved</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{resolvedCount}</div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Active Queries & Grievances"
        subtitle="Operational issue tracking, SLA escalations, and merchant inquiries"
        columns={columns}
        data={filteredQueries}
        loading={loading}
        onRefresh={handleRefresh}
        searchPlaceholder="Search by ID, subject, or submitter..."
        filterOptions={filterOptions}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        exportFileName="district_queries.csv"
      />
    </div>
  );
}
