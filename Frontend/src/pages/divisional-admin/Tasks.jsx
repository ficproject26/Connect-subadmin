import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { useTheme } from '../../context/ThemeContext';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Building2,
  Tag
} from 'lucide-react';

const INITIAL_DIVISIONAL_TASKS = [];

export function DivisionalTasks() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const division = user?.division || '';

  const [tasks] = useState(INITIAL_DIVISIONAL_TASKS);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  const filterOptions = [
    { label: 'All Tasks', value: 'All' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Pending', value: 'Pending' },
    { label: 'Completed', value: 'Completed' }
  ];

  const filteredTasks = tasks.filter(task => {
    if (statusFilter === 'All') return true;
    return task.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const columns = [
    {
      header: 'Task ID',
      accessor: 'id',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
          {row.id}
        </span>
      )
    },
    {
      header: 'Task Title & Scope',
      accessor: 'title',
      className: 'min-w-[280px]',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white text-xs">
            {row.title}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <span className="flex items-center gap-1 font-medium">
              <Building2 className="w-3 h-3 text-slate-400" />
              {row.division} (PIN: {row.pincode})
            </span>
            <span>•</span>
            <span>Assignee: <strong className="text-slate-700 dark:text-slate-300">{row.assignedTo}</strong></span>
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
      header: 'Due Date',
      accessor: 'dueDate',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-mono whitespace-nowrap">{row.dueDate}</span>
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

  const totalCount = tasks.length;
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
  const pendingCount = tasks.filter(t => t.status === 'Pending').length;
  const completedCount = tasks.filter(t => t.status === 'Completed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Divisional Administrative Tasks
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Operational action queue, compliance deliverables, and territorial workflow tracking across {division} Division.
        </p>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Tasks</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{totalCount}</div>
        </div>

        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">In Progress</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{inProgressCount}</div>
        </div>

        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Pending</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{pendingCount}</div>
        </div>

        <div className="admin-card p-4 bg-white dark:bg-[#131f37] border border-slate-200 dark:border-[#1f3358] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Completed</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{completedCount}</div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Active Divisional Administrative Tasks"
        subtitle="Operational action queue and compliance deliverables"
        columns={columns}
        data={filteredTasks}
        loading={loading}
        onRefresh={handleRefresh}
        searchPlaceholder="Search task, ID, or assignee..."
        filterOptions={filterOptions}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        exportFileName="divisional_tasks.csv"
      />
    </div>
  );
}
