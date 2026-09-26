import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { SearchBar } from '../../components/SearchBar';
import { StatusBadge } from '../../components/Badge';
import { RegisterVendorModal } from '../../components/RegisterVendorModal';
import { VendorDetailsModal } from '../../components/VendorDetailsModal';
import { resolvePincodeHierarchy, resolveVendorAddedBy } from '../../utils/pincodeDirectory';
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
  Eye,
  Phone
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function DistrictVendors() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const districtName = user?.district || '';

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [kycFilter, setKycFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedVendorForDetails, setSelectedVendorForDetails] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getVendors();
      if (res.success) setVendors(res.vendors || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to determine if a vendor is awaiting Pincode Admin approval (Stage 1)
  const isAwaitingPincodeApproval = (v) => {
    if (!v) return false;
    if (v.pincodeAdminApproval?.status === 'Approved' || v.pincodeAdminApproval?.status === 'Rejected') return false;
    const appStatus = (v.approvalStatus || '').toLowerCase();
    if (appStatus.includes('pincode admin approved') || appStatus.includes('pincode admin rejected')) return false;
    const kyc = (v.kycStatus || '').toLowerCase();
    if (kyc.includes('kyc pending') || kyc.includes('approved') || kyc === 'verified' || kyc.includes('rejected')) return false;
    if ((v.status || '').toLowerCase().includes('rejected')) return false;
    if (v.pincodeAdminApproval?.status === 'Pending') return true;
    if (appStatus.includes('pending')) return true;
    if (kyc.includes('pending') || kyc.includes('verification') || (v.status || '').toLowerCase().includes('under review')) return true;
    return false;
  };

  // Compute 4 KPI stats
  const kpiStats = useMemo(() => {
    const total = vendors.length;
    const verified = vendors.filter(v => (v.kycStatus || '').toLowerCase().includes('approved') || (v.kycStatus || '').toLowerCase() === 'verified' || (v.status || '').toLowerCase() === 'active').length;
    const pendingPincode = vendors.filter(isAwaitingPincodeApproval).length;
    const pendingKyc = vendors.filter(v => (v.kycStatus || '').toLowerCase() === 'kyc pending' || (v.kycStatus || '').toLowerCase().includes('admin approved')).length;
    const pendingPayout = vendors.reduce((sum, v) => sum + (Number(v.pendingPayout) || 0), 0);

    return {
      total,
      verified,
      pendingPincode,
      pendingKyc,
      pendingPayout
    };
  }, [vendors]);

  // Filtered vendors list
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      if (kycFilter) {
        const k = (v.kycStatus || '').toLowerCase();
        const target = kycFilter.toLowerCase();
        if (target === 'approved') {
          if (!k.includes('approved') && k !== 'verified' && (v.status || '').toLowerCase() !== 'active') return false;
        } else if (target === 'pending_pincode') {
          if (!isAwaitingPincodeApproval(v)) return false;
        } else if (target === 'kyc_pending') {
          if (!k.includes('kyc pending') && !k.includes('pincode admin approved')) return false;
        } else if (target === 'rejected') {
          if (!k.includes('rejected') && (v.status || '').toLowerCase() !== 'rejected') return false;
        } else if (!k.includes(target)) {
          return false;
        }
      }

      if (categoryFilter) {
        const cat = (v.category || '').toLowerCase();
        const target = categoryFilter.toLowerCase();
        if (target === 'job' || target === 'jobs') {
          if (!cat.includes('job') && !cat.includes('work') && !cat.includes('recruitment')) return false;
        } else if (!cat.includes(target) && !target.includes(cat)) {
          return false;
        }
      }

      if (ratingFilter) {
        const r = Number(v.rating) || 0;
        if (ratingFilter === '4+' && r < 4.0) return false;
        if (ratingFilter === '3+' && (r < 3.0 || r >= 4.0)) return false;
        if (ratingFilter === 'below_3' && r >= 3.0) return false;
      }

      return true;
    });
  }, [vendors, kycFilter, categoryFilter, ratingFilter]);

  const handleVendorCreated = (newVendor) => {
    setVendors(prev => [newVendor, ...prev]);
  };

  const handleVendorUpdated = (updatedVendor) => {
    setVendors(prev => prev.map(v => v.id === updatedVendor.id ? updatedVendor : v));
  };

  const columns = [
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
        const distName = row.district || districtName;
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
      className: 'w-[23%]',
      render: (row) => (
        <div className="py-0.5">
          <StatusBadge status={row.kycStatus || 'Pending Pincode Admin Approval'} />
        </div>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'w-[7%] text-center',
      render: (row) => (
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
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{districtName} District Vendors Desk</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Certified merchant directory with automated pincode hierarchy and field approval monitoring for {districtName} District.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRegisterModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs shadow-blue-600/20 transition cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Vendor Onboarding</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">District Vendors</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.total}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
            Active in {districtName}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Verified & Approved</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.verified}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            KYC compliance cleared
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Awaiting Pincode Approval</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.pendingPincode}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Stage 1 field verification
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Awaiting KYC Team</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.pendingKyc}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
            Stage 2 compliance review
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
        exportFileName="district_vendors.csv"
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

              {/* Filter 1: KYC Status */}
              <div className={`h-9 inline-flex items-center gap-2 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={kycFilter}
                  onChange={(e) => setKycFilter(e.target.value)}
                  className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 truncate`}
                  title="Filter by KYC Status"
                >
                  <option value="" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    KYC: All Stages
                  </option>
                  <option value="pending_pincode" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Pending Pincode Approval
                  </option>
                  <option value="kyc_pending" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    KYC Pending
                  </option>
                  <option value="approved" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    KYC Approved
                  </option>
                  <option value="rejected" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>
                    Rejected
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
    </div>
  );
}
