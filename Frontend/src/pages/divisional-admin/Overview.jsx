import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Layers, MapPin, Users, Store, ShieldCheck } from 'lucide-react';
import { HierarchyNavigator } from '../../components/HierarchyNavigator';

export function DivisionalOverview() {
  const { user } = useAuth();
  const divisionName = user?.division || 'Division';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Division Overview & Territorial Tree</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Supervisory jurisdiction, pincode coverage, and operational topology for {divisionName} Division.
        </p>
      </div>

      <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <Layers className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {divisionName} Division Authority
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                District: {user?.district || '-'} • State: {user?.state || '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium">Division Headquarters</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{divisionName} Divisional Office</div>
            </div>
          </div>
        </div>
      </div>

      <HierarchyNavigator />
    </div>
  );
}
