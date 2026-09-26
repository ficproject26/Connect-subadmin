import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { 
  ShieldCheck, 
  MapPin, 
  Phone, 
  Mail, 
  Building2, 
  Eye, 
  Layers, 
  User, 
  CheckCircle2,
  Calendar,
  CreditCard,
  FileText
} from 'lucide-react';

export function DivisionalPincodeAdmins() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const divisionName = user?.division || '';

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const res = await dataService.getPincodes(divisionName ? { division: divisionName } : {});
      if (res.success && res.pincodes) {
        const norm = (s) => (s || '').toLowerCase().replace(/\s+division/g, '').replace(/^div-/, '').trim();
        const divNorm = norm(divisionName);

        const registered = res.pincodes
          .filter(p => {
            const isAssigned = p.adminName && p.adminName !== 'Unassigned';
            if (!isAssigned) return false;
            if (!divNorm) return true;
            const pDiv = norm(p.division || p.divisionName);
            return pDiv === divNorm || pDiv.includes(divNorm) || divNorm.includes(pDiv);
          })
          .map(p => ({
            id: p.adminId || `ADM-PIN-${p.pincode}`,
            employeeCode: p.employeeCode || `EMP-${p.pincode}`,
            name: p.adminName,
            email: p.adminEmail || '-',
            phone: p.adminPhone || '-',
            pincode: p.pincode,
            area: p.areaName || `${p.division || divisionName} Hub`,
            division: p.division || p.divisionName || divisionName,
            district: p.district || p.districtName || user?.district || '',
            state: p.state || user?.state || '',
            status: p.status || 'Active',
            joinedDate: p.adminCreatedAt ? new Date(p.adminCreatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Active',
            address: p.adminAddress || `Pincode Station ${p.pincode}`,
            dob: p.adminDob || '-',
            city: p.adminCity || '-',
            aadharNumber: p.adminAadharNumber || '-',
            panNumber: p.adminPanNumber || '-',
            accountHolder: p.adminAccountHolder || '-',
            bankName: p.adminBankName || '-',
            accountNumber: p.adminAccountNumber || '-',
            ifsc: p.adminIfsc || '-',
            branch: p.adminBranch || '-'
          }));
        setAdmins(registered);
      }
    } catch (err) {
      console.error('Failed to fetch divisional pincode admins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, [user]);

  const columns = [
    {
      header: 'PINCODE ADMINISTRATOR',
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
      header: 'EMAIL / MOBILE NUMBER',
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
      header: 'ASSIGNED PINCODE',
      accessor: 'pincode',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border shrink-0 ${
            isDark ? 'bg-indigo-950/60 border-indigo-800/50 text-indigo-400' : 'bg-blue-50 border-blue-100 text-blue-600'
          }`}>
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className={`font-mono font-bold text-xs ${isDark ? 'text-cyan-300' : 'text-blue-600'}`}>
              PIN: {row.pincode}
            </span>
            <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{row.area}</div>
          </div>
        </div>
      )
    },
    {
      header: 'DIVISION & DISTRICT',
      accessor: 'division',
      render: (row) => (
        <div className="text-xs">
          <div className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{row.division} Division</div>
          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{row.district}</div>
        </div>
      )
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
      header: 'ACTION',
      accessor: 'actions',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAdmin(row);
          }}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5 text-blue-500" />
          <span>Details</span>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Supervised Pincode Admins
        </h2>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Pincode administrators operating under {divisionName} Division jurisdiction.
        </p>
      </div>

      <DataTable
        title={`Pincode Administrators in ${divisionName} Division`}
        subtitle="Manage and monitor appointed local administrators across assigned pincodes"
        columns={columns}
        data={admins}
        loading={loading}
        onRefresh={loadAdmins}
        searchPlaceholder="Search admin name, pincode, email..."
        exportFileName="divisional_pincode_admins.csv"
        onRowClick={(row) => setSelectedAdmin(row)}
      />

      {/* Admin Details Modal */}
      <Modal
        isOpen={!!selectedAdmin}
        onClose={() => setSelectedAdmin(null)}
        title="Pincode Administrator Profile"
        maxWidth="max-w-2xl"
      >
        {selectedAdmin && (
          <div className="space-y-5">
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
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Pincode Administrator</span>
                    <span>•</span>
                    <span className="font-mono">PIN: {selectedAdmin.pincode}</span>
                  </div>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {selectedAdmin.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl border space-y-3 ${
                isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
              }`}>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-2">
                  <Phone className="w-3.5 h-3.5 text-blue-500" />
                  <span>Contact Information</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">Official Email:</span>
                    <div className="font-mono font-medium">{selectedAdmin.email}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Mobile Number:</span>
                    <div className="font-mono font-medium">{selectedAdmin.phone}</div>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border space-y-3 ${
                isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
              }`}>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Jurisdiction & Address</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">Assigned Pincode:</span>
                    <div className="font-bold text-blue-600">{selectedAdmin.pincode} ({selectedAdmin.area})</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Hierarchy:</span>
                    <div>{selectedAdmin.division} Division, {selectedAdmin.district}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
