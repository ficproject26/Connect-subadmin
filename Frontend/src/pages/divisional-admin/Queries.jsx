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

const INITIAL_DIVISIONAL_QUERIES = [];

export function DivisionalQueries() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const division = user?.division || '';

  const [queries] = useState(INITIAL_DIVISIONAL_QUERIES);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  const filterOptions = [
    { label: 'All Queries', value: 'All' },
    { label: 'Pending', value: 'Pending' },
    { label: 'In Review', value: 'In Review' },
    { label: 'Resolved', value: 'Resolved' }
  ];

  const filteredQueries = queries.filter(q => {
    if (statusFilter === 'All') return true;
    return q.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const columns = [
    {
      header: 'Query Ticket',
      accessor: 'id',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
          {row.id}
        </span>
      )
    },
    {
      header: 'Subject & Submitter',
      accessor: 'subject',
      className: 'min-w-[280px]',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white text-xs">
            {row.subject}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <span className="flex items-center gap-1 font-medium">
              <User className="w-3 h-3 text-slate-400" />
              {row.raisedBy} ({row.userRole})
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" />
              {row.division} (PIN: {row.pincode})
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Category',
      accessor: 'category',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
          <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{row.category}</span>
        </div>
      )
    },
    {
      header: 'SLA Target',
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
  const pendingCount = queries.filter(q => q.status === 'Pending').length;
  const inReviewCount = queries.filter(q => q.status === 'In Review').length;
  const resolvedCount = queries.filter(q => q.status === 'Resolved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Divisional Support Queries & Grievances
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Merchant support tickets, agent escalations, and consumer grievance tracking across {division} Division.
        </p>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Tickets</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
              <CircleHelp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{totalCount}</div>
        </div>

        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Pending Review</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{pendingCount}</div>
        </div>

        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">In Investigation</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{inReviewCount}</div>
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
        exportFileName="divisional_queries.csv"
      />
    </div>
  );
}
