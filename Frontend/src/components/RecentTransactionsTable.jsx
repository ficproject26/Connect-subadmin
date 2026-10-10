import React, { useState, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  User,
  Store,
  MapPin,
  Package,
  CreditCard,
  Tag,
  Eye,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { OrderDetailsModal } from './OrderDetailsModal';

export function RecentTransactionsTable({ orders = [], loading = false }) {
  const { isDark } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fmt = (val) => {
    if (val === undefined || val === null || val === '') return '₹0';
    const num = Number(val);
    if (isNaN(num)) return `₹${val}`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  // Extract unique categories from actual dataset
  const availableCategories = useMemo(() => {
    const cats = new Set();
    orders.forEach(o => {
      const c = o.category || o.type;
      if (c && c !== '-') cats.add(c);
    });
    return Array.from(cats).sort();
  }, [orders]);

  // Filter dataset based on search, category, and payment status
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Search query
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(o => {
        return (
          String(o.orderNumber || o.reference || '').toLowerCase().includes(q) ||
          String(o.customerName || '').toLowerCase().includes(q) ||
          String(o.customerMobile || '').toLowerCase().includes(q) ||
          String(o.customerId || '').toLowerCase().includes(q) ||
          String(o.vendorName || '').toLowerCase().includes(q) ||
          String(o.vendorId || '').toLowerCase().includes(q) ||
          String(o.productName || '').toLowerCase().includes(q) ||
          String(o.category || o.type || '').toLowerCase().includes(q) ||
          String(o.pincode || '').toLowerCase().includes(q) ||
          String(o.district || '').toLowerCase().includes(q)
        );
      });
    }

    // Category filter
    if (selectedCategory !== 'ALL') {
      result = result.filter(o => (o.category || o.type) === selectedCategory);
    }

    // Payment status filter
    if (selectedPaymentStatus !== 'ALL') {
      result = result.filter(o => {
        const pStatus = (o.paymentStatus || '').toLowerCase();
        if (selectedPaymentStatus === 'Paid') return pStatus === 'paid';
        if (selectedPaymentStatus === 'Pending') return pStatus.includes('pending');
        if (selectedPaymentStatus === 'Failed/Refunded') {
          return pStatus.includes('fail') || pStatus.includes('refund') || pStatus.includes('cancel');
        }
        return true;
      });
    }

    return result;
  }, [orders, searchTerm, selectedCategory, selectedPaymentStatus]);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedPaymentStatus, pageSize]);

  // Pagination calculation
  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, startIndex, pageSize]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;

    const headers = [
      'S.No.',
      'Order / Ref ID',
      'Date & Time',
      'Customer Name',
      'Customer Mobile',
      'Customer ID',
      'Vendor / Merchant',
      'Vendor ID',
      'Category',
      'Product / Item',
      'Gross Total (Rs)',
      'Discount (Rs)',
      'Net Payable (Rs)',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Pincode',
      'District',
      'State'
    ];

    const rows = filteredOrders.map((o, idx) => {
      const dateTime = o.dateTime || (o.orderDate ? (o.orderTime ? `${o.orderDate}, ${o.orderTime}` : o.orderDate) : '-');
      return [
        idx + 1,
        o.orderNumber || o.reference || '-',
        dateTime,
        o.customerName || '-',
        o.customerMobile || '-',
        o.customerId || '-',
        o.vendorName || '-',
        o.vendorId || '-',
        o.category || o.type || '-',
        o.productName || '-',
        o.grossTotal || o.totalAmount || 0,
        o.discountAmount || 0,
        o.netPayable || 0,
        o.paymentMethod || '-',
        o.paymentStatus || '-',
        o.status || o.orderStatus || '-',
        o.pincode || '-',
        o.district || '-',
        o.state || '-'
      ].map(val => `"${String(val).replace(/"/g, '""')}"`);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `business_transactions_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryColor = (cat) => {
    switch (String(cat).toLowerCase()) {
      case 'products':
        return isDark ? 'bg-blue-950/80 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200';
      case 'services':
        return isDark ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'travel':
        return isDark ? 'bg-sky-950/80 text-sky-300 border-sky-800' : 'bg-sky-50 text-sky-700 border-sky-200';
      case 'stay':
        return isDark ? 'bg-purple-950/80 text-purple-300 border-purple-800' : 'bg-purple-50 text-purple-700 border-purple-200';
      case 'food':
        return isDark ? 'bg-orange-950/80 text-orange-300 border-orange-800' : 'bg-orange-50 text-orange-700 border-orange-200';
      case 'daily needs':
        return isDark ? 'bg-teal-950/80 text-teal-300 border-teal-800' : 'bg-teal-50 text-teal-700 border-teal-200';
      case 'vendor subscription':
      case 'subscription':
        return isDark ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className={`rounded-2xl p-6 border transition-colors ${
      isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
    } space-y-4`}>
      {/* Table Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Recent Transactions &amp; Commerce Ledger
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"
            }`}>
              {totalItems} {totalItems === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"} mt-0.5`}>
            Live synchronized orders, bookings, and merchant transactions with chronological sequence
          </p>
        </div>

        {/* Action Controls: Search, Filters, CSV Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
              isDark ? "text-slate-400" : "text-slate-400"
            }`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ID, customer, vendor, PIN..."
              className={`w-full pl-8 pr-7 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                isDark ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500" : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400"
              }`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer ${
              isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <option value="ALL">All Categories</option>
            {availableCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Payment Status Filter */}
          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer ${
              isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Failed/Refunded">Refunded / Cancelled</option>
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={filteredOrders.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2"></div>
          <div>Loading live transaction records...</div>
        </div>
      ) : paginatedOrders.length === 0 ? (
        <div className="py-14 text-center text-slate-400 text-xs space-y-2">
          <AlertCircle className="w-6 h-6 mx-auto text-slate-400" />
          <div>No transaction records matching your current filters.</div>
          {(searchTerm || selectedCategory !== 'ALL' || selectedPaymentStatus !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('ALL');
                setSelectedPaymentStatus('ALL');
              }}
              className="text-xs text-blue-500 hover:underline font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className={`w-full text-left text-xs ${isDark ? "text-slate-300" : "text-slate-800"}`}>
            <thead className={`${
              isDark ? "bg-slate-950/60 text-slate-400 border-slate-800" : "bg-slate-50 text-slate-500 border-slate-200"
            } uppercase text-[10px] tracking-wider border-b`}>
              <tr>
                <th className="px-3 py-3 w-12 text-center">S.No.</th>
                <th className="px-4 py-3">Order / Ref ID</th>
                <th className="px-4 py-3">Customer Details</th>
                <th className="px-4 py-3">Vendor / Merchant</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Location (PIN)</th>
                <th className="px-4 py-3">Gross Total</th>
                <th className="px-4 py-3">Net Payable</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3">Order Status</th>
                <th className="px-3 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-slate-800/60" : "divide-slate-100"}`}>
              {paginatedOrders.map((o, idx) => {
                const serialNumber = startIndex + idx + 1;
                const dateDisplay = o.dateTime || (o.orderDate ? (o.orderTime ? `${o.orderDate}, ${o.orderTime}` : o.orderDate) : '-');

                return (
                  <tr
                    key={o.id || o.orderNumber || idx}
                    className={`${isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50"} transition-colors`}
                  >
                    {/* S.No. */}
                    <td className="px-3 py-3 text-center font-mono text-[11px] font-semibold text-slate-400">
                      {serialNumber}
                    </td>

                    {/* Order Number & Timestamp & Item */}
                    <td className="px-4 py-3">
                      <div className={`font-mono font-bold text-xs ${isDark ? "text-indigo-300" : "text-blue-600"}`}>
                        {o.orderNumber || o.reference || '-'}
                      </div>
                      <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"} mt-0.5 flex items-center gap-1`}>
                        <Clock className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                        <span>{dateDisplay}</span>
                      </div>
                      {o.productName && o.productName !== '-' && (
                        <div className={`text-[10px] italic ${isDark ? "text-slate-400" : "text-slate-500"} mt-0.5 truncate max-w-[150px]`} title={o.productName}>
                          <Package className="w-2.5 h-2.5 inline mr-1 text-slate-400" />
                          {o.productName}
                        </div>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <div className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                            {o.customerName || '-'}
                          </div>
                          {o.customerMobile && o.customerMobile !== '-' && (
                            <div className={`text-[10px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {o.customerMobile}
                            </div>
                          )}
                          {o.customerId && o.customerId !== '-' && (
                            <div className={`text-[10px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                              {String(o.customerId).startsWith('CUST') ? o.customerId : `CUST-${o.customerId}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Vendor */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <Store className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className={`font-semibold truncate max-w-[130px] ${isDark ? "text-white" : "text-slate-900"}`} title={o.vendorName}>
                            {o.vendorName || '-'}
                          </div>
                          {o.vendorId && o.vendorId !== '-' && (
                            <div className={`text-[9px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                              VID: {String(o.vendorId).slice(-6)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getCategoryColor(o.category || o.type)}`}>
                        {o.category || o.type || 'Products'}
                      </span>
                    </td>

                    {/* Location (PIN) */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          {o.pincode && o.pincode !== '-' && (
                            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                              PIN: {o.pincode}
                            </div>
                          )}
                          {o.division && o.division !== '-' && (
                            <div className={`text-[10px] font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                              {o.division}
                            </div>
                          )}
                          {(o.district || o.state) && (o.district !== '-' || o.state !== '-') && (
                            <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {[o.district !== '-' ? o.district : null, o.state !== '-' ? o.state : null].filter(Boolean).join(', ')}
                            </div>
                          )}
                          {(!o.pincode || o.pincode === '-') && (!o.district || o.district === '-') && (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Gross Total */}
                    <td className="px-4 py-3">
                      <div className={`font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {fmt(o.grossTotal || o.totalAmount)}
                      </div>
                      {o.discountAmount > 0 && (
                        <div className="text-[10px] text-amber-500 font-medium">
                          -{fmt(o.discountAmount)} disc.
                        </div>
                      )}
                    </td>

                    {/* Net Payable */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        {fmt(o.netPayable)}
                      </div>
                      {o.paymentMethod && o.paymentMethod !== '-' && (
                        <div className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                          {o.paymentMethod}
                        </div>
                      )}
                    </td>

                    {/* Payment Status */}
                    <td className="px-4 py-3">
                      {o.paymentStatus && o.paymentStatus !== '-' ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          String(o.paymentStatus).toLowerCase() === 'paid'
                            ? isDark ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : String(o.paymentStatus).toLowerCase().includes('pending')
                            ? isDark ? 'bg-amber-950/80 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200'
                            : isDark ? 'bg-rose-950/80 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {o.paymentStatus}
                        </span>
                      ) : <span className="text-slate-400">-</span>}
                    </td>

                    {/* Order Status */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isDark ? "bg-indigo-950 text-indigo-300 border-indigo-800" : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>
                        {o.status || o.orderStatus || '-'}
                      </span>
                    </td>

                    {/* Action: View Details */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedOrder(o);
                          setShowModal(true);
                        }}
                        className={`p-1.5 rounded-lg border transition hover:scale-105 cursor-pointer ${
                          isDark
                            ? "bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700"
                            : "bg-slate-50 border-slate-200 text-blue-600 hover:bg-slate-100"
                        }`}
                        title="View Full Transaction & Delivery Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && totalItems > 0 && (
        <div className={`pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
          isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"
        } text-xs`}>
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {startIndex + 1} - {Math.min(startIndex + pageSize, totalItems)}
            </span>
            <span>of</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{totalItems}</span>
            <span>transactions</span>

            <span className="mx-2 text-slate-300 dark:text-slate-700">|</span>

            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={`px-2 py-0.5 rounded border text-xs focus:outline-none ${
                isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className={`p-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal for Order Details */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}
