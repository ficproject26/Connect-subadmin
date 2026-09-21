import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { ShieldCheck, MapPin } from 'lucide-react';

export function DistrictPincodeAdmins() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdmins = async () => {
      setLoading(true);
      try {
        const res = await dataService.getPincodes();
        if (res.success && res.pincodes) {
          const district = user?.district || 'Salem';
          const registered = res.pincodes
            .filter(p => p.adminName && p.adminName !== 'Unassigned' && (!district || p.district?.toLowerCase() === district.toLowerCase()))
            .map(p => ({
              id: p.adminId || `ADM-PIN-${p.pincode}`,
              name: p.adminName,
              email: p.adminEmail || '-',
              phone: p.adminPhone || '-',
              pincode: p.pincode,
              area: p.areaName || 'Assigned Zone',
              division: p.division || p.divisionName || '-',
              district: p.district || district,
              status: p.status || 'Active'
            }));
          setAdmins(registered);
        }
      } catch (err) {
        console.error('Failed to fetch district pincode admins:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAdmins();
  }, [user]);

  const columns = [
    {
      header: 'Pincode Administrator',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-xs">{row.name}</div>
            <div className="text-[11px] text-slate-500 font-mono">{row.email}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Assigned Pincode',
      accessor: 'pincode',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-blue-600 dark:text-emerald-300 text-xs">
            PIN: {row.pincode}
          </span>
          <div className="text-[11px] text-slate-500">{row.area}</div>
        </div>
      )
    },
    {
      header: 'Division',
      accessor: 'division',
      render: (row) => <span className="text-xs text-slate-700 dark:text-slate-300">{row.division}</span>
    },
    {
      header: 'Contact Phone',
      accessor: 'phone',
      render: (row) => <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">{row.phone}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40">
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pincode Administrators Roster</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Micro-level administrators appointed for each pincode station in {user?.district || 'Salem'} District.
        </p>
      </div>

      <DataTable
        title="Supervised Pincode Admins"
        subtitle="Review assigned officers per pincode service station"
        columns={columns}
        data={admins}
        searchPlaceholder="Search pincode admin or PIN..."
        exportFileName="district_pincode_admins.csv"
      />
    </div>
  );
}
