import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  ArrowRight,
  Mail,
  Phone,
  GraduationCap,
  FileText,
  MapPin,
  Eye,
  Plus,
  User,
  Home,
  Landmark,
  ShieldCheck,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Upload,
  EyeOff,
  Layers,
  Users
} from 'lucide-react';
import { ALL_INDIAN_STATES, getDistrictsForState } from '../../utils/indiaPostalData';

const STEPS = [
  { id: 1, label: 'Personal',   icon: User },
  { id: 2, label: 'Address',    icon: Home },
  { id: 3, label: 'Document',   icon: FileText },
  { id: 4, label: 'Bank',       icon: Landmark },
  { id: 5, label: 'Assignment', icon: ShieldCheck },
  { id: 6, label: 'Login',      icon: KeyRound },
];

const EMPTY_FORM = {
  // step 1
  fullName: '', email: '', mobile: '', dob: '', profilePhoto: null, profilePhotoPreview: '',
  // step 2
  doorStreet: '', area: '', city: '', district: '', state: '', pincode: '',
  // step 3 - Documents
  aadharNumber: '', aadharPhoto: null, aadharPhotoPreview: '',
  panNumber: '', panPhoto: null, panPhotoPreview: '',
  // step 4
  accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '', branchName: '',
  // step 5
  assignedState: '', status: 'Active',
  // step 6
  loginId: '', password: '', confirmPassword: '',
};

