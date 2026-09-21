import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Users, Store, ShoppingBag, ShieldCheck } from 'lucide-react';
import { HierarchyNavigator } from '../../components/HierarchyNavigator';

export function PincodeOverview() {
  const { user } = useAuth();
  const pincode = user?.pincode || '-';
  const areaName = user?.areaName || (pincode !== '-' ? `PIN ${pincode}` : 'Local Zone');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pincode Station Overview</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Geographic coverage, local demographic metrics, and terminal station status for PIN {pincode}.
        </p>
      </div>

      <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
              <MapPin className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Pincode {pincode} ({areaName})
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Station Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Division: {user?.division || '-'} • District: {user?.district || '-'} • State: {user?.state || '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium">Local Dispatch Office</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{areaName} Hub</div>
            </div>
          </div>
        </div>
      </div>

      <HierarchyNavigator />
    </div>
  );
}
