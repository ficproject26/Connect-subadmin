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
import { getDistrictsForState, ALL_INDIAN_STATES, getDivisionsForDistrict } from '../../utils/indiaPostalData';

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
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [allDivisions, setAllDivisions] = useState([]);
  const [allPincodes, setAllPincodes] = useState([]);
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
    divisionsCount:   row.divisionsCount !== undefined ? row.divisionsCount : (row.divisions?.length || 0),
    pincodesCount:    row.pincodesCount !== undefined ? row.pincodesCount : (row.divisions?.reduce((s,d) => s + (d.pincodes?.length||0), 0) || 0),
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
      const [distRes, divRes, pinRes] = await Promise.all([
        dataService.getDistricts(),
        dataService.getDivisions().catch(() => ({ success: false })),
        dataService.getPincodes().catch(() => ({ success: false }))
      ]);
      if (distRes.success && distRes.districts) {
        setDistricts(distRes.districts);
      }
      if (divRes.success && divRes.divisions) {
        setAllDivisions(divRes.divisions);
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

  // ---- validation helpers ----
  const getMaxDobDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const is18Plus = (dobString) => {
    if (!dobString) return true;
    const dobDate = new Date(dobString);
    if (isNaN(dobDate.getTime())) return false;
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() - 18);
    maxDate.setHours(23, 59, 59, 999);
    return dobDate <= maxDate;
  };

  const handleMobileChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('91') && val.length === 12) {
      val = val.slice(2);
    }
    if (val.length > 0 && !/^[6-9]/.test(val)) {
      return; // Only allow digits starting with 6, 7, 8, 9
    }
    if (val.length > 10) {
      val = val.slice(0, 10);
    }
    setF({ mobile: val });
  };

  // ---- step validation ----
  const validateStep = (step) => {
    if (step === 1) {
      if (!form.fullName.trim()) return 'Please enter the Full Name.';
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid Email Address.';
      if (!form.mobile.trim()) return 'Please enter the Mobile Number.';
      if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) return 'Mobile number must be 10 digits and start with 6, 7, 8, or 9.';
      if (form.dob && !is18Plus(form.dob)) return 'Date of Birth must be 18+ years ago (Admin must be at least 18 years old).';
      return null;
    }
    if (step === 5) {
      if (!form.assignedDistrict.trim()) return 'Please select or enter the Assigned District.';
      return null;
    }
    if (step === 6) {
      if (!form.loginId.trim()) return 'Please enter a Login ID.';
      if (form.password.length < 6) return 'Password must be at least 6 characters.';
      if (form.password !== form.confirmPassword) return 'Password and Confirm Password do not match.';
      return null;
    }
    return null;
  };

  const canNextStep = () => {
    return !validateStep(currentStep);
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
        const registeredDivisions = (allDivisions && allDivisions.length > 0)
          ? allDivisions.filter(d => {
              const dDist = (d.districtName || d.district || '').toLowerCase();
              const isMatch = dDist === row.name?.toLowerCase() || dDist === (row.id || '').toLowerCase();
              const hasAdmin = d.adminName && d.adminName !== 'Unassigned' && d.adminName !== '-';
              return isMatch && hasAdmin;
            }).length
          : (row.divisionsCount !== undefined ? row.divisionsCount : 0);

        const registeredPincodes = (allPincodes && allPincodes.length > 0)
          ? allPincodes.filter(p => {
              const pDist = (p.district || p.districtName || '').toLowerCase();
              const isMatch = pDist === row.name?.toLowerCase() || pDist === (row.id || '').toLowerCase();
              const hasAdmin = p.adminName && p.adminName !== 'Unassigned' && p.adminName !== '-';
              return isMatch && hasAdmin;
            }).length
          : (row.pincodesCount !== undefined ? row.pincodesCount : 0);

        return `${registeredDivisions} / ${registeredPincodes}`;
      },
      render: (row) => {
        const registeredDivisions = (allDivisions && allDivisions.length > 0)
          ? allDivisions.filter(d => {
              const dDist = (d.districtName || d.district || '').toLowerCase();
              const isMatch = dDist === row.name?.toLowerCase() || dDist === (row.id || '').toLowerCase();
              const hasAdmin = d.adminName && d.adminName !== 'Unassigned' && d.adminName !== '-';
              return isMatch && hasAdmin;
            }).length
          : (row.divisionsCount !== undefined ? row.divisionsCount : 0);

        const registeredPincodes = (allPincodes && allPincodes.length > 0)
          ? allPincodes.filter(p => {
              const pDist = (p.district || p.districtName || '').toLowerCase();
              const isMatch = pDist === row.name?.toLowerCase() || pDist === (row.id || '').toLowerCase();
              const hasAdmin = p.adminName && p.adminName !== 'Unassigned' && p.adminName !== '-';
              return isMatch && hasAdmin;
            }).length
          : (row.pincodesCount !== undefined ? row.pincodesCount : 0);

        return (
          <div className="flex items-center gap-2 text-xs py-1">
            <span className={`inline-flex items-center justify-center min-w-[28px] px-2.5 py-1 rounded-lg border font-bold text-xs ${isDark ? 'bg-blue-950/60 border-blue-800/60 text-cyan-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>{registeredDivisions}</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">/</span>
            <span className={`inline-flex items-center justify-center min-w-[28px] px-2.5 py-1 rounded-lg border font-bold text-xs ${isDark ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{registeredPincodes}</span>
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
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/state-admin/divisions?district=${encodeURIComponent(row.name)}`);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition shadow-xs cursor-pointer ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            }`}
            title="View divisions in this district"
          >
            <span>Divisions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
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
                <input
                  type="tel"
                  className={inputCls}
                  placeholder="10-digit number (starts with 6,7,8,9)"
                  maxLength={10}
                  value={form.mobile}
                  onChange={handleMobileChange}
                />
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-slate-400">10 digits starting with 6, 7, 8, 9</span>
                  {form.mobile && form.mobile.length > 0 && form.mobile.length < 10 && (
                    <span className="text-amber-500 font-medium">
                      {10 - form.mobile.length} more digit{10 - form.mobile.length > 1 ? 's' : ''} needed
                    </span>
                  )}
                  {form.mobile && form.mobile.length === 10 && (
                    <span className="text-emerald-500 font-semibold">Valid 10-digit number</span>
                  )}
                </div>
              </FieldInput>
              <FieldInput label="Date of Birth">
                <input
                  type="date"
                  className={inputCls}
                  max={getMaxDobDate()}
                  value={form.dob}
                  onChange={e => setF({ dob: e.target.value })}
                />
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-slate-400">Must be at least 18 years old (18+)</span>
                  {form.dob && !is18Plus(form.dob) && (
                    <span className="text-rose-500 font-semibold">Under 18 not allowed</span>
                  )}
                  {form.dob && is18Plus(form.dob) && (
                    <span className="text-emerald-500 font-semibold">Age verified (18+)</span>
                  )}
                </div>
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
        onRowClick={(row) => {
          setSelectedAdmin(getAdminDetails(row));
          setSelectedDistrict(row);
        }}
      />

      {/* ===== District Admin Profile & Operational Details Modal ===== */}
      <Modal
        isOpen={!!selectedAdmin}
        onClose={() => { setSelectedAdmin(null); setSelectedDistrict(null); }}
        title={selectedDistrict ? `${selectedDistrict.name} District - Admin Profile & Operational Details` : "District Administrator Profile & Details"}
        maxWidth="max-w-4xl"
      >
        {selectedAdmin && (() => {
          const a = selectedAdmin;
          const isActive = (a.status || 'Active') === 'Active';
          const cardCls = `p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'}`;
          const hdrCls = 'flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700/60 pb-2';
          const val = (v) => v || <span className="text-slate-400 italic text-[10px]">Not provided</span>;
          const row2 = (label, v) => (
            <div><span className="text-slate-500">{label}:</span><div className={`font-medium text-xs ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{val(v)}</div></div>
          );

          // Get matched district from state if available
          const dst = selectedDistrict || districts.find(d => d.name?.toLowerCase() === a.district?.toLowerCase() || d.id === a.districtCode);

          // Compute registered divisions under this district
          const districtDivisions = dst ? (
            (allDivisions && allDivisions.length > 0)
              ? allDivisions.filter(d => {
                  const dDist = (d.districtName || d.district)?.toLowerCase();
                  const isMatch = dDist === dst.name?.toLowerCase() || dDist === (dst.id || '').toLowerCase();
                  const hasAdmin = d.adminName && d.adminName !== 'Unassigned' && d.adminName !== '-';
                  return isMatch && hasAdmin;
                })
              : []
          ) : [];

          // Compute registered pincodes under this district
          const districtPincodes = dst ? (
            (allPincodes && allPincodes.length > 0)
              ? allPincodes.filter(p => {
                  const pDist = (p.district || p.districtName)?.toLowerCase();
                  const isMatch = pDist === dst.name?.toLowerCase() || pDist === (dst.id || '').toLowerCase();
                  const hasAdmin = p.adminName && p.adminName !== 'Unassigned' && p.adminName !== '-';
                  return isMatch && hasAdmin;
                })
              : []
          ) : [];

          const workforceMetrics = dst ? [
            { label: 'Total Managers', value: dst.totalManagers !== undefined ? dst.totalManagers : (dst.managers?.length || 0), icon: UserCog, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50' },
            { label: 'Total Agents', value: dst.totalAgents || 0, icon: Users, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/60 dark:text-violet-400 border-violet-100 dark:border-violet-900/50' },
            { label: 'Delivery Partner', value: dst.deliveryPartner || 0, icon: Truck, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/60 dark:text-orange-400 border-orange-100 dark:border-orange-900/50' },
            { label: 'Technician', value: dst.technician || 0, icon: Wrench, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400 border-purple-100 dark:border-purple-900/50' },
            { label: 'Executive', value: dst.executive || 0, icon: Award, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-400 border-teal-100 dark:border-teal-900/50' },
            { label: 'Pending KYC', value: dst.pendingKYC || 0, icon: ShieldAlert, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100 dark:border-amber-900/50' }
          ] : [];

          const commerceMetrics = dst ? [
            { label: 'Total Vendors', value: dst.totalVendors || 0, icon: Store, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400 border-blue-100 dark:border-blue-900/50' },
            { label: 'Total Orders', value: dst.totalOrders || 0, icon: Package, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50' },
            { label: 'Total Bookings', value: dst.totalBookings || 0, icon: CalendarCheck, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/50' },
            { label: 'Total Job Applied', value: dst.totalJobApplied || 0, icon: Briefcase, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-400 border-sky-100 dark:border-sky-900/50' },
            { label: 'Total Membership Cards', value: (dst.totalMembershipCards || 0)?.toLocaleString(), icon: CreditCard, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400 border-rose-100 dark:border-rose-900/50' }
          ] : [];

          return (
            <div className="space-y-6 max-h-[82vh] overflow-y-auto pr-1">

              {/* SECTION 1: DISTRICT ADMINISTRATOR PROFILE */}
              <div className="space-y-4">
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
              </div>

              {/* SECTION 2: DISTRICT DETAILS (DIRECTLY BELOW ADMIN PROFILE) */}
              {dst && (
                <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  {/* Section Title Bar */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                    isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-gradient-to-r from-blue-50/90 to-indigo-50/60 border-blue-200/80'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {dst.name} District Operations & Structural Breakdown
                        </h4>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          District ID: <span className="font-semibold text-slate-800 dark:text-slate-200">{dst.id || dst.code}</span> • Jurisdiction: {dst.state || authUser?.state || 'Tamil Nadu'}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50 shrink-0">
                      {dst.status || 'Active'}
                    </span>
                  </div>

                  {/* Quick KPI Stats Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-500 font-medium">Divisions</div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">{districtDivisions.length}</div>
                    </div>
                    <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-500 font-medium">Pincodes</div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        {districtPincodes.length > 0 ? districtPincodes.length : (dst.pincodesCount || districtDivisions.length * 4)}
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-500 font-medium">Vendors</div>
                      <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400 mt-1">{dst.totalVendors || 0}</div>
                    </div>
                    <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-500 font-medium">Customers</div>
                      <div className="text-lg font-bold text-violet-600 dark:text-violet-400 mt-1">{(dst.totalCustomers || 0).toLocaleString()}</div>
                    </div>
                    <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-500 font-medium">Orders</div>
                      <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">{(dst.totalOrders || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Dual-Panel Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Panel 1: Workforce */}
                    <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Workforce & Field Force
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

                  {/* Registered Managers */}
                  <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                    <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2">
                        <UserCog className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Registered Managers in {dst.name} ({dst.managers?.length || dst.totalManagers || 0})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/state-admin/managers/district')}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open Managers Directory</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    {dst.managers && dst.managers.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {dst.managers.map((mgr) => (
                          <div key={mgr.id} className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center font-bold text-xs shrink-0">
                                {mgr.name ? mgr.name.charAt(0).toUpperCase() : 'M'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>{mgr.name}</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    {mgr.roleTitle || 'Manager'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {mgr.email} {mgr.mobile && `• ${mgr.mobile}`} {mgr.division && mgr.division !== '-' && `• Div: ${mgr.division}`}
                                </div>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400">
                              {mgr.status || 'Active'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No managers registered under {dst.name} District yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setSelectedAdmin(null); setSelectedDistrict(null); }}
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
                {currentStep === 5 && 'Set the admin assignment and district scope.'}
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
                  onClick={() => {
                    const err = validateStep(currentStep);
                    if (!err) {
                      setAddError('');
                      setCurrentStep(s => s + 1);
                    } else {
                      setAddError(err);
                    }
                  }}
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
