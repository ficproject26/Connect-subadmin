import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { RegisterVendorModal } from '../../components/RegisterVendorModal';
import { VendorDetailsModal } from '../../components/VendorDetailsModal';
import { resolvePincodeHierarchy, resolveVendorAddedBy } from '../../utils/pincodeDirectory';
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
  Phone
} from 'lucide-react';

export function DivisionalVendors() {
  const { user } = useAuth();
  const divisionName = user?.division || '';
  const districtName = user?.district || '';
  const [searchParams] = useSearchParams();
  const pincodeParam = searchParams.get('pincode');

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
      if (res.success) {
        let list = res.vendors || [];
        if (divisionName) {
          const filtered = list.filter(
            v => (v.division || '')?.toLowerCase() === divisionName.toLowerCase()
          );
          if (filtered.length > 0) {
            list = filtered;
          }
        }
        if (pincodeParam) {
          list = list.filter(v => String(v.pincode) === String(pincodeParam));
        }
        setVendors(list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pincodeParam]);

  // Compute 4 KPI stats
  const kpiStats = useMemo(() => {
    const total = vendors.length;
    const verified = vendors.filter(v => (v.kycStatus || '').toLowerCase().includes('approved') || (v.kycStatus || '').toLowerCase() === 'verified').length;
    const pendingPincode = vendors.filter(v => (v.kycStatus || '').toLowerCase().includes('pending pincode')).length;
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

  // Filtered vendors list based on active filters
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      // 1. KYC Status Filter
      if (kycFilter) {
        const k = (v.kycStatus || '').toLowerCase();
        const target = kycFilter.toLowerCase();
        if (target === 'approved') {
          if (!k.includes('approved') && k !== 'verified') return false;
        } else if (target === 'pending_pincode') {
          if (!k.includes('pending pincode')) return false;
        } else if (target === 'kyc_pending') {
          if (!k.includes('kyc pending') && !k.includes('pincode admin approved')) return false;
        } else if (target === 'rejected') {
          if (!k.includes('rejected')) return false;
        } else if (!k.includes(target)) {
          return false;
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
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
          title="View Hierarchy & KYC Details"
        >
          <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>View</span>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header with Title and "Register Vendor" Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Division Vendors Network</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Merchant partners and commercial supply points under {divisionName} division jurisdiction.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowRegisterModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Vendor</span>
        </button>
      </div>

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

        {/* KPI 3: Pending Approvals */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending Approvals</span>
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.pendingPincode + kpiStats.pendingKyc}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            {kpiStats.pendingPincode} PIN approval • {kpiStats.pendingKyc} KYC review
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
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* KYC Status Filter */}
            <div className={`h-9 inline-flex items-center gap-1.5 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={kycFilter}
                onChange={(e) => setKycFilter(e.target.value)}
                className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 truncate`}
              >
                <option value="" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>All Verification Status</option>
                <option value="pending_pincode" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Pending Pincode Approval</option>
                <option value="kyc_pending" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>KYC Pending Review</option>
                <option value="approved" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Fully Approved / Verified</option>
                <option value="rejected" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Rejected</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className={`h-9 inline-flex items-center gap-1.5 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 truncate`}
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
            <div className={`h-9 inline-flex items-center gap-1.5 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 truncate`}
              >
                <option value="" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>All Ratings</option>
                <option value="4+" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>4.0 & Above ★</option>
                <option value="3+" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>3.0 to 3.9 ★</option>
                <option value="below_3" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Below 3.0 ★</option>
              </select>
            </div>

            {(kycFilter || categoryFilter || ratingFilter) && (
              <button
                type="button"
                onClick={() => {
                  setKycFilter('');
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
    </div>
  );
}
