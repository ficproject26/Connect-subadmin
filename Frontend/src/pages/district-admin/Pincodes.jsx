import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  GraduationCap
} from 'lucide-react';

const FALLBACK_STATE_PINCODES = [
  {
    id: 'pin_636112',
    pincode: '636112',
    areaName: 'Attur Hub',
    division: 'Attur',
    divisionName: 'Attur',
    district: 'Salem',
    districtName: 'Salem',
    state: 'Tamil Nadu',
    adminId: 'ADM-PIN-65273F',
    adminName: 'Charu',
    assignedAdmin: 'Charu',
    adminEmail: 'charu@gmail.com',
    adminPhone: '8765445678',
    status: 'Active',
    customerCount: 124
  },
  {
    id: 'pin_636114',
    pincode: '636114',
    areaName: 'Attur Hub',
    division: 'Attur',
    divisionName: 'Attur',
    district: 'Salem',
    districtName: 'Salem',
    state: 'Tamil Nadu',
    adminId: 'ADM-PIN-D8C325',
    adminName: 'Kumar',
    assignedAdmin: 'Kumar',
    adminEmail: 'kumar@gmail.com',
    adminPhone: '8765434567',
    status: 'Active',
    customerCount: 98
  }
];

export function DistrictPincodes() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [pincodes, setPincodes] = useState(FALLBACK_STATE_PINCODES);
  const [loading, setLoading] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const divisionFilter = searchParams.get('division');

  const getPincodeAdminDetails = (row) => {
    const adminName = row.adminName || row.assignedAdmin || 'Unassigned';
    return {
      id: row.adminId || `ADM-PIN-${row.pincode}`,
      employeeCode: row.employeeCode || '-',
      name: adminName,
      email: row.adminEmail || '-',
      phone: row.adminPhone || '-',
      emergencyPhone: '-',
      pincode: row.pincode,
      area: row.areaName || 'Assigned Zone',
      division: row.division || row.divisionName || '-',
      district: row.district || user?.district || 'Salem',
      state: user?.state || 'Tamil Nadu',
      totalCustomers: row.customerCount || 0,
      population: row.population || '-',
      status: row.status || 'Active',
      joinedDate: row.joinedDate || '-',
      qualification: row.qualification || '-',
      experience: row.experience || '-',
      specialization: row.specialization || '-',
      address: row.address || `Pincode Hub ${row.pincode}, ${row.district || ''}`
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let res = await dataService.getPincodes(divisionFilter ? { division: divisionFilter } : {});
      if (!res?.pincodes || res.pincodes.length === 0) {
        res = await dataService.getPincodes();
      }

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

      list.sort((a, b) => String(a.pincode).localeCompare(String(b.pincode)));

      setPincodes(list.length > 0 ? list : FALLBACK_STATE_PINCODES);
    } catch (e) {
      console.error('Failed to load district pincodes, using fallback:', e);
      setPincodes(FALLBACK_STATE_PINCODES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [divisionFilter]);

  const handleToggleStatus = async (row) => {
    const currentStatus = row.status || 'Active';
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    setPincodes(prev =>
      prev.map(p => (p.pincode === row.pincode ? { ...p, status: newStatus } : p))
    );

    try {
      await dataService.updatePincode(row.pincode, { status: newStatus });
    } catch (err) {
      console.error('Failed to update pincode status', err);
      setPincodes(prev =>
        prev.map(p => (p.pincode === row.pincode ? { ...p, status: currentStatus } : p))
      );
    }
  };

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
              <span>Filtered by Division: <strong className="text-blue-600 font-bold">{divisionFilter}</strong> in {user?.district || 'Salem'} District. Click any row to inspect Admin details.</span>
            ) : (
              <span>All registered pincode service zones and appointed local administrators across the District. Click a row to view Admin details.</span>
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
        subtitle="Manage pincode coverage and serviceability parameters. Click any row to inspect Admin details."
        columns={columns}
        data={pincodes}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search pincode or area name..."
        exportFileName="district_pincodes.csv"
        onRowClick={(row) => setSelectedAdmin(getPincodeAdminDetails(row))}
      />

      {/* Pincode Administrator Profile Modal */}
      <Modal
        isOpen={!!selectedAdmin}
        onClose={() => setSelectedAdmin(null)}
        title="Pincode Administrator Profile"
        maxWidth="max-w-2xl"
      >
        {selectedAdmin && (
          <div className="space-y-5">
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

            {/* Modal Actions */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedAdmin(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Close Profile
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
