import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { Store } from 'lucide-react';

export function DistrictVendorPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getVendorPayments();
      if (res.success) setPayments(res.payments);
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
      header: 'Vendor Details',
      accessor: 'vendorName',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-xs">{row.vendorName}</div>
            <div className="text-[11px] text-slate-500 font-mono">Invoice: {row.invoiceNumber}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Payout Amount',
      accessor: 'amount',
      render: (row) => <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">₹{row.amount?.toLocaleString()}</span>
    },
    {
      header: 'Pincode Zone',
      accessor: 'pincode',
      render: (row) => (
        <span className="font-mono text-blue-600 dark:text-cyan-400 text-xs font-bold">
          PIN: {row.pincode}
        </span>
      )
    },
    {
      header: 'Request Date',
      accessor: 'requestDate',
      render: (row) => <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">{row.requestDate}</span>
    },
    {
      header: 'Payment Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Disbursement Ref',
      accessor: 'transactionRef',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
          {row.transactionRef || 'Under Settlement'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">District Vendor Payments</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Settlement requests, store disbursement claims, and invoicing in {user?.district ? `${user.district} District` : 'assigned district'}.
        </p>
      </div>

      <DataTable
        title="Vendor Payment Ledger"
        subtitle="Disbursements within assigned district jurisdiction"
        columns={columns}
        data={payments}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search vendor name or invoice..."
        exportFileName="district_vendor_payments.csv"
      />
    </div>
  );
}
