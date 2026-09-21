import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { TechnicianDetailsModal } from '../../components/TechnicianDetailsModal';
import {
  Wrench,
  Phone,
  Star,
  MapPin,
  CheckCircle2,
  Clock,
  Briefcase
} from 'lucide-react';

export function StateTechnicians() {
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTechnician, setSelectedTechnician] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getTechnicians();
      if (res.success) {
        setTechs(res.technicians || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute 4 KPI stats
  const kpiStats = useMemo(() => {
    const totalTechnicians = techs.length;
    const available = techs.filter(t => (t.status || '').toLowerCase() === 'available').length;
    const busy = techs.filter(t => (t.status || '').toLowerCase() === 'busy').length;
    const completedJobs = techs.reduce(
      (acc, t) => acc + (Number(t.completedJobs ?? t.jobsCompleted) || 0),
      0
    );

    return {
      totalTechnicians,
      available,
      busy,
      completedJobs
    };
  }, [techs]);

  const columns = [
    {
      header: 'TECHNICIAN',
      accessor: (row) => `${row.name} ${row.phone}`,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white text-xs">{row.name}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{row.phone}</span>
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'SKILL SPECIALTY',
      accessor: (row) => row.skillSpecialty || row.specialization || (Array.isArray(row.skills) ? row.skills.join(', ') : ''),
      render: (row) => {
        const skill = row.skillSpecialty || row.specialization || (Array.isArray(row.skills) ? row.skills.join(', ') : 'Field Technician');
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200/80 dark:border-blue-900/50">
            <Wrench className="w-3 h-3 text-blue-500 shrink-0" />
            <span>{skill}</span>
          </span>
        );
      }
    },
    {
      header: 'LOCATION / PINCODE',
      accessor: (row) => `${row.pincode} ${row.district}`,
      render: (row) => (
        <div className="text-xs">
          <div className="font-mono text-blue-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-blue-500 dark:text-emerald-400 shrink-0" />
            <span>PIN: {row.pincode}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pl-4.5 mt-0.5">
            {row.district ? `${row.district}${row.division ? `, ${row.division}` : ''}` : '-'}
          </div>
        </div>
      )
    },
    {
      header: 'RATING & JOBS',
      accessor: 'rating',
      render: (row) => {
        const jobsCount = Number(row.completedJobs ?? row.jobsCompleted) || 0;
        return (
          <div className="text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
              <span>{row.rating ? Number(row.rating).toFixed(1) : '4.8'}</span>
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                ({jobsCount.toLocaleString()} jobs)
              </span>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 pl-5">
              Completed
            </div>
          </div>
        );
      }
    },
    {
      header: 'STATUS',
      accessor: 'status',
      className: 'whitespace-nowrap min-w-[100px]',
      render: (row) => <StatusBadge status={row.status || 'Available'} />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">State Technicians Roster</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Certified technicians and field service engineers operating across all State districts.
        </p>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Technicians */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Technicians</span>
            <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.totalTechnicians.toLocaleString()}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
            Registered technical staff
          </div>
        </div>

        {/* KPI 2: Available */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Available</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.available.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Ready for dispatch
          </div>
        </div>

        {/* KPI 3: Busy */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Busy</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.busy.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Active service assignments
          </div>
        </div>

        {/* KPI 4: Completed Jobs */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Completed Jobs</span>
            <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.completedJobs.toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
            Resolved field tickets
          </div>
        </div>
      </div>

      {/* Main Technicians Table */}
      <DataTable
        title="Active Field Technicians"
        subtitle="Manage service personnel performance, availability, and job dispatch"
        columns={columns}
        data={techs}
        loading={loading}
        onRefresh={loadData}
        onRowClick={(row) => setSelectedTechnician(row)}
        searchPlaceholder="Search technician name, phone, skill, or pincode..."
        exportFileName="state_technicians_roster.csv"
      />

      {/* Technician Details Modal */}
      <TechnicianDetailsModal
        isOpen={Boolean(selectedTechnician)}
        onClose={() => setSelectedTechnician(null)}
        technician={selectedTechnician}
      />
    </div>
  );
}