function FieldInput({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function SuperAdminStates() {
  const { isDark } = useTheme();
  const { user: authUser } = useAuth();
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const navigate = useNavigate();

  // Add wizard state
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const fileRef = useRef();
  const aadharFileRef = useRef();
  const panFileRef = useRef();

  const setF = (patch) => setForm(f => ({ ...f, ...patch }));

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getStates();
      if (res.success && res.states) {
        setStates(res.states);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleToggleStatus = async (row) => {
    const currentStatus = row.status || 'Active';
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setStates(prev => prev.map(s => (s.id === row.id || s.name === row.name ? { ...s, status: newStatus } : s)));
    try {
      await dataService.updateStateStatus(row.id || row.name, newStatus);
    } catch (err) {
      console.error(err);
      setStates(prev => prev.map(s => (s.id === row.id || s.name === row.name ? { ...s, status: currentStatus } : s)));
    }
  };

  const handleSubmit = async () => {
    if (form.password !== form.confirmPassword) {
      setAddError('Password and Confirm Password do not match.');
      return;
    }
    setAddError('');
    setAddLoading(true);
    try {
      const payload = {
        // personal
        adminName: form.fullName,
        email: form.email,
        phone: form.mobile,
        dob: form.dob,
        // address
        address: [form.doorStreet, form.area, form.city].filter(Boolean).join(', '),
        city: form.city,
        districtAddr: form.district,
        state: form.state || form.assignedState,
        pincode: form.pincode,
        // documents
        aadharNumber: form.aadharNumber,
        panNumber: form.panNumber,
        // bank
        accountHolderName: form.accountHolderName,
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode,
        branchName: form.branchName,
        // assignment
        assignedState: form.assignedState,
        status: form.status,
        // login
        loginId: form.loginId,
        password: form.password || 'admin123',
      };

      const res = await dataService.addStateAdmin(payload);
      if (res.success) {
        setAddSuccess(res.message || 'State Admin registered successfully.');
        loadData();
      } else {
        setAddError(res.message || 'Failed to register State Admin.');
      }
    } catch (err) {
      setAddError(err.message || 'An error occurred. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setCurrentStep(1);
    setAddError('');
    setAddSuccess('');
    setShowAddModal(true);
  };

  const closeAdd = () => { setShowAddModal(false); setAddSuccess(''); setAddError(''); };

  const canNextStep = () => {
    if (currentStep === 1) return form.fullName.trim() && form.email.trim() && form.mobile.trim();
    if (currentStep === 5) return form.assignedState.trim();
    if (currentStep === 6) return form.loginId.trim() && form.password.length >= 6 && form.password === form.confirmPassword;
    return true;
  };

  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  }`;

  const columns = [
    {
      header: 'State Name / Code',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg border ${isDark ? 'bg-blue-950/80 border-blue-700/50 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.name}</div>
            <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Code: {row.code || row.id}</div>
          </div>
        </div>
      )
    },
    {
      header: 'State Sub-Admins',
      accessor: (row) => `${row.adminCount || 0} / 4 Admins`,
      render: (row) => {
        const count = row.adminCount || (row.admins?.length || 0);
        const limit = row.limit || 4;
        const isFull = count >= limit;
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isFull
                  ? isDark ? 'bg-amber-950/70 text-amber-300 border-amber-600/40' : 'bg-amber-50 text-amber-700 border-amber-200'
                  : count > 0
                  ? isDark ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <ShieldCheck className="w-3 h-3" />
                {count} / {limit} Sub-Admins {isFull && '(Max Quota)'}
              </span>
            </div>
            {row.admins && row.admins.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {row.admins.map((adm, idx) => (
                  <span
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); setSelectedAdmin({ ...adm, state: row.name }); }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border cursor-pointer hover:border-blue-400 transition ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <User className="w-2.5 h-2.5 text-blue-500" />
                    {adm.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic">No assigned admins yet</div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Districts / Divisions',
      accessor: (row) => `${row.districtsCount || 0} / ${row.divisionsCount || 0}`,
      render: (row) => {
        const dCount = row.districtsCount || (row.districts?.length || 0);
        const divCount = row.divisionsCount || 0;
        return (
          <div className="flex items-center gap-2 text-xs py-1">
            <span className={`inline-flex items-center justify-center min-w-[28px] px-2.5 py-1 rounded-lg border font-bold text-xs ${isDark ? 'bg-blue-950/60 border-blue-800/60 text-cyan-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>{dCount}</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">/</span>
            <span className={`inline-flex items-center justify-center min-w-[28px] px-2.5 py-1 rounded-lg border font-bold text-xs ${isDark ? 'bg-indigo-950/60 border-indigo-800/60 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>{divCount}</span>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const isActive = (row.status || 'Active') === 'Active';
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${isActive ? isDark ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200' : isDark ? 'bg-rose-950/70 text-rose-300 border-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
            {row.status || 'Active'}
          </span>
        );
      }
    },
    {
      header: 'Hierarchy Action',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate('/super-admin/districts'); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition shadow-xs cursor-pointer ${
              isDark
                ? 'bg-blue-950/80 border-blue-700/60 text-blue-300 hover:bg-blue-900'
                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <span>View Districts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  const renderWizardContent = () => {
    switch (currentStep) {
      // ===== STEP 1: Personal Details =====
      case 1:
        return (
          <div className="space-y-4">
            <FieldInput label="Full Name" required>
              <input type="text" className={inputCls} placeholder="e.g. Ramesh Kumar"
                value={form.fullName} onChange={e => setF({ fullName: e.target.value })} />
            </FieldInput>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Email Address" required>
                <input type="email" className={inputCls} placeholder="e.g. ramesh.karnataka@admin.com"
                  value={form.email} onChange={e => setF({ email: e.target.value })} />
              </FieldInput>
              <FieldInput label="Mobile Number" required>
                <input type="tel" className={inputCls} placeholder="10-digit mobile number" maxLength={10}
                  value={form.mobile} onChange={e => setF({ mobile: e.target.value.replace(/\D/g, '') })} />
              </FieldInput>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Date of Birth">
                <input type="date" className={inputCls}
                  value={form.dob} onChange={e => setF({ dob: e.target.value })} />
              </FieldInput>
              <FieldInput label="Profile Photo">
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed cursor-pointer transition ${
                    isDark ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400' : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                  }`}
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 truncate">
                    {form.profilePhoto ? form.profilePhoto.name : 'Upload Photo (Optional)'}
                  </span>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setF({ profilePhoto: file, profilePhotoPreview: URL.createObjectURL(file) });
                      }
                    }} />
                </div>
              </FieldInput>
            </div>
          </div>
        );

      // ===== STEP 2: Address Details =====
      case 2:
        return (
          <div className="space-y-4">
            <FieldInput label="Door No. / Street">
              <input type="text" className={inputCls} placeholder="e.g. 12/A, Gandhi Road"
                value={form.doorStreet} onChange={e => setF({ doorStreet: e.target.value })} />
            </FieldInput>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Area / Locality">
                <input type="text" className={inputCls} placeholder="e.g. Indiranagar"
                  value={form.area} onChange={e => setF({ area: e.target.value })} />
              </FieldInput>
              <FieldInput label="City / Town">
                <input type="text" className={inputCls} placeholder="e.g. Bengaluru"
                  value={form.city} onChange={e => setF({ city: e.target.value })} />
              </FieldInput>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Home District">
                <input type="text" className={inputCls} placeholder="e.g. Bengaluru Urban"
                  value={form.district} onChange={e => setF({ district: e.target.value })} />
              </FieldInput>
              <FieldInput label="PIN Code">
                <input type="text" className={inputCls} placeholder="6-digit PIN code" maxLength={6}
                  value={form.pincode} onChange={e => setF({ pincode: e.target.value.replace(/\D/g, '') })} />
              </FieldInput>
            </div>
          </div>
        );

      // ===== STEP 3: Document Details =====
      case 3:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Aadhaar Number">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="12-digit Aadhaar Number"
                  maxLength={12}
                  value={form.aadharNumber}
                  onChange={e => setF({ aadharNumber: e.target.value.replace(/\D/g, '') })}
                />
              </FieldInput>

              <FieldInput label="Aadhaar Photo">
                <div
                  onClick={() => aadharFileRef.current?.click()}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                    isDark ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400' : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                  }`}
                >
                  <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-500 truncate">
                    {form.aadharPhoto ? form.aadharPhoto.name : 'Upload Aadhaar Photo'}
                  </span>
                  <input
                    ref={aadharFileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setF({ aadharPhoto: file, aadharPhotoPreview: URL.createObjectURL(file) });
                      }
                    }}
                  />
                </div>
              </FieldInput>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="PAN Card Number">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="10-digit PAN (e.g. ABCDE1234F)"
                  maxLength={10}
                  value={form.panNumber}
                  onChange={e => setF({ panNumber: e.target.value.toUpperCase() })}
                />
              </FieldInput>

              <FieldInput label="PAN Photo">
                <div
                  onClick={() => panFileRef.current?.click()}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                    isDark ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400' : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                  }`}
                >
                  <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-500 truncate">
                    {form.panPhoto ? form.panPhoto.name : 'Upload PAN Photo'}
                  </span>
                  <input
                    ref={panFileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setF({ panPhoto: file, panPhotoPreview: URL.createObjectURL(file) });
                      }
                    }}
                  />
                </div>
              </FieldInput>
            </div>
          </div>
        );

      // ===== STEP 4: Bank Details =====
      case 4:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Account Holder Name">
                <input type="text" className={inputCls} placeholder="Name as per bank passbook"
                  value={form.accountHolderName} onChange={e => setF({ accountHolderName: e.target.value })} />
              </FieldInput>
              <FieldInput label="Bank Name">
                <input type="text" className={inputCls} placeholder="e.g. State Bank of India"
                  value={form.bankName} onChange={e => setF({ bankName: e.target.value })} />
              </FieldInput>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Account Number">
                <input type="text" className={inputCls} placeholder="e.g. 123456789012"
                  value={form.accountNumber} onChange={e => setF({ accountNumber: e.target.value.replace(/\D/g, '') })} />
              </FieldInput>
              <FieldInput label="IFSC Code">
                <input type="text" className={inputCls} placeholder="e.g. SBIN0001234" maxLength={11}
                  value={form.ifscCode} onChange={e => setF({ ifscCode: e.target.value.toUpperCase() })} />
              </FieldInput>
            </div>
            <FieldInput label="Branch Name">
              <input type="text" className={inputCls} placeholder="e.g. MG Road Branch"
                value={form.branchName} onChange={e => setF({ branchName: e.target.value })} />
            </FieldInput>
          </div>
        );

      // ===== STEP 5: Assignment =====
      case 5:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs ${isDark ? 'bg-blue-950/60 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
              <strong>Jurisdiction Policy:</strong> Each State can have a maximum of <strong>4 State Sub-Admins</strong> for distributed state oversight.
            </div>

            <FieldInput label="Assigned State" required>
              <select
                className={inputCls}
                value={form.assignedState}
                onChange={e => setF({ assignedState: e.target.value })}
              >
                <option value="">Select State to Assign</option>
                {ALL_INDIAN_STATES.map((st, idx) => {
                  const existing = states.find(s => s.name?.toLowerCase() === st.toLowerCase());
                  const count = existing?.adminCount || 0;
                  const isFull = count >= 4;
                  return (
                    <option key={idx} value={st} disabled={isFull}>
                      {st} — {count}/4 Sub-Admins {isFull ? '(FULL)' : '(Available)'}
                    </option>
                  );
                })}
              </select>
            </FieldInput>

            <FieldInput label="Account Status">
              <select className={inputCls} value={form.status} onChange={e => setF({ status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </FieldInput>
          </div>
        );

      // ===== STEP 6: Login Details =====
      case 6:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs ${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <strong>Important Rules:</strong> Login ID must be unique. Password must be at least 6 characters.
            </div>
            <FieldInput label="Login ID" required>
              <input type="text" className={inputCls} placeholder="e.g. state.karnataka.admin1"
                value={form.loginId} onChange={e => setF({ loginId: e.target.value })} />
            </FieldInput>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Password" required>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} className={inputCls} placeholder="Min 6 characters"
                    value={form.password} onChange={e => setF({ password: e.target.value })} />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FieldInput>
              <FieldInput label="Confirm Password" required>
                <div className="relative">
                  <input type={showConfirmPwd ? 'text' : 'password'} className={`${inputCls} ${form.confirmPassword && form.password !== form.confirmPassword ? '!border-rose-400 !ring-rose-100' : ''}`}
                    placeholder="Re-enter password"
                    value={form.confirmPassword} onChange={e => setF({ confirmPassword: e.target.value })} />
                  <button type="button" onClick={() => setShowConfirmPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-[10px] text-rose-500 mt-1 font-semibold">Passwords do not match</p>
                )}
              </FieldInput>
            </div>
            {/* Summary preview */}
            <div className={`p-3 rounded-xl border text-xs space-y-1 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <p className="font-semibold text-slate-600 dark:text-slate-300 mb-2">Registration Summary</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div><span className="text-slate-400">Name:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.fullName || '—'}</span></div>
                <div><span className="text-slate-400">Email:</span> <span className={`font-medium font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.email || '—'}</span></div>
                <div><span className="text-slate-400">Mobile:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.mobile || '—'}</span></div>
                <div><span className="text-slate-400">Assigned State:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.assignedState || '—'}</span></div>
                <div><span className="text-slate-400">Status:</span> <span className={`font-semibold ${form.status === 'Active' ? 'text-emerald-600' : 'text-rose-500'}`}>{form.status}</span></div>
                <div><span className="text-slate-400">Login ID:</span> <span className={`font-medium font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.loginId || '—'}</span></div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            State Sub-Admins Directory
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            National governance oversight. Add up to 4 State Sub-Admins per State jurisdiction.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add State Admin</span>
        </button>
      </div>

      <DataTable
        title="States Management Directory"
        subtitle="National roster of states and allocated State Sub-Admins (Max: 4 per state)"
        columns={columns}
        data={states}
        loading={loading}
        searchPlaceholder="Search by state name or admin..."
        exportFileName="national_states_sub_admins.csv"
      />

      {/* ===== State Admin Profile Modal ===== */}
      <Modal isOpen={!!selectedAdmin} onClose={() => setSelectedAdmin(null)} title="State Sub-Administrator Profile" maxWidth="max-w-2xl">
        {selectedAdmin && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${isDark ? 'bg-blue-950 border border-blue-700/60 text-cyan-300' : 'bg-blue-600 text-white shadow-sm'}`}>
                {selectedAdmin.name?.[0] || 'A'}
              </div>
              <div>
                <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedAdmin.name}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>State Sub-Administrator</span>
                  <span>•</span>
                  <span className="font-semibold text-blue-600 dark:text-cyan-300">{selectedAdmin.state}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-200'}`}>
                <span className="text-slate-400 block mb-1">Email Address</span>
                <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedAdmin.email || '—'}</span>
              </div>
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-200'}`}>
                <span className="text-slate-400 block mb-1">Mobile Number</span>
                <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedAdmin.phone || '—'}</span>
              </div>
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-200'}`}>
                <span className="text-slate-400 block mb-1">Login Username</span>
                <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedAdmin.loginId || selectedAdmin.email || '—'}</span>
              </div>
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-200'}`}>
                <span className="text-slate-400 block mb-1">Account Status</span>
                <span className={`font-bold ${selectedAdmin.status === 'Inactive' ? 'text-rose-500' : 'text-emerald-600'}`}>{selectedAdmin.status || 'Active'}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== Add State Admin Wizard Modal ===== */}
      <Modal isOpen={showAddModal} onClose={closeAdd} title="Add State Sub-Admin" maxWidth="max-w-2xl">
        <div className="space-y-5">
          {/* Step Indicator */}
          <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
            {STEPS.map((step) => {
              const StepIcon = step.icon;
              const isDone = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                      : isDark
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-[10px] mt-1 font-semibold hidden sm:block ${
                    isCurrent ? (isDark ? 'text-blue-400' : 'text-blue-600') : 'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Form Step Body */}
          {addError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {addError}
            </div>
          )}
          {addSuccess ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold text-sm">{addSuccess}</p>
              <button
                type="button"
                onClick={closeAdd}
                className="mt-2 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
              >
                Close & View Roster
              </button>
            </div>
          ) : (
            <>
              {renderWizardContent()}

              {/* Wizard Navigation Footer */}
              <div className="flex items-center justify-between pt-3 border-t dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setCurrentStep(s => Math.max(1, s - 1))}
                  disabled={currentStep === 1 || addLoading}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                    currentStep === 1
                      ? 'opacity-40 cursor-not-allowed border-transparent'
                      : isDark
                      ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                {currentStep < 6 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(s => Math.min(6, s + 1))}
                    disabled={!canNextStep()}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition ${
                      canNextStep()
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-md cursor-pointer'
                        : 'bg-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canNextStep() || addLoading}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {addLoading ? (
                      <span>Registering...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Complete Registration</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
