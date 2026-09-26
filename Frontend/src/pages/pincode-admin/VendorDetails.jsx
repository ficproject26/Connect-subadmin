import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Store, MapPin, Phone, Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PincodeVendorDetails() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pincode = user?.pincode || '';

  const vendors = [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pincode Vendor Details</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          In-depth merchant profiles, contract parameters, and trade records for PIN {pincode || '-'}.
        </p>
      </div>

      {vendors.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] rounded-2xl">
          <Store className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="font-medium text-base text-slate-800 dark:text-slate-200">No vendors found</p>
          <p className="text-xs mt-1 text-slate-400">There are no vendor records available for PIN {pincode}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {vendors.map((v) => (
            <div
              key={v.id}
              className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950 text-orange-600">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{v.name}</h3>
                    <span className="text-[11px] text-slate-500 font-mono">ID: {v.id}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {v.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div><strong>Category:</strong> {v.category}</div>
                <div><strong>Merchant Contact:</strong> {v.owner} ({v.phone})</div>
                <div><strong>Store Address:</strong> {v.address}</div>
                <div><strong>Contract Commission:</strong> <span className="text-emerald-600 font-bold">{v.commissionRate}</span></div>
                <div><strong>Fulfilled Orders:</strong> {v.ordersCompleted} orders</div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => navigate('/pincode-admin/vendor-payments')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-slate-700 transition"
                >
                  <span>View Invoices & Payments</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
