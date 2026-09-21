import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';

export function DivisionalSupportTeam() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getSupportTeam();
      if (res.success) setTickets(res.tickets);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const columns = [
    {
      header: 'Ticket ID & Subject',
      accessor: 'ticketId',
      render: (row) => (
        <div>
          <div className="font-mono font-bold text-blue-600 dark:text-indigo-300 text-xs">{row.ticketId}</div>
          <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5">{row.subject}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{row.createdAt}</div>
        </div>
      )
    },
    {
      header: 'Requester',
      accessor: 'requesterName',
      render: (row) => <span className="text-slate-900 dark:text-white font-medium text-xs">{row.requesterName}</span>
    },
    {
      header: 'Assigned Agent',
      accessor: 'assignedTo',
      render: (row) => <span className="text-xs text-slate-600 dark:text-slate-300">{row.assignedTo}</span>
    },
    {
      header: 'Priority',
      accessor: 'priority',
      render: (row) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          row.priority === 'High'
            ? 'bg-rose-50 text-rose-700 border border-rose-200'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
        }`}>
          {row.priority}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Division Support Team Queue</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Support desk tickets originating from {user?.division || 'assigned'} Division pincode hubs.
        </p>
      </div>

      <DataTable
        title="Support Tickets Queue"
        subtitle="Manage customer assistance inquiries within division scope"
        columns={columns}
        data={tickets}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search ticket ID or subject..."
        exportFileName="division_support_tickets.csv"
      />
    </div>
  );
}
