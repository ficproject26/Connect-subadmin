import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import {
  Store,
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  Receipt,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Download,
  Plus,
  Sparkles,
  Phone,
  RefreshCw,
  Building2,
  MapPin,
  Tag,
  FileText
} from 'lucide-react';

const SEED_SUBSCRIPTIONS = [];

export function VendorSubscriptions() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const role = user?.role || 'State Admin';
  const stateName = user?.state || '';
  const districtName = user?.district || '';
  const divisionName = user?.division || '';
  const pincode = user?.pincode || '';

  const [subscriptions, setSubscriptions] = useState(SEED_SUBSCRIPTIONS);
  const [selectedSub, setSelectedSub] = useState(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  const [paymentForm, setPaymentForm] = useState({
    billingMonth: 'October 2026',
    amount: 1999,
    paymentMode: 'UPI (GPay / PhonePe)',
    transactionId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: 'Monthly merchant platform fee received'
  });

  // Location scoping based on logged-in admin role
  const scopedSubscriptions = useMemo(() => {
    return subscriptions.filter(sub => {
      if (role === 'State Admin') return sub.state === stateName;
      if (role === 'District Admin') return sub.state === stateName && sub.district === districtName;
      if (role === 'Divisional Admin') return sub.state === stateName && sub.district === districtName && sub.division === divisionName;
      if (role === 'Pincode Admin') return sub.pincode === pincode;
      return true;
    });
  }, [subscriptions, role, stateName, districtName, divisionName, pincode]);

  // Filtered by status
  const filteredSubscriptions = useMemo(() => {
    if (statusFilter === 'All') return scopedSubscriptions;
    return scopedSubscriptions.filter(s => s.status === statusFilter);
  }, [scopedSubscriptions, statusFilter]);

  // KPI Calculations
  const kpiStats = useMemo(() => {
    const total = scopedSubscriptions.length;
    const active = scopedSubscriptions.filter(s => s.status === 'Active & Paid').length;
    const dueSoon = scopedSubscriptions.filter(s => s.status === 'Due for Renewal').length;
    const totalMonthlyRecurring = scopedSubscriptions.reduce((sum, s) => sum + s.monthlyFee, 0);
    const totalCollectedThisMonth = scopedSubscriptions
      .filter(s => s.status === 'Active & Paid')
      .reduce((sum, s) => sum + s.monthlyFee, 0);

    return {
      total,
      active,
      dueSoon,
      totalMonthlyRecurring,
      totalCollectedThisMonth
    };
  }, [scopedSubscriptions]);

  const handleOpenCollectModal = (sub) => {
    setSelectedSub(sub);
    setPaymentForm({
      billingMonth: sub.status === 'Due for Renewal' ? 'September 2026' : 'October 2026',
      amount: sub.monthlyFee,
      paymentMode: 'UPI (GPay / PhonePe)',
      transactionId: `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: 'Monthly merchant listing fee paid'
    });
    setShowCollectModal(true);
  };

  const handleRecordPaymentSubmit = (e) => {
    e.preventDefault();
    if (!selectedSub) return;

    const newInvoiceNo = `INV-SUB-2026-${String(Math.floor(100 + Math.random() * 900))}`;

    setSubscriptions(prev =>
      prev.map(s => {
        if (s.id === selectedSub.id) {
          return {
            ...s,
            status: 'Active & Paid',
            lastPaymentDate: paymentForm.paymentDate,
            lastPaymentMode: paymentForm.paymentMode,
            lastTransactionId: paymentForm.transactionId,
            nextDueDate: '2026-10-15',
            daysRemaining: 30,
            invoiceNumber: newInvoiceNo
          };
        }
        return s;
      })
    );

    setShowCollectModal(false);
  };

  const handlePlanChange = (newPlan, newFee) => {
    if (!selectedSub) return;
    setSubscriptions(prev =>
      prev.map(s => {
        if (s.id === selectedSub.id) {
          return {
            ...s,
            planName: newPlan,
            planTier: newPlan.split(' ')[0],
            monthlyFee: newFee
          };
        }
        return s;
      })
    );
    setShowPlanChangeModal(false);
  };

  // Header Title and Subtitle following the KYC model
  const getHeaderInfo = () => {
    if (role === 'State Admin') {
      return {
        title: 'State Vendor Subscription Network',
        subtitle: `Monthly merchant recurring platform subscription and renewal revenue monitoring across ${stateName}.`
      };
    }
    if (role === 'District Admin') {
      return {
        title: 'District Vendor Subscription Desk',
        subtitle: `Monthly merchant recurring platform subscription and renewal revenue monitoring across ${districtName} District.`
      };
    }
    if (role === 'Divisional Admin') {
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

  const columns = useMemo(() => {
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
                {row.owner} &bull; {row.phone}
              </div>
              <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{row.category}</span>
            </div>
          </div>
        )
      }
    ];

    if (role === 'State Admin') {
      cols.push(
        {
          header: 'District',
          accessor: 'district',
          className: 'min-w-[110px]',
          render: (row) => <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{row.district}</span>
        },
        {
          header: 'Division',
          accessor: 'division',
          className: 'min-w-[120px]',
          render: (row) => <span className="text-xs text-slate-600 dark:text-slate-400">{row.division}</span>
        },
        {
          header: 'Pincode',
          accessor: 'pincode',
          className: 'min-w-[90px]',
          render: (row) => (
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{row.pincode}</span>
          )
        }
      );
    } else if (role === 'District Admin') {
      cols.push(
        {
          header: 'Division',
          accessor: 'division',
          className: 'min-w-[120px]',
          render: (row) => <span className="text-xs text-slate-600 dark:text-slate-400">{row.division}</span>
        },
        {
          header: 'Pincode',
          accessor: 'pincode',
          className: 'min-w-[90px]',
          render: (row) => (
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{row.pincode}</span>
          )
        }
      );
    } else if (role === 'Divisional Admin') {
      cols.push(
        {
          header: 'Pincode',
          accessor: 'pincode',
          className: 'min-w-[90px]',
          render: (row) => (
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{row.pincode}</span>
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
              {row.planName}
            </span>
            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{row.monthlyFee.toLocaleString()} <span className="text-[10px] font-medium text-slate-500">/ month</span>
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
            <div className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.billingCycle}</div>
            <div className={`text-[11px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'} mt-0.5`}>
              Inv: {row.invoiceNumber}
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
            <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.lastPaymentDate}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{row.lastPaymentMode}</div>
            <div className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]">{row.lastTransactionId}</div>
          </div>
        )
      },
      {
        header: 'Next Due Date',
        accessor: 'nextDueDate',
        className: 'min-w-[140px]',
        render: (row) => {
          const isDue = row.status === 'Due for Renewal';
          return (
            <div>
              <div className={`text-xs font-bold ${isDue ? 'text-rose-600 dark:text-rose-400' : isDark ? 'text-white' : 'text-slate-900'}`}>
                {row.nextDueDate}
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                isDue
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <Clock className="w-3 h-3" />
                {isDue ? 'Due in 4 Days' : `${row.daysRemaining} days left`}
              </span>
            </div>
          );
        }
      },
      {
        header: 'Status',
        accessor: 'status',
        className: 'min-w-[130px]',
        render: (row) => {
          const isPaid = row.status === 'Active & Paid';
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isPaid
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{headerInfo.title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {headerInfo.subtitle}
        </p>
      </div>

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
            {kpiStats.total}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Active merchant stores
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active & Paid</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {kpiStats.active}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Valid monthly clearance
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Due for Renewal</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1.5">
            {kpiStats.dueSoon}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Renewal notice sent
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Monthly Revenue</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
            ₹{kpiStats.totalMonthlyRecurring.toLocaleString()}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
            Recurring platform fees
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Vendor Monthly Subscriptions"
        subtitle={`Showing ${filteredSubscriptions.length} merchant subscription plans and renewal cycles`}
        columns={columns}
        data={filteredSubscriptions}
        searchPlaceholder="Search vendor name, ID, phone, plan..."
        filterOptions={[
          { label: 'All Statuses', value: 'All' },
          { label: 'Active & Paid', value: 'Active & Paid' },
          { label: 'Due for Renewal', value: 'Due for Renewal' }
        ]}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        exportFileName="vendor_subscriptions.csv"
        containerClassName="overflow-x-auto lg:overflow-x-visible scrollbar-none"
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
                Plan: <strong className="text-indigo-600 dark:text-indigo-400">{selectedSub.planName}</strong> (₹{selectedSub.monthlyFee}/month)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Billing Cycle Month
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
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
              >
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
              <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-500">Invoice Number:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedSub.invoiceNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Merchant Store:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedSub.vendorName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Owner Contact:</span>
                <span>{selectedSub.owner} ({selectedSub.phone})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Plan Tier:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedSub.planName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-extrabold text-emerald-600 text-sm">₹{selectedSub.monthlyFee.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Next Renewal Due Date:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedSub.nextDueDate}</span>
              </div>
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
