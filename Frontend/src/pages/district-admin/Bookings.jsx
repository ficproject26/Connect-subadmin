import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge, CardTierIcon } from '../../components/Badge';
import { BookingDetailsModal } from '../../components/BookingDetailsModal';
import { useTheme } from '../../context/ThemeContext';
import { CalendarCheck, Filter, Building2 } from 'lucide-react';

export function DistrictBookings() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');

  const loadData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await dataService.getBookings();
      if (res.success) {
        setBookings(res.bookings || res.data || []);
        if (res.message && res.message.includes('Territory assignment is incomplete')) {
          setErrorMessage(res.message);
        }
      } else if (res.message) {
        setErrorMessage(res.message);
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

  // Client-side instant category filtering across Services, Stay, Travel, and All Categories
  const filteredBookings = useMemo(() => {
    if (categoryFilter === 'All Categories') return bookings;
    const catLower = categoryFilter.toLowerCase();
    return bookings.filter(b => {
      const bType = (b.bookingType || b.type || b.category || '').toLowerCase().trim();
      if (catLower === 'services') return bType === 'services' || bType === 'service';
      if (catLower === 'stay') return bType === 'stay';
      if (catLower === 'travel') return bType === 'travel';
      return bType === catLower;
    });
  }, [bookings, categoryFilter]);

  const columns = [
    {
      header: 'Booking Number',
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
      header: 'Service / Offering',
      accessor: (row) => `${row.service} ${row.vendorBusinessName || row.vendorName || ''}`,
      render: (row) => {
        const vendor = row.vendorBusinessName || row.vendorName;
        return (
          <div className="space-y-0.5">
            <span className="font-semibold text-indigo-600 dark:text-indigo-300 text-xs">{row.service}</span>
            {vendor && vendor !== 'Not provided' ? (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-medium text-slate-700 dark:text-slate-300">{vendor}</span>
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 italic">Provider unassigned</div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Location',
      accessor: 'pincode',
      render: (row) => (
        <div className="text-xs">
          <div className="font-mono text-emerald-600 dark:text-emerald-400">
            PIN: {row.pincode}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            ({row.district || user?.district || ''}{row.division ? `, ${row.division}` : ''})
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

        const baseCharge = Number(row.charge) || Number(row.totalAmount) || Number(row.finalAmount) || 0;
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
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">District Service Appointments</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Customer repair and installation bookings in this District.</p>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Category Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" /> Category:
          </span>
          {['All Categories', 'Services', 'Stay', 'Travel'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="font-bold text-slate-700 dark:text-slate-300">{filteredBookings.length}</span> {categoryFilter === 'All Categories' ? 'total' : categoryFilter.toLowerCase()} bookings
        </div>
      </div>

      <DataTable
        title="District Service Bookings"
        subtitle="Tracking technician dispatch and execution"
        columns={columns}
        data={filteredBookings}
        loading={loading}
        onRefresh={loadData}
        emptyMessage={errorMessage || "No bookings found under this territory."}
        onRowClick={(booking) => {
          setSelectedBooking(booking);
          setShowDetailsModal(true);
        }}
        searchPlaceholder="Search bookings..."
        exportFileName="district_bookings.csv"
      />

      <BookingDetailsModal
        booking={selectedBooking}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />
    </div>
  );
}
