import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge, CardTierIcon } from '../../components/Badge';
import { BookingDetailsModal } from '../../components/BookingDetailsModal';
import { useTheme } from '../../context/ThemeContext';
import { CalendarCheck, Users, CreditCard, TrendingUp } from 'lucide-react';

export function StateBookings() {
  const { isDark } = useTheme();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getBookings();
      if (res.success) setBookings(res.bookings);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute 4 KPI stats from bookings
  const kpiStats = useMemo(() => {
    const total = bookings.length;

    const isMembership = (b) => {
      const tier = (b.membershipTier || '').toLowerCase();
      if (tier && !['normal', 'standard', 'customer', 'none'].includes(tier)) {
        return true;
      }
      const memberNames = ['vikram chandran', 'lakshmi narayanan', 'divya prakash', 'kavitha radhakrishnan', 'siddharth joshi', 'ramesh sundaram'];
      return memberNames.includes((b.customerName || '').toLowerCase());
    };

    const membershipBookings = bookings.filter(b => isMembership(b)).length;
    const normalBookings = total - membershipBookings;

    // Peak booking location
    let peakLocation = '-';
    let peakCount = 0;
    if (total > 0) {
      const locationCounts = bookings.reduce((acc, b) => {
        const loc = b.division || b.district || 'Unassigned';
        acc[loc] = (acc[loc] || 0) + 1;
        return acc;
      }, {});

      Object.entries(locationCounts).forEach(([loc, count]) => {
        if (count > peakCount) {
          peakCount = count;
          peakLocation = loc;
        }
      });
    }

    const peakPercent = total > 0 ? Math.round((peakCount / total) * 100) : 0;

    return {
      total,
      normalBookings,
      membershipBookings,
      peakLocation,
      peakCount,
      peakPercent
    };
  }, [bookings]);

  const columns = [
    {
      header: 'Booking Ref',
      accessor: (row) => `${row.customerName} ${row.bookingNumber}`,
      render: (row) => (
        <div>
          <div className="font-bold text-xs text-slate-900 dark:text-white">{row.customerName}</div>
          <div className="font-bold text-slate-900 dark:text-white text-sm tracking-tight mt-0.5">{row.bookingNumber}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{row.scheduledDate}</div>
        </div>
      )
    },
    {
      header: 'Service Requested',
      accessor: 'service',
      render: (row) => (
        <div className="font-semibold text-indigo-600 dark:text-indigo-300 text-xs">{row.service}</div>
      )
    },
    {
      header: 'Location',
      accessor: 'pincode',
      render: (row) => (
        <div className="text-xs">
          <div className="font-mono text-emerald-600 dark:text-emerald-400">
            📍 PIN: {row.pincode}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            ({row.district}{row.division ? `, ${row.division}` : ''})
          </div>
        </div>
      )
    },
    {
      header: 'Amount & Savings',
      accessor: (row) => row.charge,
      className: 'whitespace-nowrap min-w-[150px]',
      render: (row) => {
        const tier = row.membershipTier;
        const isCardMember = tier && !['normal', 'standard', 'customer', 'none'].includes(String(tier).toLowerCase());
        const normalizedTier = isCardMember ? (tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()) : null;

        const baseCharge = Number(row.charge) || 1200;
        const discountRate = normalizedTier === 'Diamond' ? 0.20 : normalizedTier === 'Gold' ? 0.15 : normalizedTier === 'Silver' ? 0.10 : 0;
        const discountAmount = Math.round(baseCharge * discountRate);
        const netPayable = baseCharge - discountAmount;
        const paymentMode = row.paymentMode || 'Online (UPI)';

        return (
          <div className="whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                ₹{netPayable.toLocaleString()}
              </span>
              {isCardMember && (
                <span title={`${normalizedTier} Card`} className="inline-flex items-center">
                  <CardTierIcon
                    tier={normalizedTier}
                    className="w-3.5 h-3.5 cursor-default"
                  />
                </span>
              )}
            </div>
            {discountAmount > 0 && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap mt-0.5">
                Card Discount: -₹{discountAmount.toLocaleString()}
              </div>
            )}
            <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap mt-0.5">
              {paymentMode}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">State Service Bookings</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Scheduled on-site repairs and maintenance across all state districts.</p>
      </div>

      {/* 4 KPI Cards in a single row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Bookings */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Bookings</span>
            <CalendarCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.total.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Active state ledger volume
          </div>
        </div>

        {/* KPI 2: Normal Customers */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Normal Customers</span>
            <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.normalBookings.toLocaleString()}
          </div>
          <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium mt-0.5">
            Standard non-card bookings
          </div>
        </div>

        {/* KPI 3: Membership Customers */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Membership Customers</span>
            <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.membershipBookings.toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
            Diamond, Gold & Silver tiers
          </div>
        </div>

        {/* KPI 4: Peak Booking Area */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Peak Booking Area</span>
            <TrendingUp className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 truncate" title={kpiStats.peakLocation}>
            {kpiStats.peakLocation}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 truncate">
            Top location ({kpiStats.peakCount} bookings • {kpiStats.peakPercent}%)
          </div>
        </div>
      </div>

      <DataTable
        title="Service Appointments"
        subtitle="Tracking technician dispatch and execution"
        columns={columns}
        data={bookings}
        loading={loading}
        onRefresh={loadData}
        onRowClick={(booking) => {
          setSelectedBooking(booking);
          setShowDetailsModal(true);
        }}
        searchPlaceholder="Search booking ID or customer..."
        exportFileName="state_bookings.csv"
      />

      {/* Booking Details Modal */}
      <BookingDetailsModal
        booking={selectedBooking}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />
    </div>
  );
}
