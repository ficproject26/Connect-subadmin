import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { dataService } from '../../services/dataService';
import {
  Store,
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  Receipt,
  ShieldCheck,
  AlertCircle,
  Plus,
  Sparkles,
  RefreshCw,
  MapPin,
  Loader2
} from 'lucide-react';

export function VendorSubscriptions() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const role = user?.role || '';
  const stateName = user?.state || '';
  const districtName = user?.district || '';
  const divisionName = user?.division || '';
  const pincode = user?.pincode || '';

  const [subscriptions, setSubscriptions] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, dueSoon: 0, totalMonthlyRecurring: 0, totalCollectedThisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  const [paymentForm, setPaymentForm] = useState({
    billingMonth: '',
    amount: 1000,
    paymentMode: 'UPI (GPay / PhonePe)',
    transactionId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: 'Monthly merchant platform fee received'
  });

  // ── Fetch real data from backend ──────────────────────────────────────────
  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter && statusFilter !== 'All') params.status = statusFilter;
      const res = await dataService.getVendorSubscriptions(params);
      if (res && res.success) {
        setSubscriptions(res.subscriptions || []);
        setSummary(res.summary || { total: 0, active: 0, dueSoon: 0, totalMonthlyRecurring: 0, totalCollectedThisMonth: 0 });
      } else {
        setError(res?.message || 'Failed to load subscriptions');
        setSubscriptions([]);
      }
    } catch (err) {
      setError(err?.message || 'Network error');
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleOpenCollectModal = (sub) => {
    setSelectedSub(sub);
    setPaymentForm({
      billingMonth: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
      amount: sub.monthlyFee || sub.amount || 1000,
      paymentMode: 'UPI (GPay / PhonePe)',
      transactionId: `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: 'Monthly merchant listing fee paid'
    });
    setShowCollectModal(true);
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSub) return;
    setSubmitting(true);
    try {
      const res = await dataService.recordVendorSubscriptionPayment(selectedSub.id, {
        amount: paymentForm.amount,
        paymentMode: paymentForm.paymentMode,
        transactionId: paymentForm.transactionId,
        paymentDate: paymentForm.paymentDate,
        notes: paymentForm.notes
      });
      if (res && res.success) {
        setShowCollectModal(false);
        fetchSubscriptions();
      } else {
        alert(res?.message || 'Failed to record payment');
      }
    } catch (err) {
      alert(err?.message || 'Network error while recording payment');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Header title + subtitle ───────────────────────────────────────────────
  const getHeaderInfo = () => {
    const normRole = (role || '').toLowerCase();
    if (normRole.includes('super') || normRole === 'admin') {
      return {
        title: 'Global Vendor Subscriptions',
        subtitle: 'Monthly merchant recurring platform subscription and renewal revenue monitoring across all territories.'
      };
    }
    if (normRole.includes('state')) {
      return {
        title: 'State Vendor Subscription Network',
        subtitle: `Monthly merchant recurring platform subscription and renewal revenue monitoring across ${stateName}.`
      };
    }
    if (normRole.includes('district')) {
      return {
        title: 'District Vendor Subscription Desk',
        subtitle: `Monthly merchant recurring platform subscription and renewal revenue monitoring across ${districtName} District.`
      };
    }
    if (normRole.includes('divis')) {
      return {
        title: 'Divisional Vendor Subscription Desk',
        subtitle: `Monthly merchant recurring platform subscription and renewal revenue monitoring across ${divisionName} Division.`
      };
    }
    return {
      title: 'Pincode Vendor Subscriptions',
      subtitle: `Monthly recurring merchant platform fee, renewal billing cycles, and payment receipt tracking for PIN: ${pincode}.`
    };
  };

  const headerInfo = getHeaderInfo();

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = useMemo(() => {
    const normRole = (role || '').toLowerCase();
    const isSuper = normRole.includes('super') || normRole === 'admin';
    const isState = normRole.includes('state');
    const isDistrict = normRole.includes('district');
    const isDivisional = normRole.includes('divis');

    const cols = [
      {
        header: 'Vendor Business',
        accessor: 'vendorName',
        className: 'min-w-[220px]',
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700/40 text-amber-600 dark:text-amber-400 shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.vendorName}</div>
              <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {row.owner} {row.phone ? `• ${row.phone}` : ''}
              </div>
              <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{row.businessType || row.category}</span>
            </div>
          </div>
        )
      }
    ];

    // Show location columns based on role
    if (isSuper || isState) {
      cols.push(
        {
          header: 'District',
          accessor: 'district',
          className: 'min-w-[110px]',
          render: (row) => <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{row.district || '–'}</span>
        },
        {
          header: 'Division',
          accessor: 'division',
          className: 'min-w-[120px]',
          render: (row) => <span className="text-xs text-slate-600 dark:text-slate-400">{row.division || '–'}</span>
        },
        {
          header: 'Pincode',
          accessor: 'pincode',
          className: 'min-w-[90px]',
          render: (row) => (
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{row.pincode || '–'}</span>
          )
        }
      );
    } else if (isDistrict) {
      cols.push(
        {
          header: 'Division',
          accessor: 'division',
          className: 'min-w-[120px]',
          render: (row) => <span className="text-xs text-slate-600 dark:text-slate-400">{row.division || '–'}</span>
        },
        {
          header: 'Pincode',
          accessor: 'pincode',
          className: 'min-w-[90px]',
          render: (row) => (
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{row.pincode || '–'}</span>
          )
        }
      );
    } else if (isDivisional) {
      cols.push(
        {
          header: 'Pincode',
          accessor: 'pincode',
          className: 'min-w-[90px]',
          render: (row) => (
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{row.pincode || '–'}</span>
          )
        }
      );
    }

    cols.push(
      {
        header: 'Monthly Plan & Fee',
        accessor: 'monthlyFee',
        className: 'min-w-[180px]',
        render: (row) => (
          <div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              row.planTier === 'Enterprise'
                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                : row.planTier === 'Growth'
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              <Sparkles className="w-3 h-3" />
              {row.planName || `${row.businessType} Monthly`}
            </span>
            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{(row.monthlyFee || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-500">/ month</span>
            </div>
          </div>
        )
      },
      {
        header: 'Billing Cycle',
        accessor: 'billingCycle',
        className: 'min-w-[150px]',
        render: (row) => (
          <div>
            <div className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.billingCycle || 'Monthly'}</div>
            <div className={`text-[11px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'} mt-0.5`}>
              {row.invoiceNumber ? `Inv: ${row.invoiceNumber}` : ''}
            </div>
          </div>
        )
      },
      {
        header: 'Last Payment',
        accessor: 'lastPaymentDate',
        className: 'min-w-[140px]',
        render: (row) => (
          <div>
            <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.lastPaymentDate || '–'}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{row.lastPaymentMode || '–'}</div>
            <div className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]">{row.lastTransactionId || ''}</div>
          </div>
        )
      },
      {
        header: 'Valid Until',
        accessor: 'nextDueDate',
        className: 'min-w-[140px]',
        render: (row) => {
          const isDue = row.status === 'Due for Renewal';
          const isExpired = row.status === 'Expired';
          return (
            <div>
              <div className={`text-xs font-bold ${isExpired ? 'text-rose-700 dark:text-rose-400' : isDue ? 'text-amber-600 dark:text-amber-400' : isDark ? 'text-white' : 'text-slate-900'}`}>
                {row.nextDueDate || '–'}
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                isExpired
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : isDue
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <Clock className="w-3 h-3" />
                {isExpired ? 'Expired' : isDue ? 'Due Soon' : `${row.daysRemaining ?? '–'} days left`}
              </span>
            </div>
          );
        }
      },
      {
        header: 'Approved By',
        accessor: 'approvedBy',
        className: 'min-w-[160px]',
        render: (row) => (
          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {row.approvedBy && row.approvedBy !== 'Not assigned'
              ? <span className="text-indigo-600 dark:text-indigo-400 font-medium">{row.approvedBy}</span>
              : <span className="text-slate-400 italic">Not assigned</span>
            }
          </div>
        )
      },
      {
        header: 'Status',
        accessor: 'status',
        className: 'min-w-[130px]',
        render: (row) => {
          const isPaid = row.status === 'Active & Paid' || row.status === 'Active';
          const isExpired = row.status === 'Expired';
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isPaid
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : isExpired
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : isExpired ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
              {row.status}
            </span>
          );
        }
      },
      {
        header: 'Actions',
        accessor: 'actions',
        className: 'min-w-[160px] text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleOpenCollectModal(row)}
              className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              Record Payment
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedSub(row);
                setShowInvoiceModal(true);
              }}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title="View Invoice Receipt"
            >
              <Receipt className="w-4 h-4" />
            </button>
          </div>
        )
      }
    );

    return cols;
  }, [role, isDark]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{headerInfo.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {headerInfo.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSubscriptions}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Subscriptions</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : summary.total}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Active merchant stores</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active & Paid</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-400" /> : summary.active}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Valid monthly clearance</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Due for Renewal</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1.5">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-amber-400" /> : summary.dueSoon}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">Renewal notice sent</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Monthly Revenue</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-400" /> : `₹${(summary.totalMonthlyRecurring || 0).toLocaleString()}`}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">Recurring platform fees</div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Vendor Monthly Subscriptions"
        subtitle={loading ? 'Loading...' : `Showing ${subscriptions.length} merchant subscription plans and renewal cycles`}
        columns={columns}
        data={subscriptions}
        searchPlaceholder="Search vendor name, ID, phone, plan..."
        filterOptions={[
          { label: 'All Statuses', value: 'All' },
          { label: 'Active & Paid', value: 'Active & Paid' },
          { label: 'Due for Renewal', value: 'Due for Renewal' },
          { label: 'Expired', value: 'Expired' }
        ]}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        exportFileName="vendor_subscriptions.csv"
        containerClassName="overflow-x-auto lg:overflow-x-visible scrollbar-none"
        emptyMessage={
          loading
            ? 'Loading subscription records...'
            : 'No vendor subscription records found in your territory.'
        }
      />

      {/* Record Payment Modal */}
      <Modal
        isOpen={showCollectModal}
        onClose={() => setShowCollectModal(false)}
        title="Record Monthly Vendor Subscription Fee"
      >
        {selectedSub && (
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Store className="w-4 h-4 text-blue-500" />
                <span>{selectedSub.vendorName}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Business: <strong className="text-indigo-600 dark:text-indigo-400">{selectedSub.businessName || selectedSub.businessType}</strong>
              </div>
              {selectedSub.pincode && (
                <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {[selectedSub.district, selectedSub.division, selectedSub.pincode].filter(Boolean).join(' › ')}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Billing Month
                </label>
                <input
                  type="text"
                  value={paymentForm.billingMonth}
                  onChange={(e) => setPaymentForm({ ...paymentForm, billingMonth: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount Received (₹)
                </label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="UPI (GPay / PhonePe)">UPI (GPay / PhonePe)</option>
                  <option value="Bank Transfer (NEFT/IMPS)">Bank Transfer (NEFT/IMPS)</option>
                  <option value="Cash Collection via Field Agent">Cash via Field Agent</option>
                  <option value="Debit / Credit Card">Debit / Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction / UTR ID
                </label>
                <input
                  type="text"
                  required
                  value={paymentForm.transactionId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Date
              </label>
              <input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCollectModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm & Renew Subscription
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Invoice Receipt Modal */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="Vendor Monthly Subscription Invoice Receipt"
      >
        {selectedSub && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              {selectedSub.invoiceNumber && (
                <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-500">Invoice Number:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedSub.invoiceNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Merchant Store:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedSub.vendorName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Business Type:</span>
                <span>{selectedSub.businessType || selectedSub.category}</span>
              </div>
              {selectedSub.owner && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Owner / Contact:</span>
                  <span>{selectedSub.owner} {selectedSub.phone ? `(${selectedSub.phone})` : ''}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {[selectedSub.district, selectedSub.division, selectedSub.pincode].filter(Boolean).join(' › ')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Plan:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedSub.planName || `${selectedSub.businessType} Monthly`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-extrabold text-emerald-600 text-sm">₹{(selectedSub.monthlyFee || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Last Payment:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedSub.lastPaymentDate || '–'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Valid Until:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedSub.nextDueDate || '–'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{selectedSub.lastTransactionId || '–'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Approved By:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">{selectedSub.approvedBy || 'Not assigned'}</span>
              </div>
              {selectedSub.razorpayOrderId && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Razorpay Order:</span>
                  <span className="font-mono text-xs text-slate-500">{selectedSub.razorpayOrderId}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="px-4 py-2 rounded-xl bg-[#001D51] text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
