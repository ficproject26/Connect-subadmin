import React, { useState, useEffect } from 'react';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Store, Phone, Mail, Calendar, Hash } from 'lucide-react';

export function PincodeVendorPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [activeItem, setActiveItem] = useState(null);
  const [actionType, setActionType] = useState('approve');
  const [notes, setNotes] = useState('');
  const [txnRef, setTxnRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleProcess = async () => {
    if (!activeItem) return;
    setSubmitting(true);
    try {
      await dataService.processVendorPayment(activeItem.id, {
        action: actionType,
        transactionRef: txnRef,
        notes
      });
      setActiveItem(null);
      setNotes('');
      setTxnRef('');
      loadData();
    } catch (e) {
      alert(e.message || 'Processing failed');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Vendor Details',
      accessor: 'vendorName',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-900/50 shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-xs">{row.vendorName || row.businessName || 'Vendor Merchant'}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{row.businessType || 'Merchant'}</div>
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-500 font-mono">
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
            <div className="flex items-center gap-1 text-slate-300">
              <Phone className="w-3 h-3 shrink-0 text-slate-500" />
              <span className="font-mono">{row.phone}</span>
            </div>
          )}
          {row.email && row.email !== 'Not available' && (
            <div className="flex items-center gap-1 text-slate-400">
              <Mail className="w-3 h-3 shrink-0 text-slate-500" />
              <span className="truncate max-w-[130px]">{row.email}</span>
            </div>
          )}
          {row.bankDetails && row.bankDetails !== 'Not available' && (
            <div className="text-[10px] text-slate-500 font-mono mt-1">{row.bankDetails}</div>
          )}
        </div>
      )
    },
    {
      header: 'Claim Amount',
      accessor: 'amount',
      render: (row) => (
        <div>
          <span className="font-bold text-emerald-400 text-sm">₹{(row.amount || 0).toLocaleString('en-IN')}</span>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {row.invoiceNumber && row.invoiceNumber !== 'Not available' ? row.invoiceNumber : ''}
          </div>
        </div>
      )
    },
    {
      header: 'Date & Status',
      accessor: 'requestDate',
      render: (row) => (
        <div>
          <StatusBadge status={row.status} />
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-mono">
            <Calendar className="w-2.5 h-2.5" />
            {row.requestDate && row.requestDate !== 'Not available' ? row.requestDate : '-'}
          </div>
          {row.paymentDate && (
            <div className="text-[10px] text-blue-400 mt-0.5">Paid: {row.paymentDate}</div>
          )}
          {row.approvedBy && <div className="text-[10px] text-slate-500 mt-0.5">By: {row.approvedBy}</div>}
        </div>
      )
    },
    {
      header: 'Settlement Ref',
      accessor: 'settlementRef',
      render: (row) => (
        <span className={`font-mono text-xs ${row.settlementRef && row.settlementRef !== 'Not available' ? 'text-indigo-300' : 'text-slate-600'}`}>
          {row.settlementRef && row.settlementRef !== 'Not available' ? row.settlementRef : 'Not available'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.status === 'Pending' && (
            <button
              onClick={() => { setActiveItem(row); setActionType('approve'); }}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
            >
              Approve
            </button>
          )}
          {row.status === 'Approved' && (
            <button
              onClick={() => { setActiveItem(row); setActionType('pay'); }}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
            >
              Release Payout
            </button>
          )}
          {row.status === 'Paid' && <span className="text-xs text-slate-500 font-medium">Disbursed</span>}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Vendor Payment Status</h2>
        <p className="text-xs text-slate-400">Review invoice settlements for vendors in your assigned pincode.</p>
      </div>

      <DataTable
        title="Vendor Payment Claims"
        subtitle="Localized merchant payouts"
        columns={columns}
        data={payments}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search vendor name, ID, or invoice..."
        exportFileName="pincode_vendor_payments.csv"
      />

      <Modal
        isOpen={!!activeItem}
        onClose={() => setActiveItem(null)}
        title={actionType === 'approve' ? 'Approve Vendor Payout' : 'Mark Payout as Disbursed'}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs text-slate-400">Vendor</div>
            <div className="font-bold text-white text-sm">{activeItem?.vendorName}</div>
            <div className="text-lg font-black text-emerald-400 mt-1">₹{(activeItem?.amount || 0).toLocaleString('en-IN')}</div>
          </div>

          {actionType === 'pay' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Bank Ref / UTR</label>
              <input
                type="text"
                value={txnRef}
                onChange={(e) => setTxnRef(e.target.value)}
                placeholder="e.g. UTR-99824102941"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Remarks</label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add settlement remarks..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setActiveItem(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs">
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={handleProcess}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
            >
              {submitting ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
