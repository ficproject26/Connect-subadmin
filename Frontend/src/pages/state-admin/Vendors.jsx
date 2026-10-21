import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { SearchBar } from '../../components/SearchBar';
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
  CheckCircle2,
  Clock,
  IndianRupee,
  Filter,
  RefreshCw,
  Download,
  Layers,
  Plus,
  ShieldCheck,
  UserCog,
  UserCheck,
  UserX,
  Trash2,
  Eye,
  Phone
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function StateVendors() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const assignedState = user?.state || 'Tamil Nadu';

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [territoryTree, setTerritoryTree] = useState([]);

  // Hierarchical Territory Filters (State Admin: District -> Division -> Pincode)
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedPincode, setSelectedPincode] = useState('');

  // Table Filters
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
      const d = overrides.district !== undefined ? overrides.district : selectedDistrict;
      const v = overrides.division !== undefined ? overrides.division : selectedDivision;
      const p = overrides.pincode !== undefined ? overrides.pincode : selectedPincode;

      if (assignedState) params.state = assignedState;
      if (d) params.district = d;
      if (v) params.division = v;
      if (p) params.pincode = p;

      const res = await dataService.getVendors(params);
      if (res && res.success) {
        const raw = res.vendors || res.data || [];
        setVendors(raw.filter(isFullyOnboardedVendor));
      } else {
        setVendors([]);
      }
    } catch (e) {
      console.error('Failed to load vendors:', e);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [assignedState, selectedDistrict, selectedDivision, selectedPincode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Territory-scoped vendors based on selected hierarchy filters (strictly fully onboarded)
  const territoryScopedVendors = useMemo(() => {
    return vendors.filter(v => {
      if (!isFullyOnboardedVendor(v)) return false;

      if (selectedDistrict) {
        const dNorm = selectedDistrict.toLowerCase().trim();
        const vDist = (v.district || v.districtName || '').toLowerCase().trim();
        if (vDist && vDist !== dNorm) return false;
      }
      if (selectedDivision) {
        const divNorm = selectedDivision.toLowerCase().trim().replace(/\s+division$/i, '');
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
  }, [vendors, selectedDistrict, selectedDivision, selectedPincode]);

  // Compute KPI stats strictly from territory-scoped onboarded dataset
  const kpiStats = useMemo(() => {
    return computeOnboardedVendorKpis(territoryScopedVendors);
  }, [territoryScopedVendors]);

  // Filtered vendors list
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
            {creator.id && creator.id !== '-' && (
              <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                ID: {creator.id}
              </div>
            )}
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
        const districtName = row.district || resolved.district;
        const divisionName = row.division || resolved.division;
        const pin = row.pincode || resolved.pincode;

        return (
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={`${stateName} > ${districtName} > ${divisionName} > ${pin}`}>
              {districtName}, {divisionName}
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">State Vendors Network</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Officially onboarded and verified merchant partners directory within your authorized state territory.
          </p>
        </div>
      </div>

      {/* Territory Hierarchy Filter */}
      <TerritoryHierarchyFilter
        selectedState={assignedState}
        selectedDistrict={selectedDistrict}
        onDistrictChange={(dist) => {
          setSelectedDistrict(dist);
          setSelectedDivision('');
          setSelectedPincode('');
        }}
        selectedDivision={selectedDivision}
        onDivisionChange={(div) => {
          setSelectedDivision(div);
          setSelectedPincode('');
        }}
        selectedPincode={selectedPincode}
        onPincodeChange={(pin) => setSelectedPincode(pin)}
        onClear={() => {
          setSelectedDistrict('');
          setSelectedDivision('');
          setSelectedPincode('');
        }}
        territoryTree={territoryTree}
        title="Territory Hierarchy Filter"
        showState={false}
        showDistrict={true}
        showDivision={true}
        showPincode={true}
      />

      {/* KPI Cards - Counting Only Officially Onboarded Vendors */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Onboarded Vendors</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.total}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
            Officially verified merchants
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active & Operational</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.active}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Fulfilling active orders
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Top Rated (4★+)</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.topRated}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            High customer satisfaction
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending Payout</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            ₹{kpiStats.pendingPayout.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
            Settlement pipeline
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={filteredVendors}
        loading={loading}
        onRefresh={loadData}
        onRowClick={(row) => setSelectedVendorForDetails(row)}
        searchPlaceholder="Search vendors by name, category, pincode..."
        exportFileName="state_vendors.csv"
        tableClassName="min-w-[960px] w-full"
        containerClassName="overflow-x-auto"
        customHeader={({ search, setSearch, onRefresh, loading: refreshLoading, handleExportCSV, isDark }) => (
          <div className={`p-3.5 sm:px-4 sm:py-3.5 border-b ${
            isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'
          } flex flex-nowrap items-center justify-between gap-2.5 transition-colors`}>
            {/* Left side: Search Bar + Filter Dropdowns */}
            <div className="flex flex-nowrap items-center gap-2.5 min-w-0 flex-1">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search vendors..."
                className="w-36 sm:w-44 shrink flex-1 max-w-[220px]"
              />

              {/* Filter 1: Operational Status */}
              <div className={`h-9 inline-flex items-center gap-2 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 truncate`}
                  title="Filter by Status"
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

              {/* Filter 2: Vendor Category */}
              <div className={`h-9 inline-flex items-center gap-2 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 max-w-[130px] truncate`}
                  title="Filter by Vendor Category"
                >
                  <option value="" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Category: All
                  </option>
                  <option value="Services" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Services
                  </option>
                  <option value="Product" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Product
                  </option>
                  <option value="Food" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Food
                  </option>
                  <option value="Daily Needs" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Daily Needs
                  </option>
                  <option value="Stay" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Stay
                  </option>
                  <option value="Travel" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Travel
                  </option>
                  <option value="Job" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Job
                  </option>
                </select>
              </div>

              {/* Filter 3: Rating */}
              <div className={`h-9 inline-flex items-center gap-2 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 truncate`}
                  title="Filter by Rating"
                >
                  <option value="" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Rating: All
                  </option>
                  <option value="4+" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    4★+
                  </option>
                  <option value="3+" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    3★+
                  </option>
                  <option value="below_3" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Below 3★
                  </option>
                </select>
              </div>
            </div>

            {/* Right side: Refresh + Export CSV */}
            <div className="flex flex-nowrap items-center gap-2.5 shrink-0">
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  title="Refresh Data"
                  className={`h-9 w-9 inline-flex items-center justify-center shrink-0 ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  } border rounded-xl transition cursor-pointer`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshLoading ? 'animate-spin' : ''}`} />
                </button>
              )}

              <button
                type="button"
                onClick={handleExportCSV}
                title="Export to CSV"
                className={`h-9 inline-flex items-center gap-1.5 px-3.5 shrink-0 ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                } border rounded-xl text-xs font-semibold transition cursor-pointer`}
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Export CSV</span>
              </button>
            </div>
          </div>
        )}
      />

      {/* New Standardized Vendor Registration Modal */}
      <RegisterVendorModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onVendorCreated={handleVendorCreated}
        initialPincode=""
      />

      {/* Vendor Profile & KYC Dossier Modal */}
      <VendorDetailsModal
        isOpen={Boolean(selectedVendorForDetails)}
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
