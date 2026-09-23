import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { useTheme } from '../../context/ThemeContext';
import { 
  Layers, 
  ArrowRight, 
  ArrowLeft,
  Mail,
  Phone,
  GraduationCap,
  Building2,
  MapPin,
  Store,
  UserCog,
  Users,
  ShieldAlert,
  Package,
  CalendarCheck,
  Briefcase,
  Truck,
  Wrench,
  Award,
  CreditCard
} from 'lucide-react';

export function StateDivisions() {
  const { isDark } = useTheme();
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [allPincodes, setAllPincodes] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const getAdminDetails = (row) => {
    const adminName = row.adminName || row.assignedAdmin || 'Unassigned';
    return {
      id: row.adminId || `ADM-DIV-${row.id || '001'}`,
      employeeCode: row.employeeCode || '-',
      name: adminName,
      email: row.adminEmail || '-',
      phone: row.adminPhone || '-',
      emergencyPhone: '-',
      division: row.name || row.divisionName || '-',
      code: row.id || (row.name ? `DIV-${row.name.slice(0, 3).toUpperCase()}` : '-'),
      district: row.districtName || row.district || '-',
      state: row.state || row.stateName || 'Tamil Nadu',
      pincodesCount: row.pincodes?.length || row.pincodesCount || 0,
      pincodes: row.pincodes || [],
      status: row.status || 'Active',
      joinedDate: row.joinedDate || '-',
      qualification: row.qualification || '-',
      experience: row.experience || '-',
      specialization: row.specialization || '-',
      address: row.address || `Divisional Office, ${row.name || ''}, ${row.districtName || ''}`
    };
  };

  const districtFilter = searchParams.get('district');

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, pinRes] = await Promise.all([
        dataService.getDivisions(),
        dataService.getPincodes().catch(() => ({ success: false }))
      ]);
      if (res.success) {
        let list = res.divisions || [];
        if (districtFilter) {
          list = list.filter(d => d.districtName?.toLowerCase() === districtFilter.toLowerCase());
        }
        // Only show divisions with registered admins
        list = list.filter(d => d.adminName && d.adminName.toLowerCase() !== 'unassigned' && d.adminName.trim() !== '-' && d.adminName.trim() !== '');
        setDivisions(list);
      }
      if (pinRes.success && pinRes.pincodes) {
        setAllPincodes(pinRes.pincodes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [districtFilter]);

  const handleToggleStatus = async (row) => {
    const currentStatus = row.status || 'Active';
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    // Optimistically update status in local state
    setDivisions(prev =>
      prev.map(d => (d.id === row.id || d.name === row.name ? { ...d, status: newStatus } : d))
    );

    try {
      await dataService.updateDivisionStatus(row.id || row.name, newStatus);
    } catch (err) {
      console.error('Failed to update division status', err);
      // Revert upon error
      setDivisions(prev =>
        prev.map(d => (d.id === row.id || d.name === row.name ? { ...d, status: currentStatus } : d))
      );
    }
  };

  const columns = [
    {
      header: 'DIVISION NAME / ID',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg border ${
            isDark ? 'bg-cyan-950/80 border-cyan-700/50 text-cyan-400' : 'bg-blue-50 border-blue-100 text-blue-600'
          }`}>
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.name}</div>
            <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ID: {row.id}</div>
          </div>
        </div>
      )
    },
    {
      header: 'ADMINS NAME',
      accessor: (row) => row.adminName || 'Unassigned',
      render: (row) => {
        const adminName = row.adminName || 'Unassigned';
        const adminEmail = row.adminEmail || `${(row.name || '').toLowerCase().replace(/\s+/g, '_')}_admin@admin.com`;
        return (
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              isDark ? 'bg-indigo-950/80 text-cyan-300 border border-indigo-800/60' : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}>
              {adminName[0]}
            </div>
            <div>
              <div className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {adminName}
              </div>
              <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {adminEmail}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'ASSIGNED PINCODES',
      accessor: (row) => row.pincodes?.length || 0,
      className: 'text-center',
      render: (row) => {
        const pinCount = row.pincodes?.length || 0;
        const tooltipDetails = row.pincodes?.join(', ');

        return (
          <div className="flex items-center justify-center py-1" title={tooltipDetails ? `Pincodes: ${tooltipDetails}` : ''}>
            <span className={`inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 rounded-lg border font-bold text-xs ${
              isDark
                ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              {pinCount}
            </span>
          </div>
        );
      }
    },
    {
      header: 'STATUS',
      accessor: 'status',
      render: (row) => {
        const isActive = (row.status || 'Active') === 'Active';
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isActive
              ? isDark
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : isDark
                ? 'bg-rose-950/70 text-rose-300 border-rose-500/30'
                : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        );
      }
    },
    {
      header: 'ACTIONS',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/state-admin/pincodes?division=${encodeURIComponent(row.name)}`);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition shadow-xs cursor-pointer ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            }`}
            title="View pincodes in this division"
          >
            <span>Pincodes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {districtFilter && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className={`p-1 rounded-lg border transition ${
                  isDark
                    ? 'hover:bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                    : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                }`}
                title="Show all divisions"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              State Divisions Management
            </h2>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {districtFilter ? (
              <span>Filtered by District: <strong className="text-blue-600 font-bold">{districtFilter}</strong>. Click a row to inspect details.</span>
            ) : (
              <span>Overview of all administrative divisions operating across this State. Click a row to inspect details.</span>
            )}
          </p>
        </div>

        {/* Drill down Breadcrumb */}
        <div className={`flex items-center gap-2 text-xs border rounded-xl px-3 py-1.5 font-mono ${
          isDark
            ? 'bg-slate-800/80 border-slate-700 text-slate-400'
            : 'bg-slate-100 border-slate-200 text-slate-600'
        }`}>
          <span>State</span>
          <span>&rarr;</span>
          <span className="font-bold">{districtFilter || 'Districts'}</span>
          <span>&rarr;</span>
          <span className="text-blue-600 font-bold">Divisions</span>
          <span>&rarr;</span>
          <span>Pincodes</span>
        </div>
      </div>

      <DataTable
        title={districtFilter ? `Divisions in ${districtFilter}` : "Divisions Directory"}
        subtitle="Hierarchical administration divisions under state jurisdiction. Click any row to inspect details."
        columns={columns}
        data={divisions}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search division name or district..."
        exportFileName="state_divisions.csv"
        onRowClick={(row) => {
          setSelectedAdmin(getAdminDetails(row));
          setSelectedDivision(row);
        }}
      />

      {/* Division Administrator Profile & Division Details Modal */}
      <Modal
        isOpen={!!selectedAdmin}
        onClose={() => { setSelectedAdmin(null); setSelectedDivision(null); }}
        title={selectedDivision ? `${selectedDivision.name} Division - Admin Profile & Operational Details` : "Division Administrator Profile & Details"}
        maxWidth="max-w-4xl"
      >
        {selectedAdmin && (() => {
          const div = selectedDivision || divisions.find(d => d.name?.toLowerCase() === selectedAdmin.division?.toLowerCase() || d.id === selectedAdmin.code);
          const divisionPincodes = div ? (
            (allPincodes && allPincodes.length > 0)
              ? allPincodes.filter(p => (p.division || p.divisionName)?.toLowerCase().replace(/\s+division/g, '') === (div.name || '').toLowerCase().replace(/\s+division/g, ''))
              : (div.pincodes || []).map(pin => ({ pincode: pin, areaName: `${div.name} Hub`, adminName: 'Assigned', status: 'Active' }))
          ) : [];

          const workforceMetrics = div ? [
            { label: 'Total Managers', value: div.totalManagers || 0, icon: UserCog, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50' },
            { label: 'Total Agents', value: div.totalAgents || 0, icon: Users, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/60 dark:text-violet-400 border-violet-100 dark:border-violet-900/50' },
            { label: 'Delivery Partner', value: div.deliveryPartner || 0, icon: Truck, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/60 dark:text-orange-400 border-orange-100 dark:border-orange-900/50' },
            { label: 'Technician', value: div.technician || 0, icon: Wrench, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400 border-purple-100 dark:border-purple-900/50' },
            { label: 'Executive', value: div.executive || 0, icon: Award, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-400 border-teal-100 dark:border-teal-900/50' },
            { label: 'Pending KYC', value: div.pendingKYC || 0, icon: ShieldAlert, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100 dark:border-amber-900/50' }
          ] : [];

          const commerceMetrics = div ? [
            { label: 'Total Vendors', value: div.totalVendors || 0, icon: Store, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400 border-blue-100 dark:border-blue-900/50' },
            { label: 'Total Orders', value: div.totalOrders || 0, icon: Package, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50' },
            { label: 'Total Bookings', value: div.totalBookings || 0, icon: CalendarCheck, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/50' },
            { label: 'Total Job Applied', value: div.totalJobApplied || 0, icon: Briefcase, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-400 border-sky-100 dark:border-sky-900/50' },
            { label: 'Total Membership Cards', value: (div.totalMembershipCards || 0)?.toLocaleString(), icon: CreditCard, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400 border-rose-100 dark:border-rose-900/50' }
          ] : [];

          return (
            <div className="space-y-6 max-h-[82vh] overflow-y-auto pr-1">
              {/* SECTION 1: DIVISION ADMINISTRATOR PROFILE */}
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                }`}>
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                      isDark ? 'bg-indigo-950 border border-indigo-700/60 text-cyan-300' : 'bg-blue-600 text-white shadow-sm'
                    }`}>
                      {(selectedAdmin.name || 'U')[0]}
                    </div>
                    <div>
                      <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {selectedAdmin.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>Division Administrator</span>
                        <span>•</span>
                        <span className="font-mono">{selectedAdmin.employeeCode}</span>
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {selectedAdmin.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Contact Card */}
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/60 pb-2">
                      <Phone className="w-3.5 h-3.5 text-blue-500" />
                      <span>Contact Information</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Official Email:</span>
                        <div className={`font-mono font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{selectedAdmin.email}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Mobile Number:</span>
                        <div className={`font-mono font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{selectedAdmin.phone}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Emergency Contact:</span>
                        <div className={`font-mono font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{selectedAdmin.emergencyPhone || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Jurisdiction Card */}
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/60 pb-2">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Jurisdiction & Scope</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Assigned Division:</span>
                        <div className={`font-bold ${isDark ? 'text-cyan-300' : 'text-blue-600'}`}>
                          {selectedAdmin.division} (Code: {selectedAdmin.code})
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Parent District:</span>
                        <div className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                          {selectedAdmin.district} District
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Supervisory Scope:</span>
                        <div className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                          {selectedAdmin.pincodesCount} Pincodes ({selectedAdmin.pincodes?.join(', ') || 'Covered'})
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Date of Appointment:</span>
                        <div className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{selectedAdmin.joinedDate}</div>
                      </div>
                    </div>
                  </div>

                  {/* Official Administrative Address */}
                  <div className={`p-4 rounded-xl border space-y-2 md:col-span-2 ${
                    isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/60 pb-2">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      <span>Official Divisional Secretariat Address</span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {selectedAdmin.address}
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: DIVISION DETAILS (DIRECTLY BELOW ADMIN PROFILE) */}
              {div && (
                <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  {/* Section Title Bar */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                    isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-gradient-to-r from-blue-50/90 to-cyan-50/60 border-blue-200/80'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {div.name} Division Operations & Territory Breakdown
                        </h4>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          ID: {div.id} • Parent District: <span className="font-semibold text-slate-800 dark:text-slate-200">{div.districtName || div.district}</span> • State: {div.stateName || div.state || 'Tamil Nadu'}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50 shrink-0">
                      {div.status || 'Active'}
                    </span>
                  </div>

                  {/* Quick KPI Stats Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-500 font-medium">Assigned Pincodes</div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                        {divisionPincodes.length > 0 ? divisionPincodes.length : (div.pincodesCount || div.pincodes?.length || 0)}
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-500 font-medium">Total Vendors</div>
                      <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400 mt-1">{div.totalVendors || 0}</div>
                    </div>
                    <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-500 font-medium">Total Customers</div>
                      <div className="text-lg font-bold text-violet-600 dark:text-violet-400 mt-1">{(div.totalCustomers || 0).toLocaleString()}</div>
                    </div>
                    <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-500 font-medium">Total Orders</div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{(div.totalOrders || 0).toLocaleString()}</div>
                    </div>
                    <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-500 font-medium">Bookings</div>
                      <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">{(div.totalBookings || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Pincodes under this Division */}
                  <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                    <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Pincodes under {div.name} Division ({divisionPincodes.length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/state-admin/pincodes?division=${encodeURIComponent(div.name)}`)}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open Pincodes Module</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="p-3">
                      {divisionPincodes.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                          {divisionPincodes.map((pin, idx) => (
                            <div key={idx} className={`p-2.5 rounded-lg border flex items-center justify-between ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                              <div>
                                <div className="font-mono font-bold text-slate-900 dark:text-white">PIN: {pin.pincode}</div>
                                <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{pin.areaName || pin.area || 'Zone Hub'}</div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block truncate max-w-[90px]">
                                  {pin.adminName || pin.assignedAdmin || 'Assigned'}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400">
                                  {pin.status || 'Active'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 p-2 text-center">
                          No pincodes registered under {div.name} Division yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dual-Panel Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Panel 1: Workforce */}
                    <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Workforce & Field Operations
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{workforceMetrics.length} Parameters</span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {workforceMetrics.map((m, idx) => {
                          const Icon = m.icon;
                          return (
                            <div key={idx} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                                <div className={`p-1.5 rounded-lg border ${m.color}`}><Icon className="w-3.5 h-3.5" /></div>
                                <span className="font-medium">{m.label}</span>
                              </div>
                              <span className="font-bold text-xs font-mono px-2 py-0.5 rounded-md border text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                {m.value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Panel 2: Commerce */}
                    <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Business, Orders & Commerce
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{commerceMetrics.length} Parameters</span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {commerceMetrics.map((m, idx) => {
                          const Icon = m.icon;
                          return (
                            <div key={idx} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                                <div className={`p-1.5 rounded-lg border ${m.color}`}><Icon className="w-3.5 h-3.5" /></div>
                                <span className="font-medium">{m.label}</span>
                              </div>
                              <span className="font-bold text-xs font-mono px-2 py-0.5 rounded-md border text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                {m.value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setSelectedAdmin(null); setSelectedDivision(null); }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer shadow-xs ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Close Details
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
