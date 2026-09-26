import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import {
  ShieldAlert,
  AlertTriangle,
  Ban,
  Trash2,
  Lock,
  Search,
  Filter,
  Eye,
  Store,
  Package,
  MapPin,
  Calendar,
  Layers,
  Building2,
  Globe2,
  CheckCircle,
  Clock,
  ArrowRight,
  Info
} from 'lucide-react';

export function QualityCheck() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');

  const role = user?.role || 'State Admin';

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getQualityChecks();
      if (res.success) {
        setRecords(res.records || []);
      }
    } catch (err) {
      console.error('Failed to load quality check records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute summary stats
  const stats = useMemo(() => {
    const total = records.length;
    const warning = records.filter(r => r.status === 'Warning').length;
    const suspended = records.filter(r => r.status === 'Suspended').length;
    const deleted = records.filter(r => r.status === 'Deleted').length;
    return { total, warning, suspended, deleted };
  }, [records]);

  // Filter records based on status filter
  const filteredRecords = useMemo(() => {
    if (statusFilter === 'All') return records;
    return records.filter(r => r.status === statusFilter);
  }, [records, statusFilter]);

  // Status Badge Component
  const renderStatusBadge = (status) => {
    if (status === 'Warning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 text-[11px] font-bold shadow-xs whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Warning</span>
        </span>
      );
    }
    if (status === 'Suspended') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300/80 dark:border-orange-800 text-[11px] font-bold shadow-xs whitespace-nowrap">
          <Ban className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span>Suspended</span>
        </span>
      );
    }
    if (status === 'Deleted') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/80 dark:border-rose-800 text-[11px] font-bold shadow-xs whitespace-nowrap">
          <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span>Deleted</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap">
        {status}
      </span>
    );
  };

  // Warning Count Pill Component strictly adhering to:
  // - 1st & 2nd Warning: Warning status
  // - 3rd Warning: Suspended (3 warnings triggers suspend)
  // - After Suspend: Deleted (only after suspension can product be deleted)
  const renderWarningCount = (count, status) => {
    let label = '';
    let color = '';

    if (count === 1) {
      label = '1st Warning';
      color = 'bg-amber-100/90 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-800';
    } else if (count === 2) {
      label = '2nd Warning';
      color = 'bg-amber-100/90 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border-amber-400 dark:border-amber-700';
    } else if (count === 3 || status === 'Suspended') {
      label = '3rd Warning';
      color = 'bg-orange-100/90 text-orange-800 dark:bg-orange-950/80 dark:text-orange-200 border-orange-300 dark:border-orange-800';
    } else {
      label = 'After Suspend';
      color = 'bg-rose-100/90 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border-rose-300 dark:border-rose-800';
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-xs whitespace-nowrap ${color}`}>
        {label}
      </span>
    );
  };

  // Table Columns matching EXACT user requirements:
  // - Proper padding and min-widths across all columns to eliminate overlap
  // - Pincode Admin: Vendors are strictly in this pincode, so State, District, Division, Pincode columns are hidden.
  // - WARNING COUNT and STATUS unified in a single row side-by-side
  const columns = useMemo(() => {
    const isPincodeAdmin = role === 'Pincode Admin';

    const cols = [
      {
        header: 'VENDOR NAME',
        accessor: 'vendorName',
        className: 'min-w-[210px]',
        render: (row) => (
          <div className="flex items-center gap-3 pr-4">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                {row.vendorName}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {row.vendorId}
              </div>
            </div>
          </div>
        )
      },
      {
        header: 'PRODUCT NAME',
        accessor: 'productName',
        className: 'min-w-[240px] max-w-[290px]',
        render: (row) => (
          <div className="flex items-center gap-3 pr-5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 dark:text-white text-xs leading-snug break-words" title={row.productName}>
                {row.productName}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {row.productId}
              </div>
            </div>
          </div>
        )
      }
    ];

    // Location columns only shown for higher hierarchy levels where multi-location vendors exist
    if (!isPincodeAdmin) {
      if (role === 'State Admin') {
        cols.push(
          {
            header: 'STATE',
            accessor: 'state',
            className: 'min-w-[120px]',
            render: (row) => (
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap pr-3">
                {row.state}
              </span>
            )
          },
          {
            header: 'DISTRICT',
            accessor: 'district',
            className: 'min-w-[120px]',
            render: (row) => (
              <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap pr-3">
                {row.district}
              </span>
            )
          },
          {
            header: 'DIVISION',
            accessor: 'division',
            className: 'min-w-[130px]',
            render: (row) => (
              <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap pr-3">
                {row.division}
              </span>
            )
          },
          {
            header: 'PINCODE',
            accessor: 'pincode',
            className: 'min-w-[100px]',
            render: (row) => (
              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap pr-3">
                <MapPin className="w-3 h-3 text-blue-500" />
                {row.pincode}
              </span>
            )
          }
        );
      } else if (role === 'District Admin') {
        cols.push(
          {
            header: 'DIVISION',
            accessor: 'division',
            className: 'min-w-[130px]',
            render: (row) => (
              <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap pr-3">
                {row.division}
              </span>
            )
          },
          {
            header: 'PINCODE',
            accessor: 'pincode',
            className: 'min-w-[100px]',
            render: (row) => (
              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap pr-3">
                <MapPin className="w-3 h-3 text-blue-500" />
                {row.pincode}
              </span>
            )
          }
        );
      } else if (role === 'Divisional Admin') {
        cols.push(
          {
            header: 'PINCODE',
            accessor: 'pincode',
            className: 'min-w-[100px]',
            render: (row) => (
              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap pr-3">
                <MapPin className="w-3 h-3 text-blue-500" />
                {row.pincode}
              </span>
            )
          }
        );
      }
    }

    cols.push(
      {
        header: 'ISSUE',
        accessor: 'issue',
        className: 'min-w-[260px] max-w-[340px]',
        render: (row) => (
          <div className="pr-5">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words" title={row.issue}>
              {row.issue}
            </div>
          </div>
        )
      },
      {
        header: 'WARNING COUNT & STATUS',
        accessor: (row) => `${row.warningCount} ${row.status}`,
        className: 'min-w-[190px]',
        render: (row) => (
          <div className="flex flex-col items-start gap-1.5 py-0.5">
            {renderWarningCount(row.warningCount, row.status)}
            {renderStatusBadge(row.status)}
          </div>
        )
      },
      {
        header: 'DATE',
        accessor: 'date',
        className: 'min-w-[110px]',
        render: (row) => (
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap pr-3">
            {row.date}
          </span>
        )
      },
      {
        header: 'ACTION',
        accessor: 'id',
        className: 'min-w-[110px] text-right',
        render: (row) => (
          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRecord(row);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect</span>
            </button>
          </div>
        )
      }
    );

    return cols;
  }, [role]);

  // Page Header modeled exactly after KYC header structure
  const getHeaderInfo = () => {
    if (role === 'State Admin') {
      return {
        title: 'State Quality Check Desk',
        subtitle: `Vendor product quality compliance and disciplinary monitoring across the State.`
      };
    }
    if (role === 'District Admin') {
      return {
        title: 'District Quality Check Desk',
        subtitle: `Vendor product quality compliance and disciplinary review for District: ${user?.district || '-'}.`
      };
    }
    if (role === 'Divisional Admin') {
      return {
        title: 'Divisional Quality Check Desk',
        subtitle: `Vendor product quality compliance and disciplinary review for Division: ${user?.division || '-'}.`
      };
    }
    return {
      title: 'Pincode Quality Check Desk',
      subtitle: `Vendor product quality compliance and disciplinary review for PIN: ${user?.pincode || '-'}.`
    };
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{headerInfo.title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {headerInfo.subtitle}
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Issues */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total QC Issues</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {stats.total}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Affected vendor products
          </div>
        </div>

        {/* Warnings */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Warning Status</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1.5">
            {stats.warning}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Notice issued by QC
          </div>
        </div>

        {/* Suspended */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Suspended Products</span>
            <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1.5">
            {stats.suspended}
          </div>
          <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium mt-0.5">
            Temporarily delisted
          </div>
        </div>

        {/* Deleted */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Deleted Products</span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1.5">
            {stats.deleted}
          </div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
            Permanently removed
          </div>
        </div>
      </div>

      {/* View-Only Data Table */}
      <DataTable
        title="Quality Check Product Issues"
        subtitle={`Hierarchical listing showing ${filteredRecords.length} product compliance issues (View Only)`}
        columns={columns}
        data={filteredRecords}
        loading={loading}
        onRefresh={loadData}
        onRowClick={(row) => setSelectedRecord(row)}
        searchPlaceholder="Search vendor, product, issue, pincode..."
        exportFileName="quality_check_product_issues.csv"
        filterOptions={[
          { label: 'All Statuses', value: 'All' },
          { label: 'Warning', value: 'Warning' },
          { label: 'Suspended', value: 'Suspended' },
          { label: 'Deleted', value: 'Deleted' }
        ]}
        activeFilter={statusFilter}
        onFilterChange={(val) => setStatusFilter(val)}
      />

      {/* View-Only Inspection Detail Modal */}
      <Modal
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        title="Quality Check Issue Inspection Report"
      >
        {selectedRecord && (
          <div className="space-y-4">
            {/* View Only Notice Badge */}
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="font-semibold">
                  View-Only Mode: Disciplinary actions are managed inside the Quality Check module.
                </span>
              </div>
              <div className="shrink-0">{renderStatusBadge(selectedRecord.status)}</div>
            </div>

            {/* Vendor & Product Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Vendor Details</span>
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>{selectedRecord.vendorName}</span>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  Vendor ID: {selectedRecord.vendorId}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product Details</span>
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>{selectedRecord.productName}</span>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  Product ID: {selectedRecord.productId}
                </div>
              </div>
            </div>

            {/* Location Hierarchy Chain */}
            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 space-y-2">
              <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider block">
                Geographical Hierarchy Chain
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">State</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedRecord.state}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">District</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedRecord.district}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Division</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedRecord.division}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Pincode</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedRecord.pincode}</span>
                </div>
              </div>
            </div>

            {/* Quality Check Issue Findings */}
            <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Quality Check Violation Identified
                </span>
                <div className="flex items-center gap-2">
                  {renderWarningCount(selectedRecord.warningCount, selectedRecord.status)}
                  {renderStatusBadge(selectedRecord.status)}
                </div>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {selectedRecord.issue}
              </p>
              {selectedRecord.details && (
                <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-rose-200/60 dark:border-rose-900/30">
                  {selectedRecord.details}
                </p>
              )}
            </div>

            {/* Metadata Footer */}
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 pt-1">
              <div>
                <span className="text-[10px] text-slate-400 block">Inspection Date:</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{selectedRecord.date}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">QC Engine Source:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedRecord.qcCheckedBy || 'Quality Check Module'}</span>
              </div>
            </div>

            {/* Close Button Only - No Action Buttons */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#001D51] hover:bg-[#00153a] text-white transition shadow-sm cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
