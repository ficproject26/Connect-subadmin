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
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  UserCheck
} from 'lucide-react';

/**
 * Click-to-copy snippet for transaction IDs and invoice codes
 */
function CopyableId({ id, label = '', isDark = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!id) return <span>–</span>;

  return (
    <span
      onClick={handleCopy}
      title={`Click to copy: ${id}`}
      className={`inline-flex items-center gap-1 font-mono text-[10px] cursor-pointer rounded px-1.5 py-0.5 transition ${
        copied
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
          : isDark
          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      <span className="truncate max-w-[110px] sm:max-w-[130px]">{label || id}</span>
      {copied ? <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" /> : <Copy className="w-2.5 h-2.5 opacity-60 shrink-0" />}
    </span>
  );
}

export function VendorSubscriptions() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const role = user?.role || '';
  const stateName = user?.state || '';
  const districtName = user?.district || '';
  const divisionName = user?.division || '';
  const pincode = user?.pincode || '';

  const [subscriptions, setSubscriptions] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    dueSoon: 0,
    totalMonthlyRecurring: 0,
    totalCollectedThisMonth: 0
  });
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
        setSummary(
          res.summary || {
            total: 0,
            active: 0,
            dueSoon: 0,
            totalMonthlyRecurring: 0,
            totalCollectedThisMonth: 0
          }
        );
      } else {
        setError(res?.message || 'Failed to load subscriptions');
        setSubscriptions([]);
      }
    } catch (err) {
      setError(err?.message || 'Unable to connect to the server. Please try again.');
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
        billingMonth: paymentForm.billingMonth,
        notes: paymentForm.notes
      });
      if (res && res.success) {
        setShowCollectModal(false);
        fetchSubscriptions();
      } else {
        alert(res?.message || 'Failed to record payment');
      }
    } catch (err) {
      alert(err?.message || 'Network error recording payment');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Header Title resolver ──────────────────────────────────────────────────
  const headerInfo = useMemo(() => {
    const rawRole = (role || '').toLowerCase();
    if (rawRole.includes('super') || rawRole === 'admin' || rawRole === 'main admin' || rawRole === 'super-admin') {
      return {
        title: 'Global Vendor Subscriptions',
        subtitle: 'Monthly merchant recurring platform subscription and renewal revenue monitoring across all territories.'
      };
    }
    if (rawRole.includes('state')) {
      return {
        title: `${stateName || 'State'} Vendor Subscriptions`,
        subtitle: `Monthly merchant recurring platform subscription monitoring across ${stateName || 'your assigned state'}.`
      };
    }
    if (rawRole.includes('district')) {
      return {
        title: `${districtName || 'District'} Vendor Subscriptions`,
        subtitle: `Monthly merchant recurring platform subscription monitoring across ${districtName || 'your assigned district'}.`
      };
    }
    if (rawRole.includes('division') || rawRole.includes('divisional')) {
      return {
        title: `${divisionName || 'Division'} Vendor Subscriptions`,
        subtitle: `Monthly merchant recurring platform subscription monitoring across ${divisionName || 'your assigned division'}.`
      };
    }
    return {
      title: `${pincode ? `Pincode ${pincode}` : 'Local'} Vendor Subscriptions`,
      subtitle: `Monthly merchant recurring platform subscription monitoring under your jurisdiction.`
    };
  }, [role, stateName, districtName, divisionName, pincode]);

  // ── Table Columns Definition with Controlled Widths ────────────────────────
  const columns = useMemo(() => {
    const rawRole = (role || '').toLowerCase();
    const isSuper = rawRole.includes('super') || rawRole === 'admin' || rawRole === 'main admin' || rawRole === 'super-admin';
    const isState = rawRole.includes('state');
    const isDistrict = rawRole.includes('district');
    const isDivisional = rawRole.includes('division') || rawRole.includes('divisional');

    const cols = [
      {
        header: 'Vendor Business',
        accessor: 'vendorName',
        className: 'w-[230px] min-w-[230px]',
        render: (row) => (
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200/60 dark:border-amber-800/40">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div
                className={`font-bold text-xs truncate max-w-[160px] ${isDark ? 'text-white' : 'text-slate-900'}`}
                title={row.vendorName}
              >
                {row.vendorName}
              </div>
              <div
                className={`text-[11px] truncate max-w-[160px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                title={`${row.owner} ${row.phone ? `• ${row.phone}` : ''}`}
              >
                {row.owner} {row.phone ? `• ${row.phone}` : ''}
              </div>
              <span className="inline-block text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[160px]">
                {row.businessType || row.category}
              </span>
            </div>
          </div>
        )
      }
    ];

    // Territorial location columns
    if (isSuper || isState) {
      cols.push(
        {
          header: 'District',
          accessor: 'district',
          className: 'w-[110px] min-w-[110px] whitespace-nowrap',
          render: (row) => (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {row.district || '–'}
            </span>
          )
        },
        {
          header: 'Division',
          accessor: 'division',
          className: 'w-[110px] min-w-[110px] whitespace-nowrap',
          render: (row) => (
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {row.division || '–'}
            </span>
          )
        },
        {
          header: 'Pincode',
          accessor: 'pincode',
          className: 'w-[95px] min-w-[95px] whitespace-nowrap',
          render: (row) => (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 font-mono text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
              {row.pincode || '–'}
            </span>
          )
        }
      );
    } else if (isDistrict) {
      cols.push(
        {
          header: 'Division',
          accessor: 'division',
          className: 'w-[110px] min-w-[110px] whitespace-nowrap',
          render: (row) => (
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {row.division || '–'}
            </span>
          )
        },
        {
          header: 'Pincode',
          accessor: 'pincode',
          className: 'w-[95px] min-w-[95px] whitespace-nowrap',
          render: (row) => (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 font-mono text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
              {row.pincode || '–'}
            </span>
          )
        }
      );
    } else if (isDivisional) {
      cols.push(
        {
          header: 'Pincode',
          accessor: 'pincode',
          className: 'w-[95px] min-w-[95px] whitespace-nowrap',
          render: (row) => (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 font-mono text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
              {row.pincode || '–'}
            </span>
          )
        }
      );
    }

    cols.push(
      {
        header: 'Monthly Plan & Fee',
        accessor: 'monthlyFee',
        className: 'w-[180px] min-w-[180px]',
        render: (row) => (
          <div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${
              row.planTier === 'Enterprise'
                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
            }`}>
              <Sparkles className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[130px]">{row.planName || `${row.businessType} Monthly`}</span>
            </span>
            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 whitespace-nowrap">
              ₹{(row.monthlyFee || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-500">/ month</span>
            </div>
          </div>
        )
      },
      {
        header: 'Billing Cycle',
        accessor: 'billingCycle',
        className: 'w-[130px] min-w-[130px]',
        render: (row) => (
          <div>
            <div className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {row.billingCycle || 'Monthly'}
            </div>
            {row.invoiceNumber && (
              <div className="mt-0.5">
                <CopyableId id={row.invoiceNumber} label={row.invoiceNumber} isDark={isDark} />
              </div>
            )}
          </div>
        )
      },
      {
        header: 'Last Payment',
        accessor: 'lastPaymentDate',
        className: 'w-[160px] min-w-[160px]',
        render: (row) => (
          <div>
            <div className={`text-xs font-bold whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {row.lastPaymentDate || '–'}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[140px]">
              {row.lastPaymentMode || '–'}
            </div>
            {row.lastTransactionId && (
              <div className="mt-0.5">
                <CopyableId id={row.lastTransactionId} isDark={isDark} />
              </div>
            )}
          </div>
        )
      },
      {
        header: 'Valid Until',
        accessor: 'nextDueDate',
        className: 'w-[140px] min-w-[140px]',
        render: (row) => {
          const isDue = row.status === 'Due for Renewal';
          const isExpired = row.status === 'Expired';
          return (
            <div>
              <div className={`text-xs font-bold whitespace-nowrap ${
                isExpired
                  ? 'text-rose-600 dark:text-rose-400'
                  : isDue
                  ? 'text-amber-600 dark:text-amber-400'
                  : isDark
                  ? 'text-white'
                  : 'text-slate-900'
              }`}>
                {row.nextDueDate || '–'}
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md mt-1 whitespace-nowrap ${
                isExpired
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : isDue
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <Clock className="w-3 h-3 shrink-0" />
                {isExpired ? 'Expired' : isDue ? 'Due Soon' : `${row.daysRemaining ?? '–'} days left`}
              </span>
            </div>
          );
        }
      },
      {
        header: 'Approved By',
        accessor: 'approvedBy',
        className: 'w-[160px] min-w-[160px]',
        render: (row) => (
          <div className="text-xs">
            {row.approvedBy && row.approvedBy !== 'Not assigned' ? (
              <span
                className="text-indigo-600 dark:text-indigo-400 font-medium inline-block truncate max-w-[150px]"
                title={row.approvedBy}
              >
                {row.approvedBy}
              </span>
            ) : (
              <span className="text-slate-400 italic">Not assigned</span>
            )}
          </div>
        )
      },
      {
        header: 'Status',
        accessor: 'status',
        className: 'w-[130px] min-w-[130px]',
        render: (row) => {
          const isPaid = row.status === 'Active & Paid' || row.status === 'Active';
          const isExpired = row.status === 'Expired';
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${
              isPaid
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : isExpired
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isPaid ? 'bg-emerald-500' : isExpired ? 'bg-rose-500' : 'bg-amber-500'
              }`}></span>
              {row.status}
            </span>
          );
        }
      },
      {
        header: 'Actions',
        accessor: 'actions',
        className: 'w-[150px] min-w-[150px] text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
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
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer shrink-0"
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

  // ── Mobile Responsive Card View (Requirement 9 Option B) ──────────────────
  const renderMobileCard = useCallback(({ row, isDark: cardDark }) => {
    const isPaid = row.status === 'Active & Paid' || row.status === 'Active';
    const isExpired = row.status === 'Expired';
    const isDue = row.status === 'Due for Renewal';

    return (
      <div className={`p-4 rounded-2xl border transition-all shadow-xs ${
        cardDark
          ? 'bg-[#15233e] border-[#1f3358]'
          : 'bg-white border-slate-200/90'
      } space-y-3`}>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-800/40">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className={`text-xs font-bold truncate ${cardDark ? 'text-white' : 'text-slate-900'}`}>
                {row.vendorName}
              </h4>
              <p className={`text-[11px] truncate ${cardDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {row.owner} {row.phone ? `• ${row.phone}` : ''}
              </p>
              <span className="inline-block text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                {row.businessType || row.category}
              </span>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 whitespace-nowrap ${
            isPaid
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
              : isExpired
              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPaid ? 'bg-emerald-500' : isExpired ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
            {row.status}
          </span>
        </div>

        {/* 2-Column Key-Value Grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${cardDark ? 'text-slate-400' : 'text-slate-500'}`}>
              District
            </span>
            <div className={`font-semibold ${cardDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {row.district || '–'}
            </div>
          </div>

          <div>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${cardDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Division
            </span>
            <div className={`font-medium ${cardDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {row.division || '–'}
            </div>
          </div>

          <div>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${cardDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Pincode
            </span>
            <div>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300">
                {row.pincode || '–'}
              </span>
            </div>
          </div>

          <div>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${cardDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Monthly Fee
            </span>
            <div className="font-black text-emerald-600 dark:text-emerald-400">
              ₹{(row.monthlyFee || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">/ mo</span>
            </div>
          </div>

          <div>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${cardDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Billing Cycle
            </span>
            <div className={`font-medium ${cardDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {row.billingCycle || 'Monthly'}
            </div>
            {row.invoiceNumber && (
              <div className="mt-0.5">
                <CopyableId id={row.invoiceNumber} label={row.invoiceNumber} isDark={cardDark} />
              </div>
            )}
          </div>

          <div>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${cardDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Valid Until
            </span>
            <div className={`font-semibold ${
              isExpired ? 'text-rose-600' : isDue ? 'text-amber-600' : cardDark ? 'text-slate-200' : 'text-slate-800'
            }`}>
              {row.nextDueDate || '–'}
            </div>
            <span className="text-[10px] font-medium text-slate-500">
              {isExpired ? 'Expired' : isDue ? 'Due Soon' : `${row.daysRemaining ?? '–'} days left`}
            </span>
          </div>

          <div className="col-span-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${cardDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Approved By
            </span>
            <div className="text-xs">
              {row.approvedBy && row.approvedBy !== 'Not assigned' ? (
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">{row.approvedBy}</span>
              ) : (
                <span className="text-slate-400 italic">Not assigned</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenCollectModal(row);
            }}
            className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition text-center cursor-pointer"
          >
            Record Payment
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSub(row);
              setShowInvoiceModal(true);
            }}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition cursor-pointer shrink-0 ${
              cardDark
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
            title="View Invoice Receipt"
          >
            <Receipt className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }, [handleOpenCollectModal]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-5 w-full max-w-full min-w-0">
      {/* Page Header (Requirement 4) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
            {headerInfo.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            {headerInfo.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSubscriptions}
          disabled={loading}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all shadow-xs cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={fetchSubscriptions}
            className="underline font-semibold hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Responsive KPI Cards (Requirement 5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Subscriptions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-xs flex flex-col justify-between h-full transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              Total Subscriptions
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : summary.total}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
              Active merchant stores
            </div>
          </div>
        </div>

        {/* Active & Paid */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-xs flex flex-col justify-between h-full transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              Active & Paid
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-400" /> : summary.active}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 truncate">
              Valid monthly clearance
            </div>
          </div>
        </div>

        {/* Due for Renewal */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-xs flex flex-col justify-between h-full transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              Due for Renewal
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-amber-400" /> : summary.dueSoon}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 truncate">
              Renewal notice sent
            </div>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-xs flex flex-col justify-between h-full transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              Monthly Revenue
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight truncate">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-indigo-400" /> : `₹${(summary.totalMonthlyRecurring || 0).toLocaleString()}`}
            </div>
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5 truncate">
              Recurring platform fees
            </div>
          </div>
        </div>
      </div>

      {/* Main Responsive Data Table & Mobile Cards (Requirements 6, 7, 8, 9, 10, 11) */}
      <DataTable
        title="Vendor Monthly Subscriptions"
        subtitle={loading ? 'Loading live subscription records...' : `Showing ${subscriptions.length} merchant subscription plans and renewal cycles`}
        columns={columns}
        data={subscriptions}
        searchPlaceholder="Search vendor name, ID, phone..."
        filterOptions={[
          { label: 'All Statuses', value: 'All' },
          { label: 'Active & Paid', value: 'Active & Paid' },
          { label: 'Due for Renewal', value: 'Due for Renewal' },
          { label: 'Expired', value: 'Expired' }
        ]}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        exportFileName="vendor_subscriptions.csv"
        renderCard={renderMobileCard}
        containerClassName="scrollbar-thin"
        emptyMessage={
          loading
            ? 'Loading subscription records...'
            : 'No vendor subscription records found in your territory hierarchy.'
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
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="truncate">{selectedSub.vendorName}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Business: <strong className="text-indigo-600 dark:text-indigo-400">{selectedSub.businessName || selectedSub.businessType}</strong>
              </div>
              {selectedSub.pincode && (
                <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{[selectedSub.district, selectedSub.division, selectedSub.pincode].filter(Boolean).join(' › ')}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCollectModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
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
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2.5">
              {selectedSub.invoiceNumber && (
                <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 dark:border-slate-700">
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
                className="px-4 py-2 rounded-xl bg-[#001D51] text-white text-xs font-semibold hover:bg-[#001D51]/90 transition"
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
