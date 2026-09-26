import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { ExecutiveDetailsModal } from '../../components/ExecutiveDetailsModal';
import {
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Store,
  Building2,
  BedDouble,
  Car,
  Users,
  CheckCircle2
} from 'lucide-react';

export function PincodeExecutives() {
  const { user } = useAuth();
  const [execs, setExecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecutive, setSelectedExecutive] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getExecutives();
      if (res.success) setExecs(res.executives || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute 4 KPI stats: Total Executives, Stay Executives, Travel Executives, Active Executives
  const kpiStats = useMemo(() => {
    const totalExecutives = execs.length;
    const stayExecutives = execs.filter(e =>
      (e.type || e.role || '').toLowerCase().includes('stay')
    ).length;
    const travelExecutives = execs.filter(e =>
      (e.type || e.role || '').toLowerCase().includes('travel')
    ).length;
    const activeExecutives = execs.filter(e =>
      ['active', 'on duty'].includes((e.status || '').toLowerCase())
    ).length;

    return {
      totalExecutives,
      stayExecutives,
      travelExecutives,
      activeExecutives
    };
  }, [execs]);

  const columns = [
    {
      header: 'EXECUTIVE',
      accessor: (row) => `${row.name} ${row.phone} ${row.type}`,
      render: (row) => {
        const isStay = (row.type || row.role || '').toLowerCase().includes('stay');
        return (
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg border shrink-0 ${
                isStay
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                  : 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900/50'
              }`}
            >
              {isStay ? <BedDouble className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">{row.name}</span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap shrink-0 ${
                    isStay
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900'
                      : 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-900'
                  }`}
                >
                  {row.type || (isStay ? 'Stay Executive' : 'Travel Executive')}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 mt-0.5 whitespace-nowrap">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{row.phone}</span>
              </div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'VENDOR',
      accessor: (row) => `${row.vendorName || ''} ${row.shopName || ''}`,
      render: (row) => (
        <div className="text-xs">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate max-w-[170px]" title={row.shopName || row.shop || 'Vendor Enterprise'}>
              {row.shopName || row.shop || 'Grand Palace Suites'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 pl-5">
            <Store className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate max-w-[160px]">Owner: {row.vendorName || row.vendor || 'Authorized Vendor'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'LOCATION',
      accessor: (row) => `${row.district} ${row.division} ${row.pincode}`,
      render: (row) => (
        <div className="text-xs">
          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="whitespace-nowrap">{row.district || user?.district || '-'}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">{row.division || user?.division || '-'}</span>
          </div>
          <div className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px] mt-0.5 pl-4.5 font-bold whitespace-nowrap">
            PIN: {row.pincode || user?.pincode || '-'}
          </div>
        </div>
      )
    },
    {
      header: 'CONTACT',
      accessor: (row) => `${row.phone} ${row.email}`,
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <a
              href={`tel:${row.phone?.replace(/\s+/g, '')}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline text-indigo-600 dark:text-indigo-400 font-medium"
            >
              {row.phone}
            </a>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
            <a
              href={`mailto:${row.email}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline truncate max-w-[160px]"
              title={row.email}
            >
              {row.email || 'executive@vendor.com'}
            </a>
          </div>
        </div>
      )
    },
    {
      header: 'STATUS',
      accessor: 'status',
      className: 'whitespace-nowrap',
      render: (row) => <StatusBadge status={row.status || 'Active'} />
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pincode Vendor Executives</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Vendor-assigned operations personnel managing stay and travel operations in PIN: {user?.pincode || '-'}.
        </p>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* KPI 1 */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Executives</span>
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            {kpiStats.totalExecutives.toLocaleString()}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
            Local pincode staff
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Stay Executives</span>
            <BedDouble className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            {kpiStats.stayExecutives.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Hotels &amp; rooms
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Travel Executives</span>
            <Car className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            {kpiStats.travelExecutives.toLocaleString()}
          </div>
          <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium mt-0.5">
            Local cabs &amp; tours
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Executives</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            {kpiStats.activeExecutives.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            On duty &amp; ready
          </div>
        </div>
      </div>

      {/* Main Executives Table */}
      <DataTable
        title="Pincode Operations Team"
        subtitle="Manage vendor executive readiness and local operations"
        columns={columns}
        data={execs}
        loading={loading}
        onRefresh={loadData}
        onRowClick={(row) => setSelectedExecutive(row)}
        searchPlaceholder="Search executive, vendor, or shop..."
        exportFileName="pincode_executives.csv"
      />

      {/* Executive Details Modal */}
      <ExecutiveDetailsModal
        isOpen={Boolean(selectedExecutive)}
        onClose={() => setSelectedExecutive(null)}
        executive={selectedExecutive}
      />
    </div>
  );
}
