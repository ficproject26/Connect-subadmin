import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { Store, Phone, Mail, MapPin, Calendar, Hash } from 'lucide-react';

export function DistrictVendorPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getVendorPayments();
      if (res.success) setPayments(res.payments || res.data || []);
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
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white text-xs">{row.vendorName || row.businessName || 'Vendor Merchant'}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {row.businessName && row.businessName !== row.vendorName ? row.businessName : row.businessType || 'Merchant'}
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 font-mono">
              <Hash className="w-2.5 h-2.5" />
              {row.vendorId || 'N/A'}
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Contact',
      accessor: 'phone',
      render: (row) => (
        <div className="text-[11px] space-y-0.5">
          {row.phone && row.phone !== 'Not available' && (
            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <Phone className="w-3 h-3 shrink-0 text-slate-400" />
              <span className="font-mono">{row.phone}</span>
            </div>
          )}
          {row.email && row.email !== 'Not available' && (
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Mail className="w-3 h-3 shrink-0 text-slate-400" />
              <span className="truncate max-w-[130px]">{row.email}</span>
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Division / Pincode',
      accessor: 'pincode',
      render: (row) => (
        <div className="text-xs">
          <div className="font-semibold text-slate-900 dark:text-white">{row.division || '-'}</div>
          <div className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px] mt-0.5">
            {row.pincode && row.pincode !== 'Not available' ? `PIN: ${row.pincode}` : '-'}
          </div>
          {row.area && <div className="text-[10px] text-slate-400">{row.area}</div>}
        </div>
      )
    },
    {
      header: 'Payout Amount',
      accessor: 'amount',
      render: (row) => (
        <div>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
            ₹{(row.amount || 0).toLocaleString('en-IN')}
          </span>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            {row.invoiceNumber && row.invoiceNumber !== 'Not available' ? row.invoiceNumber : ''}
          </div>
        </div>
      )
    },
    {
      header: 'Request Date',
      accessor: 'requestDate',
      render: (row) => (
        <div className="text-xs">
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-mono">
            <Calendar className="w-3 h-3 text-slate-400" />
            {row.requestDate && row.requestDate !== 'Not available' ? row.requestDate : '-'}
          </div>
          {row.paymentDate && (
            <div className="text-[11px] text-blue-500 dark:text-blue-400 mt-0.5">
              Paid: {row.paymentDate}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Payment Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Settlement Ref',
      accessor: 'settlementRef',
      render: (row) => (
        <span className={`font-mono text-xs ${row.settlementRef && row.settlementRef !== 'Not available' ? 'text-blue-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-600'}`}>
          {row.settlementRef && row.settlementRef !== 'Not available' ? row.settlementRef : 'Not available'}
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
        searchPlaceholder="Search vendor name, ID, or invoice..."
        exportFileName="district_vendor_payments.csv"
      />
    </div>
  );
}
