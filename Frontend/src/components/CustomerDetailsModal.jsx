import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useTheme } from '../context/ThemeContext';
import { dataService } from '../services/dataService';
import { StatusBadge, TierBadge } from './Badge';
import {
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  ShoppingBag,
  Calendar,
  Clock,
  IndianRupee,
  Layers,
  Compass,
  Building2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  PackageCheck
} from 'lucide-react';

export function CustomerDetailsModal({ isOpen, onClose, customer }) {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'bookings'
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && customer) {
      setActiveTab('orders');
      loadCustomerHistory();
    } else {
      setHistoryData(null);
      setError(null);
    }
  }, [isOpen, customer]);

  const loadCustomerHistory = async () => {
    if (!customer) return;
    setLoading(true);
    setError(null);
    try {
      const custId = customer.id || customer._id || customer.customerId;
      const res = await dataService.getCustomerHistory(custId);
      if (res && res.success) {
        setHistoryData(res);
      } else {
        setHistoryData({
          customer,
          orders: [],
          bookings: []
        });
      }
    } catch (err) {
      console.error('Failed to fetch customer history:', err);
      setError(err.message || 'Failed to fetch customer order and booking history.');
      setHistoryData({
        customer,
        orders: [],
        bookings: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !customer) return null;

  const currentCust = historyData?.customer || customer;
  const orders = historyData?.orders || [];
  const bookings = historyData?.bookings || [];

  const totalSpent = Number(currentCust.totalSpent || currentCust.totalSpend || 0);
  const totalOrders = Number(currentCust.totalOrders || orders.length || 0);
  const totalBookings = Number(currentCust.totalBookings || bookings.length || 0);

  const getBookingCategoryBadge = (category) => {
    const cat = String(category || 'Service').toLowerCase();
    if (cat.includes('stay')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
          <Building2 className="w-3 h-3" /> Stay
        </span>
      );
    }
    if (cat.includes('travel')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
          <Compass className="w-3 h-3" /> Travel
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
        <Layers className="w-3 h-3" /> Service
      </span>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Profile & Transaction History"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Customer Overview Header */}
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
                {(currentCust.name || 'C')[0]?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {currentCust.name}
                  </h3>
                  <TierBadge tier={currentCust.membership?.tier || 'Customer'} />
                  <StatusBadge status={currentCust.status || 'Active'} size="sm" />
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                  <span className="font-mono">ID: {currentCust.customerId || currentCust.id || currentCust._id}</span>
                  {currentCust.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" /> {currentCust.phone}
                    </span>
                  )}
                  {currentCust.email && (
                    <span className="flex items-center gap-1 font-mono">
                      <Mail className="w-3 h-3 text-slate-400" /> {currentCust.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs text-slate-400 font-medium">Total Eligible Spend</div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                ₹{totalSpent.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Location & Card Strip */}
          <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="truncate" title={currentCust.fullAddress || currentCust.street || 'Tamil Nadu'}>
                {currentCust.district ? `${currentCust.district} • ` : ''}
                {currentCust.division ? `${currentCust.division} Division • ` : ''}
                PIN: {currentCust.pincode || '—'}
              </span>
            </div>
            {currentCust.membership?.cardNumber ? (
              <div className="flex items-center gap-1.5 sm:justify-end">
                <CreditCard className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Card No: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{currentCust.membership.cardNumber}</strong></span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:justify-end text-slate-400">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Non-Card Customer</span>
              </div>
            )}
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`p-3 rounded-xl border text-center ${
            isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-blue-50/50 border-blue-100'
          }`}>
            <div className="text-xs text-slate-500 font-medium">Total Orders</div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
              {totalOrders}
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-center ${
            isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-purple-50/50 border-purple-100'
          }`}>
            <div className="text-xs text-slate-500 font-medium">Total Bookings</div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5 font-mono">
              {totalBookings}
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-center ${
            isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-emerald-50/50 border-emerald-100'
          }`}>
            <div className="text-xs text-slate-500 font-medium">Successful Spend</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
              ₹{totalSpent.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === 'orders'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Orders ({orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === 'bookings'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Bookings ({bookings.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadCustomerHistory}
            disabled={loading}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 pb-2 flex items-center gap-1 cursor-pointer"
            title="Refresh transactions"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading customer transaction history...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : activeTab === 'orders' ? (
          /* TAB A: ORDERS */
          <div>
            {orders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-1">
                <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">
                  No orders found for this customer
                </p>
                <p className="text-[11px] text-slate-400">
                  This customer has not placed any physical or product commerce orders yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className={`text-[11px] uppercase font-bold tracking-wider border-b ${
                    isDark ? 'bg-slate-800/60 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    <tr>
                      <th className="px-3.5 py-2.5">Order ID</th>
                      <th className="px-3.5 py-2.5">Date & Time</th>
                      <th className="px-3.5 py-2.5">Product / Item</th>
                      <th className="px-3.5 py-2.5">Category</th>
                      <th className="px-3.5 py-2.5 text-center">Qty</th>
                      <th className="px-3.5 py-2.5 text-right">Amount</th>
                      <th className="px-3.5 py-2.5">Payment</th>
                      <th className="px-3.5 py-2.5">Order Status</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                    {orders.map((ord, idx) => (
                      <tr key={idx} className={isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/60'}>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {ord.orderId}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">
                          {ord.orderDate}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-white max-w-[200px] truncate" title={ord.productName}>
                          {ord.productName}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500">
                          {ord.category}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono font-semibold">
                          {ord.quantity}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ₹{Number(ord.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            String(ord.paymentStatus).toLowerCase() === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800'
                          }`}>
                            {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {ord.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* TAB B: BOOKINGS */
          <div>
            {bookings.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-1">
                <Calendar className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">
                  No bookings found for this customer
                </p>
                <p className="text-[11px] text-slate-400">
                  This customer has not made any Service, Stay, or Travel reservations.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className={`text-[11px] uppercase font-bold tracking-wider border-b ${
                    isDark ? 'bg-slate-800/60 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    <tr>
                      <th className="px-3.5 py-2.5">Booking ID</th>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Category</th>
                      <th className="px-3.5 py-2.5">Booked Service / Room</th>
                      <th className="px-3.5 py-2.5">Schedule</th>
                      <th className="px-3.5 py-2.5 text-right">Amount</th>
                      <th className="px-3.5 py-2.5">Payment</th>
                      <th className="px-3.5 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                    {bookings.map((bkg, idx) => (
                      <tr key={idx} className={isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/60'}>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-purple-600 dark:text-purple-400">
                          {bkg.bookingId}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">
                          {bkg.bookingDate}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {getBookingCategoryBadge(bkg.category)}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-white max-w-[200px] truncate" title={bkg.serviceName}>
                          {bkg.serviceName}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">
                          {bkg.schedule}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ₹{Number(bkg.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            String(bkg.paymentStatus).toLowerCase() === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800'
                          }`}>
                            {bkg.paymentStatus}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {bkg.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default CustomerDetailsModal;
