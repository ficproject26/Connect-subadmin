import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { IndianRupee, UserPlus, MapPin } from 'lucide-react';

export function StateAgentPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getAgentPayments();
      if (res.success) setPayments(res.payments || []);
    } catch (e) {
      console.error('Failed to fetch agent payments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const columns = [
    {
      header: 'Agent Details',
      accessor: 'agentName',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-xs">{row.agentName}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Txn: {row.transactionId}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Commission Amount',
      accessor: 'amount',
      render: (row) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
          ₹{row.amount?.toLocaleString()}
        </span>
      )
    },
    {
      header: 'Jurisdiction',
      accessor: 'district',
      render: (row) => (
        <div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {row.district || '-'}{row.division ? ` • ${row.division}` : ''}
          </div>
          {row.pincode && (
            <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> PIN: {row.pincode}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Commission Type',
      accessor: 'type',
      render: (row) => (
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
          {row.type || 'Direct Referral'}
        </span>
      )
    },
    {
      header: 'Payout Date',
      accessor: 'date',
      render: (row) => <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">{row.date}</span>
    },
    {
      header: 'Payment Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">State Agent Payments</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Agent referral commissions, incentive payouts, and payment settlement records across {user?.state || 'Tamil Nadu'}.
        </p>
      </div>

      <DataTable
        title="Statewide Agent Commissions Ledger"
        subtitle="Manage and track agent incentive disbursements across all districts"
        columns={columns}
        data={payments}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search agent or transaction ID..."
        exportFileName="state_agent_payments.csv"
      />
    </div>
  );
}
