import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCircle2,
  Clock,
  IndianRupee,
  Filter,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Phone
} from 'lucide-react';

export function PincodeVendors() {
  const { user } = useAuth();
  const assignedPincode = user?.pincode || '';

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [kycFilter, setKycFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedVendorForDetails, setSelectedVendorForDetails] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getVendors();
      if (res.success) {
        let list = res.vendors || [];
        // Scope to this pincode if set
        if (assignedPincode) {
          const scoped = list.filter(v => String(v.pincode) === String(assignedPincode));
          if (scoped.length > 0) {
            list = scoped;
          }
        }
        setVendors(list);
      }
    } catch (e) {
      console.error('Failed to load vendors:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assignedPincode]);

  // Helper to determine if a vendor is awaiting Pincode Admin approval (Stage 1)
  const isAwaitingPincodeApproval = (v) => {
    if (!v) return false;
    // If explicitly decided by pincode admin
    if (v.pincodeAdminApproval?.status === 'Approved' || v.pincodeAdminApproval?.status === 'Rejected') {
      return false;
    }
    const appStatus = (v.approvalStatus || '').toLowerCase();
    if (appStatus.includes('pincode admin approved') || appStatus.includes('pincode admin rejected')) {
      return false;
    }
    const kyc = (v.kycStatus || '').toLowerCase();
    if (kyc.includes('kyc pending') || kyc.includes('approved') || kyc === 'verified' || kyc.includes('rejected')) {
      return false;
    }
    const stat = (v.status || '').toLowerCase();
    if (stat.includes('rejected')) {
      return false;
    }

    if (v.pincodeAdminApproval?.status === 'Pending') return true;
    if (appStatus.includes('pending')) return true;
    if (kyc.includes('pending') || kyc.includes('verification') || stat.includes('under review')) return true;

    return false;
  };

  // KPI stats
  const kpiStats = useMemo(() => {
    const total = vendors.length;
    const pendingMyApproval = vendors.filter(isAwaitingPincodeApproval).length;
    const verified = vendors.filter(
      v => (v.kycStatus || '').toLowerCase().includes('approved') ||
           (v.kycStatus || '').toLowerCase() === 'verified' ||
           (v.status || '').toLowerCase() === 'active'
    ).length;
    const pendingPayout = vendors.reduce((sum, v) => sum + (Number(v.pendingPayout) || 0), 0);

    return {
      total,
      pendingMyApproval,
      verified,
      pendingPayout
    };
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      if (kycFilter) {
        const k = (v.kycStatus || '').toLowerCase();
        if (kycFilter === 'pending_me') {
          if (!isAwaitingPincodeApproval(v)) return false;
        } else if (kycFilter === 'approved') {
          if (!k.includes('approved') && k !== 'verified' && (v.status || '').toLowerCase() !== 'active') return false;
        } else if (kycFilter === 'kyc_pending') {
          if (!k.includes('kyc pending') && !k.includes('pincode admin approved')) return false;
        } else if (kycFilter === 'rejected') {
          if (!k.includes('rejected') && (v.status || '').toLowerCase() !== 'rejected') return false;
        }
      }

      if (categoryFilter) {
        if ((v.category || '').toLowerCase() !== categoryFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [vendors, kycFilter, categoryFilter]);

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
      className: 'w-[22%]',
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700/40 text-amber-600 dark:text-amber-400 shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-900 dark:text-white text-xs truncate" title={row.name}>{row.name}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={`Contact: ${row.contactPerson} • ${row.phone}`}>
              {row.contactPerson} &bull; {row.phone}
            </div>
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">{row.category}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Onboarded By',
      accessor: 'addedBy',
      className: 'w-[22%]',
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
            <div className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate" title={creator.name}>
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
      className: 'w-[18%]',
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
      header: 'Stage 1 Verification',
      accessor: 'kycStatus',
      className: 'w-[22%]',
      render: (row) => {
        const isPendingMyApproval = (row.kycStatus || '').toLowerCase().includes('pending pincode') || row.kycStatus === 'Pending';
        if (isPendingMyApproval) {
          return (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedVendorForDetails(row);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Action Required</span>
              </button>
            </div>
          );
        }

        return (
          <div className="py-0.5">
            <StatusBadge status={row.kycStatus || 'Pending Pincode Admin Approval'} />
          </div>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'w-[16%] text-center',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedVendorForDetails(row);
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Review Details</span>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header with Title and "Register Vendor" Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pincode Vendors Directory</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Local merchant partners under Pincode <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{assignedPincode}</span> jurisdiction.
          </p>
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

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Merchants</span>
            <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{kpiStats.total}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Pincode {assignedPincode}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Awaiting My Approval</span>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
          </div>
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1.5">{kpiStats.pendingMyApproval}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Stage 1 verification pending
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Fully KYC Certified</span>
            <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              ✓
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{kpiStats.verified}</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
            Stage 2 KYC completed
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending Payout</span>
            <div className="text-xs font-bold text-purple-600 dark:text-purple-400">₹</div>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            ₹{kpiStats.pendingPayout.toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
            Payable settlements
          </div>
        </div>
      </div>

      <DataTable
        title="Local Merchants Roster"
        subtitle={`Restricted to assigned pincode hierarchy • Showing ${filteredVendors.length} of ${vendors.length} vendors`}
        columns={columns}
        data={filteredVendors}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search vendor name, category..."
        exportFileName="pincode_vendors.csv"
        tableClassName="min-w-[960px] w-full"
        containerClassName="overflow-x-auto"
        customFilters={({ isDark }) => (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                <option value="pending_me" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>⚡ Needs My Approval</option>
                <option value="kyc_pending" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>KYC Pending Review</option>
                <option value="approved" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Fully Approved</option>
                <option value="rejected" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>Rejected</option>
              </select>
            </div>

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

            {(kycFilter || categoryFilter) && (
              <button
                type="button"
                onClick={() => {
                  setKycFilter('');
                  setCategoryFilter('');
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
        defaultPincode={assignedPincode}
      />

      {/* Vendor Details Modal (Includes Stage 1 Accept / Reject with mandatory reason) */}
      <VendorDetailsModal
        isOpen={!!selectedVendorForDetails}
        onClose={() => setSelectedVendorForDetails(null)}
        vendor={selectedVendorForDetails}
        onVendorUpdated={handleVendorUpdated}
      />
    </div>
  );
}
