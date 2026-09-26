import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { IndianRupee } from 'lucide-react';

export function PincodePayments() {
  const { user } = useAuth();
  const pincode = user?.pincode || '';
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getPayments();
      if (res.success) {
        // Scoped to this pincode
        const filtered = (res.payments || []).filter(p => !pincode || !p.pincode || p.pincode === pincode);
        setPayments(filtered);
      }
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
      header: 'Transaction ID',
      accessor: 'transactionId',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-blue-600 dark:text-cyan-300 text-xs">{row.transactionId}</span>
          <div className="text-[10px] text-slate-500">{row.date}</div>
        </div>
      )
    },
    {
      header: 'Payee Details',
      accessor: 'agentName',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white text-xs">{row.agentName || row.vendorName || 'Station Payout'}</div>
          <div className="text-[10px] text-slate-500">{row.type || 'Commission'}</div>
        </div>
      )
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (row) => <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">₹{row.amount?.toLocaleString()}</span>
    },
    {
      header: 'Pincode Zone',
      accessor: 'pincode',
      render: (row) => (
        <span className="font-mono text-xs text-blue-600 dark:text-cyan-400 font-bold">
          PIN: {row.pincode || pincode || '-'}
        </span>
      )
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pincode Payments Ledger</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Disbursements, vendor invoices, and agent payouts restricted to PIN {pincode || '-'}.
        </p>
      </div>

      <DataTable
        title="Station Payments Journal"
        subtitle={`Audit transactions mapped exclusively to Pincode ${pincode || '-'}`}
        columns={columns}
        data={payments}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search transaction or payee..."
        exportFileName="pincode_payments.csv"
      />
    </div>
  );
}
