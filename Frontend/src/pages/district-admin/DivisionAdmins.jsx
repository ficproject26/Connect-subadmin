import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { ShieldCheck, Mail, Phone, Layers } from 'lucide-react';

export function DistrictDivisionAdmins() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (user?.district) params.district = user.district;
      if (user?.districtId) params.districtId = user.districtId;
      if (user?.state) params.state = user.state;

      const res = await dataService.getDivisions(params);
      if (res?.success && Array.isArray(res.divisions)) {
        // Enforce Requirement 18: Show ONLY divisions that currently have an assigned Division Admin
        const assignedOnly = res.divisions
          .filter(d => {
            const adminName = d.adminName || d.assignedAdmin;
            return Boolean(adminName && adminName !== 'Unassigned' && adminName !== '-' && d.status !== 'Suspended');
          })
          .map(d => ({
            id: d.adminId || `ADM-DIV-${d.id || d._id}`,
            name: d.adminName || d.assignedAdmin,
            email: d.adminEmail || '-',
            phone: d.adminPhone || '-',
            division: d.name || d.divisionName,
            district: d.districtName || d.district || user?.district,
            pincodes: Array.isArray(d.pincodes) ? d.pincodes : [],
            status: d.status || 'Active'
          }));
        setAdmins(assignedOnly);
      } else {
        setAdmins([]);
      }
    } catch (err) {
      console.error('Failed to load district division admins:', err);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const columns = [
    {
      header: 'Division Administrator',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
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
      header: 'Assigned Division',
      accessor: 'division',
      render: (row) => (
        <span className="font-bold text-blue-600 dark:text-cyan-300 text-xs">
          {row.division} Division
        </span>
      )
    },
    {
      header: 'Covered Pincodes',
      accessor: (row) => (row.pincodes || []).join(' '),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.pincodes && row.pincodes.length > 0 ? (
            row.pincodes.map(p => (
              <span key={p} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                PIN: {p}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">None assigned</span>
          )}
        </div>
      )
    },
    {
      header: 'Contact Phone',
      accessor: 'phone',
      render: (row) => <span className="text-xs text-slate-600 dark:text-slate-300 font-mono">{row.phone}</span>
    },
    {
      header: 'Jurisdiction Status',
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Supervised Division Administrators</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Divisional tier administrators appointed across {user?.district ? `${user.district} District` : 'assigned district'} divisions.
        </p>
      </div>

      <DataTable
        title="Division Admins Directory"
        subtitle="Manage subordinate division administrators and access credentials"
        columns={columns}
        data={admins}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search division admin..."
        exportFileName="district_division_admins.csv"
      />
    </div>
  );
}
