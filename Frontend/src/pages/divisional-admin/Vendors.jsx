import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { TerritoryHierarchyFilter } from '../../components/TerritoryHierarchyFilter';
import { RegisterVendorModal } from '../../components/RegisterVendorModal';
import { VendorDetailsModal } from '../../components/VendorDetailsModal';
import { AccountActionModal } from '../../components/AccountActionModal';
import { resolvePincodeHierarchy, resolveVendorAddedBy } from '../../utils/pincodeDirectory';
import { isFullyOnboardedVendor, computeOnboardedVendorKpis } from '../../utils/vendorHelper';
import {
  Store,
  MapPin,
  Star,
  Plus,
  Eye,
  Filter,
  RefreshCw,
  Download,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Clock,
  IndianRupee,
  Phone,
  UserCheck,
  UserX,
  Trash2
} from 'lucide-react';

export function DivisionalVendors() {
  const { user } = useAuth();
  const divisionName = user?.division || '';
  const districtName = user?.district || '';
  const assignedState = user?.state || 'Tamil Nadu';
  const [searchParams] = useSearchParams();
  const pincodeParam = searchParams.get('pincode');

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [territoryTree, setTerritoryTree] = useState([]);

  // Hierarchical Territory Filters (Division Admin: Pincode filter only)
  const [selectedPincode, setSelectedPincode] = useState(pincodeParam || '');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedVendorForDetails, setSelectedVendorForDetails] = useState(null);

  // Account Action State (Suspend / Activate / Delete)
  const [accountActionState, setAccountActionState] = useState({
    isOpen: false,
    actionType: 'suspend', // 'suspend' | 'activate' | 'delete'
    account: null,
    loading: false,
    error: ''
  });

  const handleTriggerAccountAction = (account, actionType) => {
    setAccountActionState({
      isOpen: true,
      actionType,
      account: {
        id: account.id || account._id,
        name: account.name || account.businessName || 'Vendor',
        role: 'vendor',
        status: account.status || 'Active',
        identifier: account.phone || account.email || account.vendorId || account.id
      },
      loading: false,
      error: ''
    });
  };

  const handleConfirmAccountAction = async (payload) => {
    if (!accountActionState.account) return;
    setAccountActionState(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const id = accountActionState.account.id;
      const res = await dataService.updateVendorAccountStatus(id, {
        action: accountActionState.actionType,
        reason: payload.reason || ''
      });
      if (res?.success) {
        setAccountActionState(prev => ({ ...prev, isOpen: false, loading: false, account: null }));
        await loadData();
      } else {
        setAccountActionState(prev => ({ ...prev, loading: false, error: res?.message || 'Failed to update vendor status' }));
      }
    } catch (err) {
      setAccountActionState(prev => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || err.message || 'Error updating vendor status'
      }));
    }
  };

  // Load Territory Tree
  useEffect(() => {
    dataService.getTerritoryHierarchy().then(res => {
      if (res?.success && Array.isArray(res.hierarchy)) {
        setTerritoryTree(res.hierarchy);
      }
    }).catch(console.error);
  }, []);

  const loadData = useCallback(async (overrides = {}) => {
    setLoading(true);
    try {
      const params = { onboardedOnly: true, status: 'all' };
      if (assignedState) params.state = assignedState;
      if (districtName) params.district = districtName;
      if (divisionName) params.division = divisionName;
      const p = overrides.pincode !== undefined ? overrides.pincode : selectedPincode;
      if (p) params.pincode = p;

      const res = await dataService.getVendors(params);
      if (res && res.success) {
        let list = res.vendors || res.data || [];
        // Strict boundary: Never display vendors outside assigned division
        if (divisionName) {
          const divNorm = divisionName.toLowerCase().trim().replace(/\s+division$/i, '');
          list = list.filter(v => (v.division || v.divisionName || '').toLowerCase().trim().replace(/\s+division$/i, '') === divNorm);
        }
        setVendors(list.filter(isFullyOnboardedVendor));
      } else {
        setVendors([]);
      }
    } catch (e) {
      console.error('Failed to load division vendors:', e);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [assignedState, districtName, divisionName, selectedPincode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Territory-scoped vendors based on assigned division and selected pincode filter (strictly fully onboarded)
  const territoryScopedVendors = useMemo(() => {
    return vendors.filter(v => {
      if (!isFullyOnboardedVendor(v)) return false;
      // Must match assigned division
      if (divisionName) {
        const divNorm = divisionName.toLowerCase().trim().replace(/\s+division$/i, '');
        const vDiv = (v.division || v.divisionName || '').toLowerCase().trim().replace(/\s+division$/i, '');
        if (vDiv && vDiv !== divNorm) return false;
      }
      if (selectedPincode) {
        const pinNorm = String(selectedPincode).trim();
        const vPin = String(v.pincode || v.pincodeCode || '').trim();
        if (vPin && vPin !== pinNorm) return false;
      }
      return true;
    });
  }, [vendors, divisionName, selectedPincode]);

  // Compute 4 KPI stats strictly from territory-scoped onboarded dataset
  const kpiStats = useMemo(() => {
    return computeOnboardedVendorKpis(territoryScopedVendors);
  }, [territoryScopedVendors]);

  // Filtered vendors list based on active filters
  const filteredVendors = useMemo(() => {
    return territoryScopedVendors.filter(v => {
      // 1. Status Filter (within onboarded vendors)
      if (statusFilter) {
        const s = (v.status || '').toLowerCase();
        const target = statusFilter.toLowerCase();
        if (target === 'active') {
          if (s !== 'active' || v.isDeleted) return false;
        } else if (target === 'suspended') {
          if (s !== 'suspended' || v.isDeleted) return false;
        } else if (target === 'deleted') {
          if (s !== 'deleted' && !v.isDeleted) return false;
        } else if (target === 'approved') {
          const k = (v.kycStatus || '').toLowerCase();
          if (!k.includes('approved') && k !== 'verified' && s !== 'approved') return false;
        }
      }

      // 2. Vendor Category
      if (categoryFilter) {
        const cat = (v.category || '').toLowerCase();
        const target = categoryFilter.toLowerCase();
        if (target === 'job' || target === 'jobs') {
          if (!cat.includes('job') && !cat.includes('work') && !cat.includes('recruitment')) return false;
        } else if (!cat.includes(target) && !target.includes(cat)) {
          return false;
        }
      }

      // 3. Rating
      if (ratingFilter) {
        const r = Number(v.rating) || 0;
        if (ratingFilter === '4+' && r < 4.0) return false;
        if (ratingFilter === '3+' && (r < 3.0 || r >= 4.0)) return false;
        if (ratingFilter === 'below_3' && r >= 3.0) return false;
      }

      return true;
    });
  }, [territoryScopedVendors, statusFilter, categoryFilter, ratingFilter]);

  const handleVendorCreated = (newVendor) => {
    setVendors(prev => [newVendor, ...prev]);
  };

  const handleVendorUpdated = (updatedVendor) => {
    setVendors(prev => prev.map(v => v.id === updatedVendor.id ? updatedVendor : v));
  };

  const columns = [
    {
      header: 'S.No.',
      accessor: (_, idx) => idx + 1,
      className: 'w-14 text-center whitespace-nowrap',
      render: (_, idx) => (
        <span className="font-semibold text-slate-500 dark:text-slate-400 font-mono text-xs">
          {idx + 1}
        </span>
      )
    },
    {
      header: 'Vendor Business',
      accessor: 'name',
      className: 'w-[20%]',
      render: (row) => (
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700/40 text-amber-600 dark:text-amber-400 shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-900 dark:text-white text-xs truncate" title={row.name}>{row.name}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={`Contact: ${row.contactPerson} • ${row.phone}`}>Contact: {row.contactPerson} • {row.phone}</div>
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">{row.category}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Onboarded By',
      accessor: 'addedBy',
      className: 'w-[21%]',
      render: (row) => {
        const creator = resolveVendorAddedBy(row);
        const isAdmin = creator.role?.toLowerCase().includes('admin');
        const isMgr = creator.role?.toLowerCase().includes('manager');

        return (
          <div className="min-w-0 text-xs space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                isAdmin
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : isMgr
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              }`}>
                {creator.role}
              </span>
            </div>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate" title={creator.name}>
              {creator.name}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
              <Phone className="w-2.5 h-2.5 shrink-0 text-slate-400" />
              <span>{creator.phone}</span>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Location Hierarchy',
      accessor: 'pincode',
      className: 'w-[16%]',
      render: (row) => {
        const resolved = resolvePincodeHierarchy(row.pincode);
        const stateName = row.state || resolved.state;
        const distName = row.district || resolved.district;
        const divName = row.division || resolved.division;
        const pin = row.pincode || resolved.pincode;

        return (
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={`${stateName} > ${distName} > ${divName} > ${pin}`}>
              {distName}, {divName}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              State: {stateName}
            </div>
            <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" /> PIN: {pin}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Rating & Deliveries',
      accessor: 'rating',
      className: 'w-[13%]',
      render: (row) => {
        const isVerified = (row.kycStatus || '').toLowerCase().includes('approved') || (row.kycStatus || '').toLowerCase() === 'verified';
        if (!isVerified) {
          return (
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">—</span>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 italic truncate" title="Awaiting Full KYC Verification">Pending Clearance</div>
            </div>
          );
        }
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400 font-bold text-xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 shrink-0" />
              <span>{row.rating || '5.0'} / 5.0</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{row.totalOrdersDelivered || 0} fulfilled</div>
          </div>
        );
      }
    },
    {
      header: 'KYC & Approval',
      accessor: 'kycStatus',
      className: 'w-[14%]',
      render: (row) => (
        <div className="py-0.5">
          <StatusBadge status={row.kycStatus || 'KYC Approved'} />
        </div>
      )
    },
    {
      header: 'Account Status',
      accessor: 'status',
      className: 'w-[12%]',
      render: (row) => <StatusBadge status={row.status || 'Active'} />
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'w-[18%]',
      render: (row) => {
        const rowStatus = (row.status || 'Active').toLowerCase();
        const isDeleted = rowStatus === 'deleted' || row.isDeleted;
        const isSuspended = rowStatus === 'suspended';

        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedVendorForDetails(row);
              }}
              title="View Vendor Hierarchy & KYC Dossier"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:border-blue-700 transition cursor-pointer inline-flex items-center justify-center"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            {isDeleted ? (
              <span className="inline-flex items-center px-2 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                Deactivated
              </span>
            ) : (
              <>
                {isSuspended ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTriggerAccountAction(row, 'activate');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                    title="Activate Vendor"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Activate</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTriggerAccountAction(row, 'suspend');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition cursor-pointer"
                    title="Suspend Vendor"
                  >
                    <UserX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Suspend</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriggerAccountAction(row, 'delete');
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                  title="Delete Vendor (Soft Delete)"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header with Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Division Vendors Network</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Merchant partners and commercial supply points under {divisionName} division jurisdiction.</p>
        </div>
      </div>

      {/* Territory Hierarchy Filter (Pincode filter only) */}
      <TerritoryHierarchyFilter
        selectedState={assignedState}
        selectedDistrict={districtName}
        selectedDivision={divisionName}
        selectedPincode={selectedPincode}
        onPincodeChange={(pin) => setSelectedPincode(pin)}
        onClear={() => setSelectedPincode('')}
        territoryTree={territoryTree}
        title="Territory Hierarchy Filter"
        showState={false}
        showDistrict={false}
        showDivision={false}
        showPincode={true}
      />

      {/* 4 KPI Cards in a single row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Vendors */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Vendors</span>
            <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{kpiStats.total}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Active in {divisionName}
          </div>
        </div>

        {/* KPI 2: Verified Stores */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">KYC Verified Shops</span>
            <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              ✓
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{kpiStats.verified}</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
            Fully certified partners
          </div>
        </div>

        {/* KPI 2: Active & Operational */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active & Operational</span>
            <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{kpiStats.active}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Fully operational partners
          </div>
        </div>

        {/* KPI 3: Top Rated */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Top Rated (4★+)</span>
            <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.topRated}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            High customer trust
          </div>
        </div>

        {/* KPI 4: Pending Clearance */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending Clearance</span>
            <div className="text-xs font-bold text-purple-600 dark:text-purple-400">₹</div>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            ₹{kpiStats.pendingPayout.toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
            Settlement pipeline
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <DataTable
        title="Division Vendors Roster"
        subtitle={`Live merchant partners and commercial supply points • Showing ${filteredVendors.length} of ${vendors.length} vendors`}
        columns={columns}
        data={filteredVendors}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search vendor name, contact person, pincode..."
        exportFileName="divisional_vendors.csv"
        tableClassName="min-w-[960px] w-full"
        containerClassName="overflow-x-auto"
        customFilters={({ isDark }) => (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Status Filter */}
            <div className={`h-9 flex-1 sm:flex-initial inline-flex items-center gap-1.5 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            } border rounded-xl px-2.5 text-xs transition-colors`}>
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 w-full max-w-[180px] truncate`}
              >
                <option value="" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                  Status: All ({territoryScopedVendors.length})
                </option>
                <option value="active" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                  Active ({territoryScopedVendors.filter(v => (v.status || '').toLowerCase() === 'active' && !v.isDeleted).length})
                </option>
                <option value="suspended" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                  Suspended ({territoryScopedVendors.filter(v => (v.status || '').toLowerCase() === 'suspended' && !v.isDeleted).length})
                </option>
                <option value="deleted" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                  Deleted ({territoryScopedVendors.filter(v => (v.status || '').toLowerCase() === 'deleted' || v.isDeleted).length})
                </option>
                <option value="approved" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                  KYC Verified
                </option>
              </select>
            </div>

            {/* Category Filter */}
            <div className={`h-9 flex-1 sm:flex-initial inline-flex items-center gap-1.5 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            } border rounded-xl px-2.5 text-xs transition-colors`}>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 w-full max-w-[140px] truncate`}
              >
                <option value="" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>All Categories</option>
                <option value="Services" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Services</option>
                <option value="Product" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Product</option>
                <option value="Food" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Food</option>
                <option value="Daily Needs" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Daily Needs</option>
                <option value="Stay" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Stay</option>
                <option value="Travel" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Travel</option>
                <option value="Job" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Job</option>
              </select>
            </div>

            {/* Rating Filter */}
            <div className={`h-9 flex-1 sm:flex-initial inline-flex items-center gap-1.5 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            } border rounded-xl px-2.5 text-xs transition-colors`}>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 w-full max-w-[120px] truncate`}
              >
                <option value="" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>All Ratings</option>
                <option value="4+" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>4.0 & Above ★</option>
                <option value="3+" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>3.0 to 3.9 ★</option>
                <option value="below_3" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Below 3.0 ★</option>
              </select>
            </div>

            {(statusFilter || categoryFilter || ratingFilter) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('');
                  setCategoryFilter('');
                  setRatingFilter('');
                }}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer shrink-0 ml-1"
                title="Reset Filters"
              >
                Reset
              </button>
            )}
          </div>
        )}
      />

      {/* Register Vendor Modal */}
      <RegisterVendorModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onVendorCreated={handleVendorCreated}
        initialPincode={pincodeParam || ''}
      />

      {/* Vendor Details Modal */}
      <VendorDetailsModal
        isOpen={!!selectedVendorForDetails}
        onClose={() => setSelectedVendorForDetails(null)}
        vendor={selectedVendorForDetails}
        onVendorUpdated={handleVendorUpdated}
      />

      {/* Account Action Modal (Suspend / Activate / Soft-Delete) */}
      <AccountActionModal
        isOpen={accountActionState.isOpen}
        onClose={() => setAccountActionState(prev => ({ ...prev, isOpen: false, error: '' }))}
        onConfirm={handleConfirmAccountAction}
        actionType={accountActionState.actionType}
        account={accountActionState.account}
        loading={accountActionState.loading}
        error={accountActionState.error}
      />
    </div>
  );
}
