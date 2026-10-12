import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { TerritoryHierarchyFilter } from '../../components/TerritoryHierarchyFilter';
import { AgentApprovalModal } from '../../components/AgentApprovalModal';
import { getTerritoryLocking, safeString, safeLowerCase } from '../../utils/territoryHelper';
import {
  UserPlus,
  UserCheck,
  Building2,
  Layers,
  MapPin,
  Award,
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
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Home
} from 'lucide-react';

export function AgentRequestsPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Role-based territory locking
  const locking = useMemo(() => getTerritoryLocking(user), [user]);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [territoryTree, setTerritoryTree] = useState([]);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Pending' | 'Approved' | 'Rejected'
  const [selectedRoleLevel, setSelectedRoleLevel] = useState('All'); // 'All' | 'state' | 'district' | 'divisional' | 'pincode'

  const [selectedFilterState, setSelectedFilterState] = useState(locking.defaultState || '');
  const [selectedFilterDistrict, setSelectedFilterDistrict] = useState(locking.defaultDistrict || '');
  const [selectedFilterDivision, setSelectedFilterDivision] = useState(locking.defaultDivision || '');
  const [selectedFilterPincode, setSelectedFilterPincode] = useState(locking.defaultPincode || '');

  // Modal states
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [quickRejectTarget, setQuickRejectTarget] = useState(null);
  const [quickRejectReason, setQuickRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Sync locked territory
  useEffect(() => {
    if (locking.stateLocked && locking.defaultState) setSelectedFilterState(locking.defaultState);
    if (locking.districtLocked && locking.defaultDistrict) setSelectedFilterDistrict(locking.defaultDistrict);
    if (locking.divisionLocked && locking.defaultDivision) setSelectedFilterDivision(locking.defaultDivision);
    if (locking.pincodeLocked && locking.defaultPincode) setSelectedFilterPincode(locking.defaultPincode);
  }, [locking]);

  // Load territory tree
  useEffect(() => {
    dataService.getTerritoryHierarchy().then(res => {
      if (res?.success && Array.isArray(res.hierarchy)) {
        setTerritoryTree(res.hierarchy);
      }
    }).catch(console.error);
  }, []);

  // Fetch real agent requests
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      const reqState = locking.stateLocked ? locking.defaultState : selectedFilterState;
      const reqDistrict = locking.districtLocked ? locking.defaultDistrict : selectedFilterDistrict;
      const reqDivision = locking.divisionLocked ? locking.defaultDivision : selectedFilterDivision;
      const reqPincode = locking.pincodeLocked ? locking.defaultPincode : selectedFilterPincode;

      if (reqState) params.state = reqState;
      if (reqDistrict) params.district = reqDistrict;
      if (reqDivision) params.division = reqDivision;
      if (reqPincode) params.pincode = reqPincode;

      const res = await dataService.getAgentRequests(params);
      if (res && res.success) {
        const list = res.requests || res.agents || [];
        setRequests(list);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error('Failed to load agent requests:', err);
      setError(err.message || 'Failed to load agent requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [locking, selectedFilterState, selectedFilterDistrict, selectedFilterDivision, selectedFilterPincode]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Handle Quick Approve
  const handleQuickApprove = async (ag) => {
    if (!window.confirm(`Are you sure you want to approve registration for "${ag.name}"? This will forward their profile to the KYC team review queue.`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await dataService.approveAgent(ag.id || ag._id);
      if (res.success) {
        await loadRequests();
      } else {
        alert(res.message || 'Failed to approve agent request');
      }
    } catch (err) {
      alert(err.message || 'Error occurred while approving agent request');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Quick Reject Submit
  const handleQuickRejectSubmit = async () => {
    if (!quickRejectTarget) return;
    if (!quickRejectReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await dataService.rejectAgent(quickRejectTarget.id || quickRejectTarget._id, {
        reason: quickRejectReason.trim()
      });
      if (res.success) {
        setQuickRejectTarget(null);
        setQuickRejectReason('');
        await loadRequests();
      } else {
        alert(res.message || 'Failed to reject agent request');
      }
    } catch (err) {
      alert(err.message || 'Error occurred while rejecting agent request');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter requests by status & role level
  const filteredRequests = useMemo(() => {
    return requests.filter(item => {
      // Status filter
      if (statusFilter !== 'All') {
        const s = (item.status || 'pending').toLowerCase();
        if (statusFilter === 'Pending') {
          if (s !== 'pending' && s !== 'under_review' && s !== 'pending_admin_approval') return false;
        } else if (statusFilter === 'Approved') {
          if (s !== 'approved' && s !== 'active' && s !== 'pending_kyc') return false;
        } else if (statusFilter === 'Rejected') {
          if (s !== 'rejected') return false;
        }
      }

      // Role level filter
      if (selectedRoleLevel !== 'All') {
        const r = (item.role || item.level || '').toLowerCase();
        if (selectedRoleLevel === 'state' && !r.includes('state')) return false;
        if (selectedRoleLevel === 'district' && !r.includes('district')) return false;
        if (selectedRoleLevel === 'divisional' && (!r.includes('division') && !r.includes('divisional'))) return false;
        if (selectedRoleLevel === 'pincode' && !r.includes('pincode')) return false;
      }

      // Territory drill-down
      const terr = item.territory || {};
      const st = terr.state || item.state;
      const dt = terr.district || item.district;
      const dv = terr.division || item.division;
      const pin = terr.pincode || item.pincode;

      if (selectedFilterState && st && safeLowerCase(st) !== safeLowerCase(selectedFilterState)) return false;
      if (selectedFilterDistrict && dt && safeLowerCase(dt) !== safeLowerCase(selectedFilterDistrict)) return false;
      if (selectedFilterDivision && dv && safeLowerCase(dv) !== safeLowerCase(selectedFilterDivision)) return false;
      if (selectedFilterPincode && pin && String(pin).trim() !== String(selectedFilterPincode).trim()) return false;

      return true;
    });
  }, [requests, statusFilter, selectedRoleLevel, selectedFilterState, selectedFilterDistrict, selectedFilterDivision, selectedFilterPincode]);

  // Level Badge Helper
  const getLevelBadge = (roleStr) => {
    const r = (roleStr || '').toLowerCase();
    if (r.includes('state')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
          <Award className="w-3 h-3" /> State Agent
        </span>
      );
    }
    if (r.includes('district')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
          <Building2 className="w-3 h-3" /> District Agent
        </span>
      );
    }
    if (r.includes('division') || r.includes('divisional')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
          <Layers className="w-3 h-3" /> Divisional Agent
        </span>
      );
    }
    if (r.includes('pincode')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
          <MapPin className="w-3 h-3" /> Pincode Agent
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
        <UserPlus className="w-3 h-3" /> Agent
      </span>
    );
  };

  // Workflow Stage Badge Helper
  const getWorkflowStageBadge = (stage, status) => {
    const s = (status || '').toLowerCase();
    const stg = stage || (s === 'active' || s === 'approved' ? 'Activated' : s === 'rejected' ? 'Territory Rejected' : s === 'pending_kyc' ? 'Awaiting KYC Review' : 'Awaiting Territory Approval');

    if (stg === 'Activated' || s === 'active' || s === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3" /> Activated
        </span>
      );
    }
    if (stg === 'Awaiting KYC Review' || s === 'pending_kyc') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800">
          <ShieldCheck className="w-3 h-3" /> Awaiting KYC Review
        </span>
      );
    }
    if (stg.includes('Rejected') || s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
          <XCircle className="w-3 h-3" /> {stg}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
        <Clock className="w-3 h-3" /> {stg}
      </span>
    );
  };

  // Required 9 Columns Specification:
  // 1. Serial Number
  // 2. Applicant Name
  // 3. Requested Role Level
  // 4. Territory / Assigned Jurisdiction
  // 5. Address
  // 6. Registration Date
  // 7. Current Approval Status
  // 8. Rejection Reason, when applicable
  // 9. Actions (View must be the last action in the row)
  const columns = [
    {
      header: 'S.No',
      key: 'serialNumber',
      render: (_, index) => (
        <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
          {index + 1}
        </span>
      )
    },
    {
      header: 'Applicant Name',
      key: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-[160px]">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 font-bold text-xs border border-slate-200 dark:border-slate-700">
            {row.name ? row.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-xs">{row.name || row.applicantName || 'Unnamed Agent'}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Phone className="w-2.5 h-2.5" /> {row.phone || row.mobile || '-'}
            </div>
            {row.email && (
              <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[140px]" title={row.email}>
                {row.email}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      header: 'Requested Role Level',
      key: 'role',
      render: (row) => getLevelBadge(row.roleTitle || row.role || row.level)
    },
    {
      header: 'Territory / Jurisdiction',
      key: 'jurisdiction',
      render: (row) => {
        const terr = row.territory || {};
        const terrSummary = [terr.pincode || row.pincode, terr.division || row.division, terr.district || row.district, terr.state || row.state].filter(Boolean).join(', ');
        return (
          <div className="text-xs space-y-0.5 min-w-[140px]">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {row.jurisdiction || row.assignedArea || terr.district || 'Tamil Nadu'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]" title={terrSummary}>
              {terrSummary || '-'}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Address',
      key: 'address',
      render: (row) => {
        const fullAddr = row.address || row.assignedArea || 'Not provided';
        return (
          <div className="text-xs text-slate-600 dark:text-slate-300 max-w-[180px] truncate" title={fullAddr}>
            {fullAddr}
          </div>
        );
      }
    },
    {
      header: 'Registration Date',
      key: 'createdAt',
      render: (row) => {
        const dateStr = row.registrationDate || (row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : 'Recent');
        return (
          <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{dateStr}</span>
          </div>
        );
      }
    },
    {
      header: 'Current Approval Status',
      key: 'status',
      render: (row) => {
        const s = (row.status || 'pending').toLowerCase();
        let statusBadgeText = 'Pending';
        let statusVariant = 'warning';

        if (s === 'active' || s === 'approved') {
          statusBadgeText = 'Approved';
          statusVariant = 'success';
        } else if (s === 'rejected') {
          statusBadgeText = 'Rejected';
          statusVariant = 'danger';
        } else if (s === 'pending_kyc') {
          statusBadgeText = 'Approved';
          statusVariant = 'info';
        }

        return (
          <div className="space-y-1">
            <StatusBadge status={statusBadgeText} variant={statusVariant} size="sm" />
            <div>{getWorkflowStageBadge(row.workflowStage, row.status)}</div>
          </div>
        );
      }
    },
    {
      header: 'Rejection Reason',
      key: 'rejectionReason',
      render: (row) => {
        if (!row.rejectionReason) {
          return <span className="text-xs text-slate-400 italic">—</span>;
        }
        return (
          <div className="text-xs text-red-600 dark:text-red-400 max-w-[160px] truncate font-medium" title={row.rejectionReason}>
            {row.rejectionReason}
          </div>
        );
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        const isPending = row.status === 'under_review' || row.status === 'pending' || row.status === 'pending_admin_approval';
        const canApprove = row.canApprove !== false;

        return (
          <div className="flex items-center gap-1.5 justify-end">
            {/* Quick Approve / Reject buttons if user is the authorized approver */}
            {isPending && canApprove && (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickApprove(row)}
                  disabled={actionLoading}
                  className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                  title="Approve Request"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickRejectTarget(row);
                    setQuickRejectReason('');
                  }}
                  disabled={actionLoading}
                  className="p-1.5 rounded-lg text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 transition cursor-pointer"
                  title="Reject Request"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {/* The final VIEW button must be the LAST action in the row */}
            <button
              type="button"
              onClick={() => setSelectedAgent(row)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800 transition flex items-center gap-1 cursor-pointer shrink-0"
              title="View full registration details and submitted documents"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Agent Registration Requests</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Territory-based approval workflow for independent field agent applications
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRequests}
            disabled={loading}
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Territory Filter */}
      <TerritoryHierarchyFilter
        selectedState={selectedFilterState}
        onStateChange={(st) => setSelectedFilterState(st)}
        selectedDistrict={selectedFilterDistrict}
        onDistrictChange={(dt) => setSelectedFilterDistrict(dt)}
        selectedDivision={selectedFilterDivision}
        onDivisionChange={(dv) => setSelectedFilterDivision(dv)}
        selectedPincode={selectedFilterPincode}
        onPincodeChange={(pin) => setSelectedFilterPincode(pin)}
        onClear={() => {
          if (!locking.stateLocked) setSelectedFilterState('');
          if (!locking.districtLocked) setSelectedFilterDistrict('');
          if (!locking.divisionLocked) setSelectedFilterDivision('');
          if (!locking.pincodeLocked) setSelectedFilterPincode('');
        }}
        territoryTree={territoryTree}
      />

      {/* Filter Tabs Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === status
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Role Level Filters */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Level:</span>
          {[
            { id: 'All', label: 'All Levels' },
            { id: 'state', label: 'State' },
            { id: 'district', label: 'District' },
            { id: 'divisional', label: 'Division' },
            { id: 'pincode', label: 'Pincode' }
          ].map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              onClick={() => setSelectedRoleLevel(lvl.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                selectedRoleLevel === lvl.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              {lvl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Request Table */}
      <DataTable
        title="Agent Onboarding Requests"
        subtitle="Review, approve, or reject field agent registrations in accordance with territorial governance rules"
        columns={columns}
        data={filteredRequests}
        loading={loading}
        onRefresh={loadRequests}
        searchPlaceholder="Search requests by applicant name, phone, or territory..."
        exportFileName="agent_requests.csv"
        emptyMessage="No agent onboarding requests found for the selected criteria."
      />

      {/* Quick Reject Prompt Modal */}
      {quickRejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Reject Agent Registration</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Please enter the mandatory reason for rejecting registration for <strong>{quickRejectTarget.name}</strong>:
            </p>
            <textarea
              value={quickRejectReason}
              onChange={(e) => setQuickRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Incomplete address verification, mismatch in territorial jurisdiction, blurry document copies..."
              className="w-full text-xs p-3 rounded-xl border border-red-200 dark:border-red-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickRejectTarget(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickRejectSubmit}
                disabled={actionLoading || !quickRejectReason.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Verification Modal (View Button) */}
      <AgentApprovalModal
        isOpen={Boolean(selectedAgent)}
        onClose={() => setSelectedAgent(null)}
        agent={selectedAgent}
        onAgentUpdated={loadRequests}
      />
    </div>
  );
}

export default AgentRequestsPage;
