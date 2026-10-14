import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { TerritoryHierarchyFilter } from '../../components/TerritoryHierarchyFilter';
import { getTerritoryLocking, safeString, safeLowerCase } from '../../utils/territoryHelper';
import {
  Store,
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Eye,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Filter,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  Tag,
  Share2
} from 'lucide-react';

export function VendorRequestsPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Role-based territory locking
  const locking = useMemo(() => getTerritoryLocking(user), [user]);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [territoryTree, setTerritoryTree] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Pending' | 'Approved' | 'Rejected'
  const [sourceFilter, setSourceFilter] = useState('All'); // 'All' | 'Agent' | 'Manager' | 'Direct Registration'
  const [selectedFilterState, setSelectedFilterState] = useState(locking.defaultState || '');
  const [selectedFilterDistrict, setSelectedFilterDistrict] = useState(locking.defaultDistrict || '');
  const [selectedFilterDivision, setSelectedFilterDivision] = useState(locking.defaultDivision || '');
  const [selectedFilterPincode, setSelectedFilterPincode] = useState(locking.defaultPincode || '');

  // Modal & Action states
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  // Quick Reject / Pending modal states
  const [actionModal, setActionModal] = useState(null); // { type: 'reject'|'pending', request }
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // In-app notification banner
  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // Load Territory Hierarchy
  useEffect(() => {
    let isMounted = true;
    const fetchTree = async () => {
      try {
        const res = await dataService.getTerritoryHierarchy();
        if (isMounted && res && res.success && Array.isArray(res.hierarchy)) {
          setTerritoryTree(res.hierarchy);
        }
      } catch (err) {
        console.warn('Failed to load territory hierarchy:', err);
      }
    };
    fetchTree();
    return () => { isMounted = false; };
  }, []);

  // Fetch Vendor Requests
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (sourceFilter !== 'All') params.source = sourceFilter;
      if (selectedFilterState && selectedFilterState !== 'All') params.state = selectedFilterState;
      if (selectedFilterDistrict && selectedFilterDistrict !== 'All') params.district = selectedFilterDistrict;
      if (selectedFilterDivision && selectedFilterDivision !== 'All') params.division = selectedFilterDivision;
      if (selectedFilterPincode && selectedFilterPincode !== 'All') params.pincode = selectedFilterPincode;

      const res = await dataService.getVendorRequests(params);
      if (res && res.success) {
        setRequests(res.requests || res.data || []);
      } else {
        setError(res?.message || 'Failed to load vendor requests');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error fetching vendor requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, selectedFilterState, selectedFilterDistrict, selectedFilterDivision, selectedFilterPincode]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Direct Approval (no window.confirm, inline spinner)
  const handleDirectApprove = async (reqItem) => {
    if (!reqItem || approvingId) return;
    const reqId = reqItem.id || reqItem._id;
    setApprovingId(reqId);
    try {
      const res = await dataService.pincodeVerifyVendor(reqId, {
        action: 'Accept',
        remarks: 'Direct approval by Pincode Admin'
      });
      if (res && res.success) {
        showNotification('success', `Vendor "${reqItem.businessName || reqItem.vendorName}" approved successfully and forwarded to KYC review queue.`);
        await loadRequests();
      } else {
        showNotification('error', res?.message || 'Approval failed. Please check administrative permissions.');
      }
    } catch (err) {
      showNotification('error', err.message || 'Error executing direct approval.');
    } finally {
      setApprovingId(null);
    }
  };

  // Submit Rejection
  const handleRejectSubmit = async () => {
    if (!actionModal || !actionReason.trim()) {
      showNotification('error', 'Rejection reason is mandatory.');
      return;
    }
    setActionLoading(true);
    try {
      const reqId = actionModal.request.id || actionModal.request._id;
      const res = await dataService.pincodeVerifyVendor(reqId, {
        action: 'Reject',
        rejectionReason: actionReason.trim()
      });
      if (res && res.success) {
        showNotification('success', `Vendor "${actionModal.request.businessName || actionModal.request.vendorName}" has been rejected.`);
        setActionModal(null);
        setActionReason('');
        await loadRequests();
      } else {
        showNotification('error', res?.message || 'Failed to reject request.');
      }
    } catch (err) {
      showNotification('error', err.message || 'Error submitting rejection.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Pending Note
  const handlePendingSubmit = async () => {
    if (!actionModal || !actionReason.trim()) {
      showNotification('error', 'Mandatory note or reason required to keep request pending.');
      return;
    }
    setActionLoading(true);
    try {
      const reqId = actionModal.request.id || actionModal.request._id;
      const res = await dataService.pincodeVerifyVendor(reqId, {
        action: 'Pending',
        pendingReason: actionReason.trim(),
        reason: actionReason.trim()
      });
      if (res && res.success) {
        showNotification('success', `Vendor registration marked as Pending. Note has been logged.`);
        setActionModal(null);
        setActionReason('');
        await loadRequests();
      } else {
        showNotification('error', res?.message || 'Failed to mark request pending.');
      }
    } catch (err) {
      showNotification('error', err.message || 'Error saving pending status.');
    } finally {
      setActionLoading(false);
    }
  };

  // 10 Specified Columns
  const columns = [
    {
      header: 'S.No',
      accessor: (row, idx) => idx + 1,
      className: 'w-12 text-center whitespace-nowrap',
      render: (row, idx) => (
        <span className="font-semibold text-slate-500 dark:text-slate-400 font-mono text-xs">
          {idx + 1}
        </span>
      )
    },
    {
      header: 'Request Date & Time',
      accessor: 'createdAt',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{row.requestDateTime || '—'}</span>
        </div>
      )
    },
    {
      header: 'Vendor Name',
      accessor: 'vendorName',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
            <User className="w-3 h-3 text-indigo-500 shrink-0" />
            <span>{row.vendorName}</span>
          </div>
          {row.phone && (
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
              {row.phone}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Business Name',
      accessor: 'businessName',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span>{row.businessName}</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
            ID: {row.canonicalId}
          </div>
        </div>
      )
    },
    {
      header: 'Category / Type',
      accessor: 'category',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          <Tag className="w-3 h-3 text-indigo-500" />
          {row.category || 'Retail & Services'}
        </span>
      )
    },
    {
      header: 'Registration Source',
      accessor: 'registrationSource',
      className: 'whitespace-nowrap',
      render: (row) => {
        const src = row.registrationSource || 'Direct Registration';
        const isAgent = src === 'Agent';
        const isManager = src === 'Manager';
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isAgent
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                : isManager
                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700'
            }`}>
              <Share2 className="w-2.5 h-2.5" />
              {src}
            </span>
            {isAgent && row.sourceDetails?.agentName && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                by {row.sourceDetails.agentName}
              </span>
            )}
            {isManager && row.sourceDetails?.managerName && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                by {row.sourceDetails.managerName}
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Territory',
      accessor: 'pincode',
      render: (row) => (
        <div className="text-xs whitespace-nowrap space-y-0.5">
          <div className="font-semibold text-slate-900 dark:text-white">
            {row.district || '—'}{row.division ? ` / ${row.division}` : ''}
          </div>
          <div className="font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
            <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>PIN: {row.pincode}</span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500">{row.state}</div>
        </div>
      )
    },
    {
      header: 'Approval Status',
      accessor: 'approvalStatus',
      className: 'whitespace-nowrap',
      render: (row) => {
        const isApproved = String(row.approvalStatus || '').toLowerCase().includes('approved') || String(row.status || '').toLowerCase() === 'active';
        const isRejected = String(row.approvalStatus || '').toLowerCase().includes('rejected');
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
            isApproved
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700'
              : isRejected
              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700'
              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
          }`}>
            {isApproved ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : isRejected ? <XCircle className="w-3 h-3 text-rose-600" /> : <AlertCircle className="w-3 h-3 text-amber-600" />}
            {row.approvalStatus || 'Pending Pincode Approval'}
          </span>
        );
      }
    },
    {
      header: 'Approved By',
      accessor: 'approvedByAdminName',
      className: 'whitespace-nowrap text-xs',
      render: (row) => (
        <div>
          {row.approvedByAdminName ? (
            <div>
              <div className="font-bold text-slate-900 dark:text-white">{row.approvedByAdminName}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.approvedByAdminRole || 'Pincode Admin'}</div>
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 italic">—</span>
          )}
        </div>
      )
    },
    {
      header: 'Reviewer Reason',
      accessor: 'reviewerReason',
      render: (row) => (
        <div className="text-xs max-w-[200px]">
          {row.reviewerReason ? (
            <div>
              <div className="font-medium text-slate-700 dark:text-slate-300 line-clamp-2" title={row.reviewerReason}>
                {row.reviewerReason}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                <span>{row.lastReviewDate}</span>
              </div>
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 italic">—</span>
          )}
        </div>
      )
    },
    {
      header: 'Actions',
      className: 'whitespace-nowrap text-center',
      render: (row) => {
        const isApproved = String(row.approvalStatus || '').toLowerCase().includes('approved');
        const isRejected = String(row.approvalStatus || '').toLowerCase().includes('rejected');
        const isPending = !isApproved && !isRejected;
        const isProcessing = approvingId === (row.id || row._id);

        return (
          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* View Details */}
            <button
              type="button"
              onClick={() => {
                setSelectedRequest(row);
                setShowDetailModal(true);
              }}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="View Complete Request Dossier"
            >
              <Eye className="w-3.5 h-3.5 text-sky-500" />
            </button>

            {/* Actionable buttons ONLY for designated approval authority (Pincode Admin) */}
            {row.canApprove ? (
              isPending ? (
                <>
                  {/* Direct Approve Button (Zero window.confirm) */}
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleDirectApprove(row)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50 shadow-sm"
                    title="Direct Approve Vendor Request"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    <span>Approve</span>
                  </button>

                  {/* Pending Button */}
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      setActionModal({ type: 'pending', request: row });
                      setActionReason('');
                    }}
                    className="p-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                    title="Keep Registration Pending with Reason"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>

                  {/* Reject Button */}
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      setActionModal({ type: 'reject', request: row });
                      setActionReason('');
                    }}
                    className="p-1.5 rounded-lg border border-rose-300 dark:border-rose-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="Reject Registration with Reason"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  {isApproved ? 'Approved' : 'Rejected'}
                </span>
              )
            ) : (
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 italic">
                View Only
              </span>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Store className="w-6 h-6 text-sky-500" />
            Vendor Onboarding Requests
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Consolidated vendor requests from Field Agents, Managers, and Direct Online Registrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRequests}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* In-app Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all shadow-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Territory Hierarchy Filter */}
      <TerritoryHierarchyFilter
        selectedState={selectedFilterState}
        onStateChange={(st) => {
          setSelectedFilterState(st);
          setSelectedFilterDistrict('');
          setSelectedFilterDivision('');
          setSelectedFilterPincode('');
        }}
        selectedDistrict={selectedFilterDistrict}
        onDistrictChange={(dist) => {
          setSelectedFilterDistrict(dist);
          setSelectedFilterDivision('');
          setSelectedFilterPincode('');
        }}
        selectedDivision={selectedFilterDivision}
        onDivisionChange={(div) => {
          setSelectedFilterDivision(div);
          setSelectedFilterPincode('');
        }}
        selectedPincode={selectedFilterPincode}
        onPincodeChange={(pin) => setSelectedFilterPincode(pin)}
        onClear={() => {
          setSelectedFilterState(locking.defaultState || '');
          setSelectedFilterDistrict(locking.defaultDistrict || '');
          setSelectedFilterDivision(locking.defaultDivision || '');
          setSelectedFilterPincode(locking.defaultPincode || '');
        }}
        territoryTree={territoryTree}
        title="Territory Scope Filter"
      />

      {/* Filter Tabs: Status & Registration Source */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        {/* Status Pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Status:</span>
          {['All', 'Pending', 'Approved', 'Rejected'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st} {st === 'All' ? `(${requests.length})` : ''}
            </button>
          ))}
        </div>

        {/* Source Pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Source:</span>
          {[
            { id: 'All', label: 'All Sources' },
            { id: 'Agent', label: 'Agent' },
            { id: 'Manager', label: 'Manager' },
            { id: 'Direct Registration', label: 'Direct Registration' }
          ].map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => setSourceFilter(src.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                sourceFilter === src.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {src.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Vendor Requests DataTable */}
      <DataTable
        title="Consolidated Vendor Requests"
        subtitle="Review, approve, or reject vendor onboarding requests in accordance with territorial governance rules"
        columns={columns}
        data={requests}
        loading={loading}
        error={error}
        onRefresh={loadRequests}
        emptyMessage="No vendor onboarding requests found for the selected criteria."
        onRowClick={(row) => {
          setSelectedRequest(row);
          setShowDetailModal(true);
        }}
        searchPlaceholder="Search vendor, business name, phone, or PIN..."
        exportFileName="vendor_requests.csv"
      />

      {/* Modal: Keep Pending / Rejection Reason Input */}
      {actionModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)' }}>
          <div onClick={() => setActionModal(null)} style={{ position: 'absolute', inset: 0 }} />
          <div style={{
            position: 'relative', width: '100%', maxWidth: 460,
            background: isDark ? '#0f172a' : '#ffffff',
            borderRadius: 20, boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
            padding: 24, zIndex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: actionModal.type === 'reject' ? '#fee2e2' : '#fef3c7',
                color: actionModal.type === 'reject' ? '#dc2626' : '#d97706',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {actionModal.type === 'reject' ? <XCircle size={22} /> : <Clock size={22} />}
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: isDark ? '#ffffff' : '#0f172a', margin: 0 }}>
                  {actionModal.type === 'reject' ? 'Reject Vendor Onboarding' : 'Mark Vendor Registration Pending'}
                </h3>
                <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '2px 0 0' }}>
                  {actionModal.request.businessName || actionModal.request.vendorName} · PIN {actionModal.request.pincode}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: isDark ? '#e2e8f0' : '#334155', marginBottom: 6 }}>
                {actionModal.type === 'reject' ? 'Mandatory Rejection Reason:' : 'Mandatory Pending Reason / Action Required:'}
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={actionModal.type === 'reject' ? 'e.g. Shop documents invalid, business outside authorized jurisdiction...' : 'e.g. Additional business proof requested, contact verification pending...'}
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                  background: isDark ? '#1e293b' : '#f8fafc',
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '0.82rem', resize: 'vertical', outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                  background: 'transparent',
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !actionReason.trim()}
                onClick={actionModal.type === 'reject' ? handleRejectSubmit : handlePendingSubmit}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: actionModal.type === 'reject' ? '#dc2626' : '#d97706',
                  color: '#ffffff', fontSize: '0.82rem', fontWeight: 700,
                  cursor: actionLoading || !actionReason.trim() ? 'not-allowed' : 'pointer',
                  opacity: actionLoading || !actionReason.trim() ? 0.6 : 1
                }}
              >
                {actionLoading ? 'Saving...' : actionModal.type === 'reject' ? 'Confirm Rejection' : 'Confirm Pending'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Vendor Full Dossier View */}
      {showDetailModal && selectedRequest && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)' }}>
          <div onClick={() => setShowDetailModal(false)} style={{ position: 'absolute', inset: 0 }} />
          <div style={{
            position: 'relative', width: '100%', maxWidth: 640, maxHeight: '90vh',
            background: isDark ? '#0f172a' : '#ffffff',
            borderRadius: 20, boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: isDark ? '#ffffff' : '#0f172a', margin: 0 }}>
                  {selectedRequest.businessName}
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
                  Canonical ID: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedRequest.canonicalId}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: isDark ? '#1e293b' : '#f1f5f9', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Overview grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, padding: 16, background: isDark ? '#1e293b' : '#f8fafc', borderRadius: 12 }}>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Vendor Owner</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: isDark ? '#ffffff' : '#0f172a', marginTop: 2 }}>{selectedRequest.vendorName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Category</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0284c7', marginTop: 2 }}>{selectedRequest.category}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Registration Source</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7c3aed', marginTop: 2 }}>{selectedRequest.registrationSource}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Territory</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', marginTop: 2 }}>
                    PIN {selectedRequest.pincode} · {selectedRequest.district}
                  </div>
                </div>
              </div>

              {/* Status and Reviewer Info */}
              <div style={{ padding: 16, background: isDark ? '#1e293b' : '#f8fafc', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Current Approval Status:</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: selectedRequest.approvalStatus?.toLowerCase().includes('approved') ? '#10b981' : '#f59e0b' }}>
                    {selectedRequest.approvalStatus}
                  </span>
                </div>
                {selectedRequest.approvedByAdminName && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Approved By:</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
                      {selectedRequest.approvedByAdminName} ({selectedRequest.approvedByAdminRole || 'Pincode Admin'})
                    </span>
                  </div>
                )}
                {selectedRequest.reviewerReason && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Reviewer Reason / Note:</div>
                    <div style={{ fontSize: '0.82rem', color: isDark ? '#e2e8f0' : '#1e293b', marginTop: 4, padding: '8px 12px', background: isDark ? '#0f172a' : '#ffffff', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                      {selectedRequest.reviewerReason}
                    </div>
                  </div>
                )}
              </div>

              {/* Review History */}
              {selectedRequest.reviewHistory && selectedRequest.reviewHistory.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: isDark ? '#ffffff' : '#0f172a', marginBottom: 8 }}>
                    Decision Audit History
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedRequest.reviewHistory.map((h, hIdx) => (
                      <div key={hIdx} style={{ padding: '8px 12px', background: isDark ? '#1e293b' : '#f8fafc', borderRadius: 8, fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <strong style={{ color: h.action === 'APPROVED' ? '#10b981' : h.action === 'REJECTED' ? '#ef4444' : '#f59e0b' }}>{h.action}</strong>
                          <span style={{ color: '#64748b' }}> by {h.reviewedBy} ({h.reviewerRole})</span>
                          {h.reason && <div style={{ color: isDark ? '#cbd5e1' : '#334155', marginTop: 2 }}>{h.reason}</div>}
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                          {h.timestamp ? new Date(h.timestamp).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#ffffff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
