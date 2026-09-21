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
  EyeOff
} from 'lucide-react';
import { getDistrictsForState, ALL_INDIAN_STATES } from '../../utils/indiaPostalData';

// ---------- helpers ----------
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
  assignedState: '', assignedDistrict: '', status: 'Active',
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

// ---------- main component ----------
export function StateDistricts() {
  const { isDark } = useTheme();
  const { user: authUser } = useAuth();
  const [districts, setDistricts] = useState([]);
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

  // ---- auto-fill assigned state from logged-in admin ----
  useEffect(() => {
    if (authUser?.state) setF({ assignedState: authUser.state, state: authUser.state });
  }, [authUser]);

  // ---- data load ----
  const fmt = (v) => (v && String(v).trim() !== '' ? v : null);
  const fmtDate = (v) => {
    if (!v) return null;
    try { return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return v; }
  };

  const getAdminDetails = (row) => ({
    id:               fmt(row.adminId) || `ADM-DST-${row.code || row.name?.slice(0,3).toUpperCase() || '001'}`,
    name:             fmt(row.adminName) || 'Unassigned',
    email:            fmt(row.adminEmail),
    phone:            fmt(row.adminPhone),
    dob:              fmtDate(row.adminDob),
    avatarUrl:        fmt(row.adminAvatarUrl),
    // address
    address:          fmt(row.adminAddress),
    city:             fmt(row.adminCity),
    pincode:          fmt(row.adminPincode),
    // district context
    district:         fmt(row.name),
    districtCode:     fmt(row.id) || fmt(row.code),
    state:            fmt(row.state) || 'Tamil Nadu',
    divisionsCount:   row.divisions?.length || 0,
    pincodesCount:    row.divisions?.reduce((s,d) => s + (d.pincodes?.length||0), 0) || 0,
    status:           fmt(row.status) || 'Active',
    joinedDate:       fmtDate(row.adminCreatedAt),
    // documents
    aadharNumber:     fmt(row.adminAadharNumber),
    panNumber:        fmt(row.adminPanNumber),
    // bank
    accountHolder:    fmt(row.adminAccountHolder),
    bankName:         fmt(row.adminBankName),
    accountNumber:    fmt(row.adminAccountNumber),
    ifsc:             fmt(row.adminIfsc),
    branch:           fmt(row.adminBranch),
    // login
    loginId:          fmt(row.adminLoginId),
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getDistricts();
      if (res.success) setDistricts(res.districts);
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
    setDistricts(prev => prev.map(d => (d.id === row.id || d.name === row.name ? { ...d, status: newStatus } : d)));
    try {
      await dataService.updateDistrictStatus(row.id || row.name, newStatus);
    } catch (err) {
      console.error(err);
      setDistricts(prev => prev.map(d => (d.id === row.id || d.name === row.name ? { ...d, status: currentStatus } : d)));
    }
  };

  // ---- wizard submit ----
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
        districtName: form.assignedDistrict,
        status: form.status,
        // login
        loginId: form.loginId,
        password: form.password || 'admin123',
      };

      const res = await dataService.addDistrictAdmin(payload);
      if (res.success) {
        setAddSuccess(res.message || 'District Admin registered successfully.');
        loadData();
      } else {
        setAddError(res.message || 'Failed to register District Admin.');
      }
    } catch (err) {
      setAddError(err.message || 'An error occurred. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, assignedState: authUser?.state || '', state: authUser?.state || '' });
    setCurrentStep(1);
    setAddError('');
    setAddSuccess('');
    setShowAddModal(true);
  };

  const closeAdd = () => { setShowAddModal(false); setAddSuccess(''); setAddError(''); };

  // ---- step validation ----
  const canNextStep = () => {
    if (currentStep === 1) return form.fullName.trim() && form.email.trim() && form.mobile.trim();
    if (currentStep === 5) return form.assignedDistrict.trim();
    if (currentStep === 6) return form.loginId.trim() && form.password.length >= 6 && form.password === form.confirmPassword;
    return true;
  };

  // ---- table columns ----
  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  }`;

  const columns = [
    {
      header: 'District Name / ID',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg border ${isDark ? 'bg-indigo-950/80 border-indigo-700/50 text-indigo-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.name}</div>
            <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ID: {row.id || row.code}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Admins Name',
      accessor: (row) => row.adminName || 'Unassigned',
      render: (row) => {
        const adminName = row.adminName || 'Unassigned';
        const adminEmail = row.adminEmail || '-';
        return (
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isDark ? 'bg-indigo-950/80 text-cyan-300 border border-indigo-800/60' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
              {adminName[0]}
            </div>
            <div>
              <div className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{adminName}</div>
              <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{adminEmail}</div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Division / Pincodes',
      accessor: (row) => {
        const divCount = row.divisionsCount !== undefined ? row.divisionsCount : (row.divisions?.length || 0);
        const pinCount = row.pincodesCount !== undefined ? row.pincodesCount : (row.divisions?.reduce((sum, d) => sum + (d.pincodes?.length || 0), 0) || 0);
        return `${divCount} / ${pinCount}`;
      },
      render: (row) => {
        const divCount = row.divisionsCount !== undefined ? row.divisionsCount : (row.divisions?.length || 0);
        const pinCount = row.pincodesCount !== undefined ? row.pincodesCount : (row.divisions?.reduce((sum, d) => sum + (d.pincodes?.length || 0), 0) || 0);
        return (
          <div className="flex items-center gap-2 text-xs py-1">
            <span className={`inline-flex items-center justify-center min-w-[28px] px-2.5 py-1 rounded-lg border font-bold text-xs ${isDark ? 'bg-blue-950/60 border-blue-800/60 text-cyan-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>{divCount}</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">/</span>
            <span className={`inline-flex items-center justify-center min-w-[28px] px-2.5 py-1 rounded-lg border font-bold text-xs ${isDark ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{pinCount}</span>
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
            {isActive ? 'Active' : 'Inactive'}
          </span>
        );
      }
    },
    {
      header: 'Hierarchy Action',
      accessor: 'actions',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/state-admin/divisions?district=${encodeURIComponent(row.name)}`); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-xs cursor-pointer ${isDark ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}
        >
          <span>View Divisions</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )
    }
  ];

  // ---- step content renderer ----
  const renderStep = () => {
    switch (currentStep) {
      // ===== STEP 1: Personal Details =====
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Full Name" required>
                <input type="text" className={inputCls} placeholder="e.g. Ananya Iyer"
                  value={form.fullName} onChange={e => setF({ fullName: e.target.value })} />
              </FieldInput>
              <FieldInput label="Email Address" required>
                <input type="email" className={inputCls} placeholder="e.g. admin@district.com"
                  value={form.email} onChange={e => setF({ email: e.target.value })} />
              </FieldInput>
              <FieldInput label="Mobile Number" required>
                <input type="tel" className={inputCls} placeholder="e.g. 9876543211"
                  value={form.mobile} onChange={e => setF({ mobile: e.target.value })} />
              </FieldInput>
              <FieldInput label="Date of Birth">
                <input type="date" className={inputCls}
                  value={form.dob} onChange={e => setF({ dob: e.target.value })} />
              </FieldInput>
            </div>
            {/* Profile Photo */}
            <FieldInput label="Profile Photo">
              <div className="flex items-center gap-4">
                {form.profilePhotoPreview ? (
                  <img src={form.profilePhotoPreview} alt="preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-blue-300 shadow" />
                ) : (
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed ${isDark ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-slate-50'}`}>
                    <User className="w-7 h-7 text-slate-400" />
                  </div>
                )}
                <div>
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${isDark ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                    <Upload className="w-3.5 h-3.5" /> Upload Photo
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">JPG, PNG up to 2MB</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setF({ profilePhoto: file, profilePhotoPreview: URL.createObjectURL(file) });
                    }} />
                </div>
              </div>
            </FieldInput>
          </div>
        );

      // ===== STEP 2: Address Details =====
      case 2:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldInput label="Door No / Street">
                <input type="text" className={inputCls} placeholder="e.g. 42, Meyyanur Main Road"
                  value={form.doorStreet} onChange={e => setF({ doorStreet: e.target.value })} />
              </FieldInput>
            </div>
            <FieldInput label="Area">
              <input type="text" className={inputCls} placeholder="e.g. Collectorate Area"
                value={form.area} onChange={e => setF({ area: e.target.value })} />
            </FieldInput>
            <FieldInput label="City">
              <input type="text" className={inputCls} placeholder="e.g. Salem"
                value={form.city} onChange={e => setF({ city: e.target.value })} />
            </FieldInput>
            <FieldInput label="District">
              <select
                className={inputCls}
                value={form.district}
                onChange={e => setF({ district: e.target.value, city: form.city || e.target.value })}
              >
                <option value="">Select District</option>
                {getDistrictsForState(form.state || form.assignedState || authUser?.state || 'Tamil Nadu').map((dName, idx) => (
                  <option key={idx} value={dName}>{dName}</option>
                ))}
              </select>
            </FieldInput>
            <FieldInput label="State">
              <select
                className={inputCls}
                value={form.state}
                onChange={e => setF({ state: e.target.value })}
              >
                <option value="">Select State</option>
                {ALL_INDIAN_STATES.map((st, idx) => (
                  <option key={idx} value={st}>{st}</option>
                ))}
              </select>
            </FieldInput>
            <FieldInput label="Pincode">
              <input type="text" className={inputCls} placeholder="e.g. 636004" maxLength={6}
                value={form.pincode} onChange={e => setF({ pincode: e.target.value.replace(/\D/g, '') })} />
            </FieldInput>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldInput label="Account Holder Name">
                <input type="text" className={inputCls} placeholder="e.g. Ananya Iyer"
                  value={form.accountHolderName} onChange={e => setF({ accountHolderName: e.target.value })} />
              </FieldInput>
            </div>
            <FieldInput label="Bank Name">
              <input type="text" className={inputCls} placeholder="e.g. State Bank of India"
                value={form.bankName} onChange={e => setF({ bankName: e.target.value })} />
            </FieldInput>
            <FieldInput label="Account Number">
              <input type="text" className={inputCls} placeholder="e.g. 123456789012"
                value={form.accountNumber} onChange={e => setF({ accountNumber: e.target.value })} />
            </FieldInput>
            <FieldInput label="IFSC Code">
              <input type="text" className={inputCls} placeholder="e.g. SBIN0001234"
                value={form.ifscCode} onChange={e => setF({ ifscCode: e.target.value.toUpperCase() })} />
            </FieldInput>
            <FieldInput label="Branch Name">
              <input type="text" className={inputCls} placeholder="e.g. Salem Main Branch"
                value={form.branchName} onChange={e => setF({ branchName: e.target.value })} />
            </FieldInput>
          </div>
        );

      // ===== STEP 5: Admin Assignment =====
      case 5:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs ${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
              <strong>Note:</strong> Assigned State is auto-populated from the State Admin account. Assigned District determines which district data this admin can access.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Assigned State">
                <input type="text" className={`${inputCls} opacity-70 cursor-not-allowed`}
                  value={form.assignedState} readOnly />
              </FieldInput>
              <FieldInput label="Assigned District" required>
                <select
                  className={inputCls}
                  value={form.assignedDistrict}
                  onChange={e => {
                    const selectedDist = e.target.value;
                    setF({
                      assignedDistrict: selectedDist,
                      district: form.district || selectedDist,
                      city: form.city || selectedDist
                    });
                  }}
                >
                  <option value="">Select District to Assign</option>
                  {getDistrictsForState(form.assignedState || authUser?.state || 'Tamil Nadu').map((dName, idx) => {
                    const existing = districts.find(d => d.name?.toLowerCase() === dName.toLowerCase());
                    const count = existing?.adminCount || 0;
                    const isFull = count >= 1;
                    return (
                      <option key={idx} value={dName} disabled={isFull}>
                        {dName} — {count}/1 Admin {isFull ? '(FULL)' : '(Available)'}
                      </option>
                    );
                  })}
                </select>
              </FieldInput>
              <div className="sm:col-span-2">
                <FieldInput label="Status">
                  <div className="flex gap-3 mt-1">
                    {['Active', 'Inactive'].map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="status" value={s}
                          checked={form.status === s}
                          onChange={() => setF({ status: s })}
                          className="w-4 h-4 accent-blue-600" />
                        <span className={`text-sm font-semibold ${s === 'Active' ? 'text-emerald-600' : 'text-rose-500'}`}>{s}</span>
                      </label>
                    ))}
                  </div>
                </FieldInput>
              </div>
            </div>
          </div>
        );

      // ===== STEP 6: Login Details =====
      case 6:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs ${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <strong>Important Rules:</strong> Login ID must be unique. Password must be at least 6 characters. Password and Confirm Password must match.
            </div>
            <FieldInput label="Login ID" required>
              <input type="text" className={inputCls} placeholder="e.g. district.salem.admin"
                value={form.loginId} onChange={e => setF({ loginId: e.target.value })} />
              <p className="text-[10px] text-slate-400 mt-1">This will be used as the username to log in. Must be unique.</p>
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
                <div><span className="text-slate-400">State:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.assignedState || '—'}</span></div>
                <div><span className="text-slate-400">District:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.assignedDistrict || '—'}</span></div>
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

  // ---- render ----
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            State Districts Management
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Overview of all authorized districts under this State. Click a row to view Admin details, or "View Divisions" to drill down.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add District Admin
        </button>
      </div>

      {/* Table */}
      <DataTable
        title="Districts Directory"
        subtitle="Hierarchical administration under assigned state. Click any row to inspect Admin details."
        columns={columns}
        data={districts}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search district name or ID..."
        exportFileName="state_districts.csv"
        onRowClick={(row) => setSelectedAdmin(getAdminDetails(row))}
      />

      {/* ===== District Admin Profile Modal ===== */}
      <Modal isOpen={!!selectedAdmin} onClose={() => setSelectedAdmin(null)} title="District Administrator Profile" maxWidth="max-w-2xl">
        {selectedAdmin && (() => {
          const a = selectedAdmin;
          const isActive = (a.status || 'Active') === 'Active';
          const cardCls = `p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'}`;
          const hdrCls = 'flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700/60 pb-2';
          const val = (v) => v || <span className="text-slate-400 italic text-[10px]">Not provided</span>;
          const row2 = (label, v) => (
            <div><span className="text-slate-500">{label}:</span><div className={`font-medium text-xs ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{val(v)}</div></div>
          );
          return (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

              {/* Header */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                <div className="flex items-center gap-3.5">
                  {a.avatarUrl
                    ? <img src={a.avatarUrl} alt={a.name} className="w-12 h-12 rounded-xl object-cover border-2 border-blue-300" />
                    : <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${isDark ? 'bg-indigo-950 border border-indigo-700/60 text-cyan-300' : 'bg-blue-600 text-white shadow-sm'}`}>{(a.name || 'U')[0].toUpperCase()}</div>
                  }
                  <div>
                    <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{a.name}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>District Administrator</span>
                      {a.loginId && <><span>•</span><span className="font-mono text-blue-500">ID: {a.loginId}</span></>}
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50'
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/50'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  {a.status || 'Active'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                {/* Personal Details */}
                <div className={cardCls}>
                  <div className={hdrCls}><User className="w-3.5 h-3.5 text-violet-500" /> Personal Details</div>
                  <div className="space-y-2 text-xs">
                    {row2('Full Name', a.name)}
                    {row2('Date of Birth', a.dob)}
                    {row2('Date of Appointment', a.joinedDate)}
                  </div>
                </div>

                {/* Contact */}
                <div className={cardCls}>
                  <div className={hdrCls}><Phone className="w-3.5 h-3.5 text-blue-500" /> Contact Information</div>
                  <div className="space-y-2 text-xs">
                    {row2('Email Address', a.email)}
                    {row2('Mobile Number', a.phone)}
                  </div>
                </div>

                {/* Address */}
                <div className={`${cardCls} md:col-span-2`}>
                  <div className={hdrCls}><MapPin className="w-3.5 h-3.5 text-amber-500" /> Address Details</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {row2('Street / Door No', a.address)}
                    {row2('City', a.city)}
                    {row2('District', a.district)}
                    {row2('State', a.state)}
                    {row2('Pincode', a.pincode)}
                  </div>
                </div>

                {/* Bank Details */}
                <div className={`${cardCls} md:col-span-2`}>
                  <div className={hdrCls}><Landmark className="w-3.5 h-3.5 text-indigo-500" /> Bank Details</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {row2('Account Holder', a.accountHolder)}
                    {row2('Bank Name', a.bankName)}
                    {row2('Account Number', a.accountNumber)}
                    {row2('IFSC Code', a.ifsc)}
                    {row2('Branch Name', a.branch)}
                  </div>
                </div>

                {/* Assignment */}
                <div className={cardCls}>
                  <div className={hdrCls}><ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Admin Assignment</div>
                  <div className="space-y-2 text-xs">
                    {row2('Assigned State', a.state)}
                    <div><span className="text-slate-500">Assigned District:</span>
                      <div className={`font-bold text-xs ${isDark ? 'text-cyan-300' : 'text-blue-600'}`}>{val(a.district)}</div>
                    </div>
                    {row2('Supervisory Scope', `${a.divisionsCount} Divisions • ${a.pincodesCount} Pincodes`)}
                  </div>
                </div>

                {/* Login */}
                <div className={cardCls}>
                  <div className={hdrCls}><KeyRound className="w-3.5 h-3.5 text-rose-500" /> Login Details</div>
                  <div className="space-y-2 text-xs">
                    {row2('Login ID', a.loginId)}
                    <div><span className="text-slate-500">Password:</span>
                      <div className="text-slate-400 italic text-[10px]">Hidden for security</div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-1">
                <button type="button" onClick={() => setSelectedAdmin(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}>
                  Close Profile
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ===== Add District Admin Wizard Modal ===== */}
      <Modal isOpen={showAddModal} onClose={closeAdd} title="Add District Admin" maxWidth="max-w-2xl">
        {addSuccess ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">Registration Successful!</p>
            <p className="text-sm text-slate-500 text-center">{addSuccess}</p>
            <button type="button" onClick={closeAdd}
              className="mt-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow cursor-pointer transition">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Step Indicator */}
            <div className="flex items-center gap-0">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const done = currentStep > step.id;
                const active = currentStep === step.id;
                return (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        done ? 'bg-blue-600 border-blue-600 text-white'
                          : active ? 'bg-blue-50 border-blue-600 text-blue-600 dark:bg-blue-950 dark:border-blue-400 dark:text-blue-300'
                            : isDark ? 'bg-slate-800 border-slate-600 text-slate-500' : 'bg-slate-100 border-slate-300 text-slate-400'
                      }`}>
                        {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                      </div>
                      <span className={`text-[9px] font-semibold ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>{step.label}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mb-4 mx-1 transition-all ${done ? 'bg-blue-500' : isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Step Title */}
            <div className={`pb-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Step {currentStep}: {STEPS[currentStep - 1].label} Details
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentStep === 1 && 'Enter the personal information of the District Admin.'}
                {currentStep === 2 && 'Provide the residential or official address.'}
                {currentStep === 3 && 'Upload government identity documents (Aadhaar & PAN).'}
                {currentStep === 4 && 'Provide bank account details for salary disbursement.'}
                {currentStep === 5 && 'Set the admin assignment, district scope, and status.'}
                {currentStep === 6 && 'Set up login credentials for the District Admin account.'}
              </p>
            </div>

            {/* Error alert */}
            {addError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                {addError}
              </div>
            )}

            {/* Step content */}
            <div className="min-h-[200px]">
              {renderStep()}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
              <button type="button"
                onClick={() => { setAddError(''); setCurrentStep(s => Math.max(1, s - 1)); }}
                disabled={currentStep === 1}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <span className="text-xs text-slate-400 font-medium">{currentStep} / {STEPS.length}</span>

              {currentStep < STEPS.length ? (
                <button type="button"
                  onClick={() => { setAddError(''); if (canNextStep()) setCurrentStep(s => s + 1); else setAddError('Please fill all required fields before proceeding.'); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow transition cursor-pointer">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={addLoading || !canNextStep()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                  {addLoading ? 'Registering...' : <><CheckCircle2 className="w-4 h-4" /> Register Admin</>}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
