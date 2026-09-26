import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { VendorKYCDetailsModal } from '../../components/VendorKYCDetailsModal';
import {
  FileCheck2,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Store,
  Tag,
  MapPin,
  ShieldCheck,
  User
} from 'lucide-react';

export function DivisionalKYC() {
  const { user } = useAuth();
  const [kycList, setKycList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getKYC();
      if (res.success) {
        setKycList(res.kyc || res.records || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute 4 KPI Cards
  const kpiStats = useMemo(() => {
    const totalKYC = kycList.length;
    const approvedKYC = kycList.filter(k => {
      const s = (k.status || '').toLowerCase();
      return s === 'approved' || s === 'verified';
    }).length;
    const pendingKYC = kycList.filter(k => {
      const s = (k.status || '').toLowerCase();
      return s === 'pending';
    }).length;
    const rejectedKYC = kycList.filter(k => {
      const s = (k.status || '').toLowerCase();
      return s === 'rejected';
    }).length;

    return {
      totalKYC,
      approvedKYC,
      pendingKYC,
      rejectedKYC
    };
  }, [kycList]);

  const columns = [
    {
      header: 'VENDOR NAME',
      accessor: (row) => `${row.businessName || row.name || ''} ${row.vendorName || ''}`,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[200px]" title={row.businessName || row.name}>
              {row.businessName || row.name || 'Vendor Enterprise'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate max-w-[180px]">Owner: {row.vendorName || row.contactPerson || 'Authorized Merchant'}</span>
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'CATEGORY',
      accessor: 'category',
      render: (row) => {
        const cat = row.category || 'Services';
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200/80 dark:border-indigo-900/50 whitespace-nowrap">
            <Tag className="w-3 h-3 text-indigo-500 shrink-0" />
            <span>{cat}</span>
          </span>
        );
      }
    },
    {
      header: 'ADDRESS',
      accessor: (row) => `${row.address || ''} ${row.pincode || ''}`,
      render: (row) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1 truncate max-w-[220px]" title={row.address}>
            <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">{row.address || (user?.division ? `${user.division} Division` : 'Division')}</span>
          </div>
          <div className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px] font-bold pl-4.5 mt-0.5 whitespace-nowrap">
            PIN: {row.pincode || '-'}
          </div>
        </div>
      )
    },
    {
      header: 'VERIFIED BY',
      accessor: 'verifiedBy',
      render: (row) => {
        const isPending = (row.status || '').toLowerCase() === 'pending';
        return (
          <div className="text-xs flex items-center gap-1.5">
            <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${isPending ? 'text-amber-500' : 'text-emerald-500'}`} />
            <span className={`font-semibold ${isPending ? 'text-amber-600 dark:text-amber-400 italic' : 'text-slate-900 dark:text-white'}`}>
              {row.verifiedBy || (isPending ? 'Pending Verification' : 'Verified')}
            </span>
          </div>
        );
      }
    },
    {
      header: 'STATUS',
      accessor: 'status',
      className: 'whitespace-nowrap',
      render: (row) => <StatusBadge status={row.status || 'Approved'} />
    },
    {
      header: 'ACTIONS',
      accessor: 'actions',
      className: 'whitespace-nowrap text-center',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedVendor(row);
          }}
          title="View Full Vendor Details"
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:border-blue-700 transition cursor-pointer inline-flex items-center justify-center"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Divisional KYC Compliance Desk</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Vendor identity verification clearance and compliance review for {user?.division ? `${user.division} Division` : 'assigned division'}.
        </p>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* KPI 1: Total KYC */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total KYC</span>
            <FileCheck2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            {kpiStats.totalKYC.toLocaleString()}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
            Divisional merchant roster
          </div>
        </div>

        {/* KPI 2: Approved KYC */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Approved KYC</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            {kpiStats.approvedKYC.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Clearance approved
          </div>
        </div>

        {/* KPI 3: Pending KYC */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending KYC</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            {kpiStats.pendingKYC.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Awaiting verification
          </div>
        </div>

        {/* KPI 4: Rejected KYC */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rejected KYC</span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            {kpiStats.rejectedKYC.toLocaleString()}
          </div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
            Documents rejected
          </div>
        </div>
      </div>

      {/* Main KYC Table */}
      <DataTable
        title="Divisional Vendor KYC Queue"
        subtitle="Review identity documents and compliance clearance for divisional vendors"
        columns={columns}
        data={kycList}
        loading={loading}
        onRefresh={loadData}
        onRowClick={(row) => setSelectedVendor(row)}
        searchPlaceholder="Search vendor name, category, or address..."
        exportFileName="divisional_vendor_kyc.csv"
      />

      {/* Vendor KYC Full Details Modal */}
      <VendorKYCDetailsModal
        isOpen={Boolean(selectedVendor)}
        onClose={() => setSelectedVendor(null)}
        vendor={selectedVendor}
        onVendorUpdated={loadData}
      />
    </div>
  );
}
