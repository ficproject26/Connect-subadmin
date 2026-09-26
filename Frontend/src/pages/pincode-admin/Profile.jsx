import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, MapPin, Mail, Calendar } from 'lucide-react';

export function PincodeProfile() {
  const { user } = useAuth();
  const pincode = user?.pincode || '';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pincode Administrator Profile</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Authenticated administrator credentials and micro-station authority.</p>
      </div>

      <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <img
            src={user?.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200'}
            alt="Admin"
            className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-md"
          />
          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{user?.name || 'Pincode Admin'}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 w-fit mx-auto sm:mx-0">
                Pincode Admin{pincode ? ` (PIN ${pincode})` : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Station Area: <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.areaName || 'Zone'}</span>, {user?.district || 'District'}
            </p>
            <div className="pt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                {user?.email || 'pincode_admin@admin.com'}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                PIN: {pincode || '-'} Control Station
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Active Since Jan 2026
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Micro-Location Isolation Mandate
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="font-semibold text-slate-900 dark:text-white">Strict Pincode Scope</div>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Authorized strictly for customers, vendors, orders, technicians, and agents within PIN {pincode}.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="font-semibold text-slate-900 dark:text-white">Cross-Pincode Block</div>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Cannot access or modify records from 636002, 636003, or any other pincode zones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
