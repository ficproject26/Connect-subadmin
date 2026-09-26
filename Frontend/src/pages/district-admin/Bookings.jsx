import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge, CardTierIcon } from '../../components/Badge';
import { BookingDetailsModal } from '../../components/BookingDetailsModal';
import { useTheme } from '../../context/ThemeContext';
import { CalendarCheck } from 'lucide-react';

export function DistrictBookings() {
  const { user } = useAuth();
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
      header: 'Service Type',
      accessor: 'service',
      render: (row) => <span className="font-semibold text-indigo-600 dark:text-indigo-300 text-xs">{row.service}</span>
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
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">District Service Appointments</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Customer repair and installation bookings in this District.</p>
      </div>

      <DataTable
        title="District Service Bookings"
        subtitle="Tracking technician dispatch and execution"
        columns={columns}
        data={bookings}
        loading={loading}
        onRefresh={loadData}
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
