import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { User, Store, MapPin, Package, CreditCard, Tag } from 'lucide-react';

export function RecentTransactionsTable({ orders = [], loading = false }) {
  const { isDark } = useTheme();

  const fmt = (val) => {
    if (val === undefined || val === null || val === '') return '₹0';
    const num = Number(val);
    if (isNaN(num)) return `₹${val}`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  return (
    <div className={`rounded-2xl p-6 border transition-colors ${
      isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
    } space-y-4`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
            Recent Transactions & Dispatches
          </h3>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Live synchronized orders, merchant dispatches, and real customer settlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"
          }`}>
            {orders.length} {orders.length === 1 ? 'Transaction' : 'Transactions'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          Loading live transaction records...
        </div>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          No transaction records found in this jurisdiction.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className={`w-full text-left text-xs ${isDark ? "text-slate-300" : "text-slate-800"}`}>
            <thead className={`${
              isDark ? "bg-slate-950/60 text-slate-400 border-slate-800" : "bg-slate-50 text-slate-500 border-slate-200"
            } uppercase text-[10px] tracking-wider border-b`}>
              <tr>
                <th className="px-4 py-3">Order Number & Details</th>
                <th className="px-4 py-3">Customer Details</th>
                <th className="px-4 py-3">Vendor / Merchant</th>
                <th className="px-4 py-3">Location (PIN)</th>
                <th className="px-4 py-3">Gross Total</th>
                <th className="px-4 py-3">Net Payable</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3">Order Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-slate-800/60" : "divide-slate-100"}`}>
              {orders.map((o, idx) => (
                <tr key={o.id || idx} className={`${isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50"} transition-colors`}>
                  {/* Order Number & Item */}
                  <td className="px-4 py-3">
                    <div className={`font-mono font-bold text-xs ${isDark ? "text-indigo-300" : "text-blue-600"}`}>
                      {o.orderNumber || '-'}
                    </div>
                    {o.orderDate && o.orderDate !== '-' && (
                      <div className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"} mt-0.5`}>
                        {o.orderDate}
                      </div>
                    )}
                    {o.productName && o.productName !== '-' && (
                      <div className={`text-[10px] italic ${isDark ? "text-slate-400" : "text-slate-500"} mt-0.5 truncate max-w-[140px]`} title={o.productName}>
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
                          <div className={`text-[10px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
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
                        {o.category && o.category !== '-' && (
                          <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {o.category}
                          </div>
                        )}
                        {o.vendorId && o.vendorId !== '-' && (
                          <div className={`text-[9px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                            VID: {String(o.vendorId).slice(-6)}
                          </div>
                        )}
                      </div>
                    </div>
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
                      {o.status || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
