import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import { 
  Building2, 
  Mail, 
  Phone, 
  Eye, 
  GraduationCap, 
  Briefcase, 
  MapPin, 
  Calendar, 
  Award, 
  Layers, 
  ShieldCheck, 
  Hash,
  Clock
} from 'lucide-react';

export function StateDistrictAdmins() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    dataService.getDistricts()
      .then(res => {
        if (!isMounted) return;
        if (res?.success && res.districts) {
          const list = res.districts
            .filter(d => d.adminName && d.adminName !== 'Unassigned')
            .map(d => ({
              id: d.adminId || `ADM-${d.code || d.name}`,
              employeeCode: d.adminId || `ADM-${d.code || d.name}`,
              name: d.adminName,
              email: d.adminEmail || '-',
              phone: d.adminPhone || '-',
              district: d.name,
              code: d.code || d.id,
              status: d.status || 'Active',
              joinedDate: d.adminCreatedAt ? new Date(d.adminCreatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Active',
              divisionCount: d.divisions?.length || 0,
              pincodeCount: d.divisions?.reduce((s, div) => s + (div.pincodes?.length || 0), 0) || 0,
              qualification: d.adminQualification,
              course: d.adminCourse,
              institution: d.adminInstitution,
              passingYear: d.adminPassingYear,
              accountHolder: d.adminAccountHolder,
              bankName: d.adminBankName,
              accountNumber: d.adminAccountNumber,
              ifsc: d.adminIfsc,
              branch: d.adminBranch,
              loginId: d.adminLoginId,
              address: d.adminAddress,
              city: d.adminCity,
              pincode: d.adminPincode,
              avatarUrl: d.adminAvatarUrl
            }));
          setAdmins(list);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const columns = [
    {
      header: 'Name',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            isDark ? 'bg-indigo-950/80 text-cyan-300 border border-indigo-800/60' : 'bg-blue-100 text-blue-700 border border-blue-200'
          }`}>
            {row.name[0]}
          </div>
          <div>
            <div className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.name}</div>
            <div className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{row.employeeCode || row.id}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Email / Mobile Number',
      accessor: 'email',
      render: (row) => (
        <div className="space-y-0.5">
          <div className={`text-xs font-medium flex items-center gap-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="font-mono text-[11px]">{row.email}</span>
          </div>
          <div className={`text-xs flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="font-mono text-[11px]">{row.phone}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Assigned District',
      accessor: 'district',
      render: (row) => (
        <div>
          <span className={`font-bold text-xs flex items-center gap-1.5 ${isDark ? 'text-cyan-300' : 'text-blue-600'}`}>
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {row.district}
          </span>
          <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Code: {row.code}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          {row.status}
        </span>
      )
    },
    {
      header: 'View',
      accessor: 'actions',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedAdmin(row)}
          className={`inline-flex items-center justify-center p-2 rounded-lg border transition shadow-2xs cursor-pointer ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-cyan-300 hover:bg-slate-700 hover:text-white'
              : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-800'
          }`}
          title="View District Admin Profile"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>State District Administrators</h2>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Supervisory personnel and nodal officers assigned to executive district jurisdictions across {user?.state || 'Tamil Nadu'}.
        </p>
      </div>

      <DataTable
        title="District Admins Directory"
        subtitle="Roster of district administrators, contact channels and credential status"
        columns={columns}
        data={admins}
        loading={loading}
        searchPlaceholder="Search admin by name, district, or email..."
        exportFileName="state_district_admins.csv"
      />

      {/* District Admin Details Modal */}
      <Modal
        isOpen={!!selectedAdmin}
        onClose={() => setSelectedAdmin(null)}
        title="District Administrator Profile"
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
                    <span>District Administrator</span>
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
                    <span className="text-slate-500 dark:text-slate-400">Assigned District:</span>
                    <div className={`font-bold ${isDark ? 'text-cyan-300' : 'text-blue-600'}`}>
                      {selectedAdmin.district} (Code: {selectedAdmin.code})
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Supervisory Scope:</span>
                    <div className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                      {selectedAdmin.divisionsCount} Divisions • {selectedAdmin.pincodesCount} Pincodes
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
                  <span>Official Headquarters Address</span>
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
