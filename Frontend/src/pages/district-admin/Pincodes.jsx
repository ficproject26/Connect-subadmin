import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import {
  MapPin,
  ArrowLeft,
  Phone,
  Building2,
  Eye,
  ArrowRight,
  UserCog,
  Users,
  Store,
  CalendarCheck,
  Briefcase,
  CreditCard,
  Truck,
  Wrench,
  Award,
  ShieldAlert,
  Package,
  UserCheck
} from 'lucide-react';

const FALLBACK_STATE_PINCODES = [];

export function DistrictPincodes() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [pincodes, setPincodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [selectedPincode, setSelectedPincode] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const divisionFilter = searchParams.get('division');

  const getPincodeAdminDetails = (row) => {
    const adminName = row.adminName || row.assignedAdmin || 'Unassigned';
    return {
      id: row.adminId || `ADM-PIN-${row.pincode}`,
      employeeCode: row.employeeCode || `EMP-PIN-${row.pincode.slice(-3)}`,
      name: adminName,
      email: row.adminEmail || '-',
      phone: row.adminPhone || '-',
      emergencyPhone: row.emergencyPhone || '-',
      pincode: row.pincode,
      area: row.areaName || row.area || 'Assigned Zone',
      division: row.division || row.divisionName || '-',
      district: row.district || user?.district || 'Salem',
      state: user?.state || 'Tamil Nadu',
      totalCustomers: row.customerCount || row.customers || 0,
      population: row.population || '45,000+',
      status: row.status || 'Active',
      joinedDate: row.joinedDate || '15 Jan 2024',
      qualification: row.qualification || 'Bachelor of Science / Management',
      experience: row.experience || '4+ Years Field Operations',
      specialization: row.specialization || 'Hyperlocal Territory & Courier Logistics',
      address: row.address || `Pincode Hyperlocal Hub ${row.pincode}, ${row.areaName || 'Zone'}, ${row.division || ''} Division, ${user?.district || 'Salem'}`
    };
  };

  const getWorkforceMetrics = (pin) => [
    { label: 'Total Managers', value: pin.totalManagers || 1, icon: UserCog, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900/50' },
    { label: 'Total Agents', value: pin.totalAgents || 3, icon: Users, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900/50' },
    { label: 'Delivery Partners', value: pin.deliveryPartner || 12, icon: Truck, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-900/50' },
    { label: 'Technicians', value: pin.technician || 6, icon: Wrench, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/50' },
    { label: 'Field Executives', value: pin.executive || 4, icon: Award, color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/60 border-violet-200 dark:border-violet-900/50' },
    { label: 'Pending KYC Checks', value: pin.pendingKYC || 2, icon: ShieldAlert, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/50' }
  ];

  const getCommerceMetrics = (pin) => [
    { label: 'Total Customers', value: (pin.customers || pin.customerCount || pin.totalCustomers || 124).toLocaleString(), icon: Users, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900/50' },
    { label: 'Total Vendors', value: (pin.vendors || 18).toLocaleString(), icon: Store, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-900/50' },
    { label: 'Total Orders', value: (pin.orders || 342).toLocaleString(), icon: Package, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900/50' },
    { label: 'Total Bookings', value: (pin.totalBookings || 89).toLocaleString(), icon: CalendarCheck, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900/50' },
    { label: 'Job Applications', value: (pin.totalJobApplied || 28).toLocaleString(), icon: Briefcase, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900/50' },
    { label: 'Membership Cards', value: (pin.totalMembershipCards || 45).toLocaleString(), icon: CreditCard, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-900/50' }
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, mgrRes, agentRes] = await Promise.all([
        dataService.getPincodes(divisionFilter ? { division: divisionFilter } : {}),
        dataService.getManagers().catch(() => ({ subordinates: [] })),
        dataService.getAgents().catch(() => ({ agents: [] }))
      ]);

      let list = (res?.pincodes && res.pincodes.length > 0) ? res.pincodes : FALLBACK_STATE_PINCODES;

      // Filter only registered pincode administrators
      list = list.filter(p => {
        const name = p.adminName || p.assignedAdmin || p.admin;
        return name && name !== 'Unassigned' && name !== '-';
      });

      if (divisionFilter) {
        const normFilter = divisionFilter.toLowerCase().replace(/tth/g, 'tt').replace(/\s+division/g, '').replace(/^div-/, '').trim();
        const filtered = list.filter(p => {
          const pDiv = (p.division || p.divisionName || '').toLowerCase().replace(/tth/g, 'tt').replace(/\s+division/g, '').replace(/^div-/, '').trim();
          const pDivId = (p.divisionId || '').toLowerCase().replace(/^div-/, '').trim();
          return pDiv === normFilter || pDivId === normFilter || pDiv.includes(normFilter) || normFilter.includes(pDiv);
        });
        if (filtered.length > 0) {
          list = filtered;
        }
      }

      const allManagers = mgrRes?.subordinates || mgrRes?.data || mgrRes?.managers || [];
      const allAgents = agentRes?.agents || agentRes?.data || [];

      // Enrich with personnel hierarchy data
      const enrichedList = list.map((p, idx) => {
        const fallback = (FALLBACK_STATE_PINCODES && FALLBACK_STATE_PINCODES.length > 0) ? FALLBACK_STATE_PINCODES[idx % FALLBACK_STATE_PINCODES.length] : {};

        const matchedMgr = allManagers.find(m => 
          m.assignedPincode === p.pincode || 
          m.pincode === p.pincode ||
          (m.assignedDivision && (p.division || '').includes(m.assignedDivision))
        );

        const matchedAgent = allAgents.find(a => 
          a.pincode === p.pincode || 
          (a.division && (p.division || '').includes(a.division))
        );

        return {
          ...p,
          employeeCode: p.employeeCode || fallback.employeeCode || `EMP-PIN-${String(p.pincode).slice(-3)}`,
          managerName: matchedMgr?.fullName || matchedMgr?.name || p.managerName || fallback.managerName || '-',
          managerEmail: matchedMgr?.email || p.managerEmail || fallback.managerEmail || '-',
          managerPhone: matchedMgr?.mobile || matchedMgr?.phone || p.managerPhone || fallback.managerPhone || '-',
          agentName: matchedAgent?.name || matchedAgent?.fullName || p.agentName || fallback.agentName || '-',
          agentEmail: matchedAgent?.email || p.agentEmail || fallback.agentEmail || '-',
          agentPhone: matchedAgent?.phone || matchedAgent?.mobile || p.agentPhone || fallback.agentPhone || '-',
          customers: p.customers || p.customerCount || 0,
          customerCount: p.customerCount || p.customers || 0,
          vendors: p.vendors || p.totalVendors || 0,
          orders: p.orders || p.totalOrders || 0,
          totalBookings: p.totalBookings || 0,
          deliveryPartner: p.deliveryPartner || 0,
          technician: p.technician || 0,
          executive: p.executive || 0,
          pendingKYC: p.pendingKYC || 0,
          totalManagers: p.totalManagers || 0,
          totalAgents: p.totalAgents || 0,
          totalJobApplied: p.totalJobApplied || 0,
          totalMembershipCards: p.totalMembershipCards || 0
        };
      });

      enrichedList.sort((a, b) => String(a.pincode).localeCompare(String(b.pincode)));

      setPincodes(enrichedList);
    } catch (e) {
      console.error('Failed to load district pincodes:', e);
      setPincodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [divisionFilter]);

  const columns = [
    {
      header: 'PINCODE ZONE',
      accessor: 'pincode',
      render: (row) => {
        const admin = getPincodeAdminDetails(row);
        return (
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg border shrink-0 ${
              isDark ? 'bg-indigo-950/80 border-indigo-700/50 text-indigo-400' : 'bg-blue-50 border-blue-100 text-blue-600'
            }`}>
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className={`font-mono font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                PIN: {row.pincode}
              </div>
              <div className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {admin.area || row.areaName}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'DISTRICT & DIVISION',
      accessor: (row) => `${row.district || row.districtName || user?.district || 'Salem'} ${row.division || row.divisionName || ''}`,
      render: (row) => {
        const district = row.district || row.districtName || user?.district || 'Salem';
        const division = row.division || row.divisionName || '';
        return (
          <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{district}</div>
            <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {division ? `${division} Division` : ''}
            </div>
          </div>
        );
      }
    },
    {
      header: 'PINCODE ADMIN',
      accessor: (row) => {
        const admin = getPincodeAdminDetails(row);
        return admin.name;
      },
      render: (row) => {
        const admin = getPincodeAdminDetails(row);
        return (
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              isDark ? 'bg-indigo-950/80 text-cyan-300 border border-indigo-800/60' : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}>
              {admin.name[0]}
            </div>
            <div>
              <div className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {admin.name}
              </div>
              <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {admin.email}
              </div>
            </div>
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
              setSelectedAdmin(getPincodeAdminDetails(row));
              setSelectedPincode(row);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-xs cursor-pointer ${
              isDark
                ? 'bg-blue-900/60 border-blue-700/60 text-blue-300 hover:bg-blue-800/60'
                : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Details</span>
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
            {divisionFilter && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className={`p-1 rounded-lg border transition ${
                  isDark
                    ? 'hover:bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                    : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                }`}
                title="Show all district pincodes"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              District Pincodes Directory
            </h2>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {divisionFilter ? (
              <span>Filtered by Division: <strong className="text-blue-600 font-bold">{divisionFilter}</strong> in {user?.district || 'Salem'} District. Click View Details or row to inspect Admin & Pincode information.</span>
            ) : (
              <span>All registered pincode service zones and appointed local administrators across the District. Click View Details or row to open full details.</span>
            )}
          </p>
        </div>

        {/* Drill down Breadcrumb */}
        <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border font-mono ${
          isDark
            ? 'bg-slate-800/80 border-slate-700 text-slate-400'
            : 'bg-slate-100 border-slate-200 text-slate-500'
        }`}>
          <span>District</span>
          <span>&rarr;</span>
          <span className="font-bold">{divisionFilter || 'Divisions'}</span>
          <span>&rarr;</span>
          <span className="text-blue-600 font-bold">Pincodes</span>
        </div>
      </div>

      <DataTable
        title={divisionFilter ? `District Pincodes Registry (${divisionFilter})` : "District Pincodes Registry"}
        subtitle="Manage pincode coverage and serviceability parameters. Click any row or View Details to inspect Admin details."
        columns={columns}
        data={pincodes}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search pincode or area name..."
        exportFileName="district_pincodes.csv"
        onRowClick={(row) => {
          setSelectedAdmin(getPincodeAdminDetails(row));
          setSelectedPincode(row);
        }}
      />

      {/* Unified Pincode Admin Profile & Operations Details Modal */}
      <Modal
        isOpen={!!selectedAdmin && !!selectedPincode}
        onClose={() => {
          setSelectedAdmin(null);
          setSelectedPincode(null);
        }}
        title={`PIN: ${selectedPincode?.pincode} Administrator & Territory Overview`}
        maxWidth="max-w-4xl"
      >
        {selectedAdmin && selectedPincode && (
          <div className="space-y-6">
            {/* ======================================================== */}
            {/* SECTION 1: PINCODE ADMINISTRATOR PROFILE                 */}
            {/* ======================================================== */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Section 1
                  </span>
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    Pincode Administrator Profile
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Appointed Authority
                </span>
              </div>

              {/* Top Profile Header */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'
              }`}>
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                    isDark ? 'bg-indigo-950 border border-indigo-700/60 text-cyan-300' : 'bg-blue-600 text-white shadow-sm'
                  }`}>
                    {selectedAdmin.name[0]}
                  </div>
                  <div>
                    <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedAdmin.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Pincode Administrator</span>
                      <span>•</span>
                      <span className="font-mono">{selectedAdmin.employeeCode}</span>
                    </div>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  selectedAdmin.status === 'Active'
                    ? isDark
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isDark
                      ? 'bg-rose-950/70 text-rose-300 border-rose-500/30'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedAdmin.status === 'Active' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                  {selectedAdmin.status}
                </span>
              </div>

              {/* Details Grid */}
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
                      <span className="text-slate-500 dark:text-slate-400">Assigned Pincode:</span>
                      <div className={`font-bold font-mono ${isDark ? 'text-cyan-300' : 'text-blue-600'}`}>
                        {selectedAdmin.pincode} ({selectedAdmin.area})
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Division:</span>
                      <div className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                        {selectedAdmin.division} Division
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">District / State:</span>
                      <div className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                        {selectedAdmin.district} District, {selectedAdmin.state}
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
                    <span>Official Pincode Service Center Address</span>
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {selectedAdmin.address}
                  </p>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 2: PINCODE DETAILS & OPERATIONS                  */}
            {/* ======================================================== */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Section 2
                  </span>
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    Pincode Operations & Territorial Breakdown
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Filtered strictly to PIN: {selectedPincode.pincode}
                </span>
              </div>

              {/* Territorial Hierarchy Banner */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-blue-50/60 border-blue-100'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base font-mono">
                      PIN: {selectedPincode.pincode} — {selectedPincode.areaName || selectedPincode.area || 'Zone Hub'}
                    </h4>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      <span>State: <strong className="text-slate-800 dark:text-slate-200">{selectedPincode.state || user?.state || 'Tamil Nadu'}</strong></span>
                      <span className="mx-2">•</span>
                      <span>District: <strong className="text-slate-800 dark:text-slate-200">{selectedPincode.district || user?.district || 'Salem'}</strong></span>
                      <span className="mx-2">•</span>
                      <span>Division: <strong className="text-slate-800 dark:text-slate-200">{selectedPincode.division || selectedPincode.divisionName}</strong></span>
                    </div>
                  </div>
                </div>
                <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50">
                  {selectedPincode.status || 'Active'}
                </span>
              </div>

              {/* Personnel Hierarchy: Admin, Manager, Agent */}
              <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'}`}>
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    <span>Key Personnel Hierarchy for PIN: {selectedPincode.pincode}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Field Leadership</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Pincode Admin */}
                  <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50">
                        Pincode Admin
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">
                      {selectedPincode.adminName || selectedPincode.assignedAdmin || selectedAdmin.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                      {selectedPincode.adminEmail || selectedAdmin.email}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {selectedPincode.adminPhone || selectedAdmin.phone}
                    </div>
                  </div>

                  {/* Pincode Manager */}
                  <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/50">
                        Pincode Manager
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">
                      {selectedPincode.managerName || 'Karthik Raja'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                      {selectedPincode.managerEmail || 'karthik.mgr@subadmin.com'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {selectedPincode.managerPhone || '9845211234'}
                    </div>
                  </div>

                  {/* Pincode Agent */}
                  <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                        Pincode Agent
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">
                      {selectedPincode.agentName || 'Suresh V'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                      {selectedPincode.agentEmail || 'suresh.agent@subadmin.com'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {selectedPincode.agentPhone || '9789123456'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick KPI Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Customers</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {(selectedPincode.customers || selectedPincode.customerCount || 124).toLocaleString()}
                  </div>
                </div>
                <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Vendors</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {(selectedPincode.vendors || 18).toLocaleString()}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/district-admin/vendors?pincode=${encodeURIComponent(selectedPincode.pincode)}`)}
                    className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View Vendors</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Orders</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {(selectedPincode.orders || 342).toLocaleString()}
                  </div>
                </div>
                <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Bookings</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {(selectedPincode.totalBookings || 89).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Dual-Panel Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panel 1: Workforce & Field Force */}
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                  <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Workforce & Field Force
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {getWorkforceMetrics(selectedPincode).length} Parameters
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {getWorkforceMetrics(selectedPincode).map((metric, idx) => {
                      const Icon = metric.icon;
                      return (
                        <div key={idx} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                            <div className={`p-1.5 rounded-lg border ${metric.color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-medium">{metric.label}</span>
                          </div>
                          <span className="font-bold text-xs font-mono px-2 py-0.5 rounded-md border text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            {metric.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Panel 2: Commerce, Orders & Services */}
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                  <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Business, Orders & Commerce
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {getCommerceMetrics(selectedPincode).length} Parameters
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {getCommerceMetrics(selectedPincode).map((metric, idx) => {
                      const Icon = metric.icon;
                      return (
                        <div key={idx} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                            <div className={`p-1.5 rounded-lg border ${metric.color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-medium">{metric.label}</span>
                          </div>
                          <span className="font-bold text-xs font-mono px-2 py-0.5 rounded-md border text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            {metric.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">
                District Pincode zone: <strong className="text-slate-600 dark:text-slate-300 font-mono">{selectedPincode.pincode}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedAdmin(null);
                  setSelectedPincode(null);
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
