import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { ManagerApprovalModal } from '../../components/ManagerApprovalModal';
import { Modal } from '../../components/Modal';
import { useTheme } from '../../context/ThemeContext';
import {
  UserCog,
  Phone,
  Building2,
  Layers,
  MapPin,
  Award,
  Users,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
  RefreshCw,
  Filter,
  Plus,
  User,
  Home,
  FileText,
  Landmark,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Upload,
  X
} from 'lucide-react';
import { ALL_INDIAN_STATES, getDistrictsForState, getDivisionsForDistrict, getPincodesForDivision } from '../../utils/indiaPostalData';

const STEPS = [
  { id: 1, label: 'Personal',   icon: User },
  { id: 2, label: 'Assignment', icon: ShieldCheck },
  { id: 3, label: 'Address',    icon: Home },
  { id: 4, label: 'KYC Docs',   icon: FileText },
  { id: 5, label: 'Bank',       icon: Landmark },
  { id: 6, label: 'Login',      icon: KeyRound },
];

const EMPTY_MGR_FORM = {
  fullName: '',
  email: '',
  mobile: '',
  dob: '',
  gender: 'Male',
  profilePhoto: null,
  profilePhotoPreview: '',
  role: 'state_manager',
  assignedState: '',
  assignedDistrict: '',
  assignedDivision: '',
  assignedPincode: '',
  doorStreet: '',
  area: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  aadharNumber: '',
  aadharPhoto: null,
  aadharPhotoPreview: '',
  panNumber: '',
  panPhoto: null,
  panPhotoPreview: '',
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branchName: '',
  status: 'active',
  loginId: '',
  password: '',
  confirmPassword: ''
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

const LEVEL_CONFIGS = {
  state: {
    title: 'State Managers',
    subtitle: 'Apex state-level operations managers, nodal coordinators, and zone directors across Tamil Nadu.',
    breadcrumb: 'State Managers',
    badge: 'State Manager',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60',
    icon: Award,
    tableTitle: 'State Operations Management Directory',
    tableSubtitle: 'Master executive managers overseeing district nodes, strategic ops, and state compliance',
    exportFile: 'state_managers.csv'
  },
  district: {
    title: 'District Managers',
    subtitle: 'District-level operational leaders managing divisional networks, logistics hubs, and territorial compliance.',
    breadcrumb: 'District Managers',
    badge: 'District Manager',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60',
    icon: Building2,
    tableTitle: 'District Manager Roster',
    tableSubtitle: 'Regional management leads managing division clusters, field supervisors, and admin operations',
    exportFile: 'district_managers.csv'
  },
  divisional: {
    title: 'Divisional Managers',
    subtitle: 'Divisional operations managers supervising pincode clusters, delivery terminals, and local coordinators.',
    breadcrumb: 'Divisional Managers',
    badge: 'Divisional Manager',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    icon: Layers,
    tableTitle: 'Divisional Manager Directory',
    tableSubtitle: 'Zonal hub leaders monitoring daily dispatch, field workforce, and local customer escalations',
    exportFile: 'divisional_managers.csv'
  },
  pincode: {
    title: 'Pincode Managers',
    subtitle: 'Hyperlocal pincode managers responsible for last-mile delivery SLA, agent coordination, and merchant liaison.',
    breadcrumb: 'Pincode Managers',
    badge: 'Pincode Manager',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    icon: MapPin,
    tableTitle: 'Pincode Micro-Zone Manager Roster',
    tableSubtitle: 'Last-mile facility managers and field operations leads assigned to postal zones',
    exportFile: 'pincode_managers.csv'
  }
};

export function StateManagers({ level }) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'active'
  const [selectedManager, setSelectedManager] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Identify admin role
  const userRole = (user?.role || '').toLowerCase();

  // Determine active level from path or prop
  let activeLevel = 'state';
  if (location.pathname.includes('/managers/district')) activeLevel = 'district';
  else if (location.pathname.includes('/managers/divisional')) activeLevel = 'divisional';
  else if (location.pathname.includes('/managers/pincode')) activeLevel = 'pincode';
  else if (location.pathname.includes('/managers/state')) activeLevel = 'state';
  else if (level) activeLevel = level;
  else {
    activeLevel = userRole.includes('district')
      ? 'district'
      : userRole.includes('division') || userRole.includes('divisional')
      ? 'divisional'
      : userRole.includes('pincode')
      ? 'pincode'
      : 'state';
  }

  const config = LEVEL_CONFIGS[activeLevel] || LEVEL_CONFIGS.state;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getManagers({ level: activeLevel });
      if (res.success && Array.isArray(res.subordinates || res.data)) {
        setManagers(res.subordinates || res.data || []);
      } else {
        setManagers([]);
      }
    } catch (err) {
      console.error('Failed to load managers directory:', err);
      setManagers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeLevel]);

  // Filtered managers based on status tab
  const filteredManagers = useMemo(() => {
    if (statusFilter === 'pending') {
      return managers.filter(m => m.status === 'under_review' || m.status === 'pending' || m.status === 'pending_admin_approval');
    }
    if (statusFilter === 'active') {
      return managers.filter(m => m.status === 'active');
    }
    return managers;
  }, [managers, statusFilter]);

  const totalCount = managers.length;
  const pendingCount = managers.filter(m => m.status === 'under_review' || m.status === 'pending' || m.status === 'pending_admin_approval').length;
  const activeCount = managers.filter(m => m.status === 'active').length;

  const handleOpenModal = (manager) => {
    setSelectedManager(manager);
    setModalOpen(true);
  };

  const handleManagerUpdated = (updatedManager) => {
    setManagers(prev => prev.map(m => (m.id === updatedManager.id || m._id === updatedManager._id ? updatedManager : m)));
    loadData();
  };

  // Add Manager Wizard State
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({ ...EMPTY_MGR_FORM });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const fileRef = useRef();
  const aadharFileRef = useRef();
  const panFileRef = useRef();
  const [registeredDistrictList, setRegisteredDistrictList] = useState(['Salem']);

  useEffect(() => {
    dataService.getDistricts().then(res => {
      if (res?.success && Array.isArray(res.districts) && res.districts.length > 0) {
        setRegisteredDistrictList(res.districts.map(d => d.name));
      }
    }).catch(console.error);
  }, []);

  const setF = (patch) => setForm(f => ({ ...f, ...patch }));

  const isSuperAdmin = userRole === 'super admin' || userRole.includes('super');
  const isStateAdmin = userRole.includes('state') && !userRole.includes('manager');
  const isDistrictAdmin = userRole.includes('district') && !userRole.includes('manager');
  const isDivisionalAdmin = (userRole.includes('division') || userRole.includes('divisional')) && !userRole.includes('manager');
  const isPincodeAdmin = userRole.includes('pincode') && !userRole.includes('manager');

  // Strict User Requirement:
  // State Admin only adds State Manager
  // District Admin only adds District Manager
  // Division Admin only adds Division Manager
  // Pincode Admin only adds Pincode Manager
  const canAddManager = 
    (isStateAdmin && activeLevel === 'state') ||
    (isDistrictAdmin && activeLevel === 'district') ||
    (isDivisionalAdmin && activeLevel === 'divisional') ||
    (isPincodeAdmin && activeLevel === 'pincode') ||
    isSuperAdmin;

  const designatedRole = 
    isStateAdmin ? 'state_manager' :
    isDistrictAdmin ? 'district_manager' :
    isDivisionalAdmin ? 'division_manager' :
    isPincodeAdmin ? 'pincode_manager' :
    (activeLevel === 'district' ? 'district_manager' : activeLevel === 'divisional' ? 'division_manager' : activeLevel === 'pincode' ? 'pincode_manager' : 'state_manager');

  const designatedRoleLabel = 
    designatedRole === 'state_manager' ? 'State Manager' :
    designatedRole === 'district_manager' ? 'District Manager' :
    designatedRole === 'division_manager' ? 'Division Manager' :
    'Pincode Manager';

  const openAddManager = () => {
    setForm({
      ...EMPTY_MGR_FORM,
      role: designatedRole,
      assignedState: user?.state || 'Tamil Nadu',
      assignedDistrict: isStateAdmin ? '' : (user?.district || ''),
      assignedDivision: (isStateAdmin || isDistrictAdmin) ? '' : (user?.division || ''),
      assignedPincode: isPincodeAdmin ? (user?.pincode || '') : '',
      state: user?.state || 'Tamil Nadu',
      district: user?.district || '',
      status: 'active'
    });
    setCurrentStep(1);
    setAddError('');
    setAddSuccess('');
    setShowAddModal(true);
  };

  const closeAddManager = () => {
    setShowAddModal(false);
    setAddSuccess('');
    setAddError('');
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setF({ profilePhoto: file, profilePhotoPreview: preview });
  };

  const handleAadharUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setF({ aadharPhoto: file, aadharPhotoPreview: preview });
  };

  const handlePanUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setF({ panPhoto: file, panPhotoPreview: preview });
  };

  const handleAddSubmit = async () => {
    setAddError('');
    setAddSuccess('');
    if (!form.fullName.trim()) return setAddError('Full name is required.');
    if (!form.email.trim()) return setAddError('Email address is required.');
    if (!form.mobile.trim()) return setAddError('Mobile number is required.');
    if (!form.loginId.trim()) return setAddError('Login ID / Username is required.');
    if (form.password.length < 6) return setAddError('Password must be at least 6 characters.');
    if (form.password !== form.confirmPassword) return setAddError('Passwords do not match.');

    setAddLoading(true);
    try {
      const payload = {
        name: form.fullName.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        role: form.role,
        assignedState: form.assignedState || user?.state || 'Tamil Nadu',
        assignedDistrict: form.assignedDistrict || user?.district || '',
        assignedDivision: form.assignedDivision || user?.division || '',
        assignedPincode: form.assignedPincode || user?.pincode || '',
        dob: form.dob,
        gender: form.gender,
        doorStreet: form.doorStreet,
        area: form.area,
        city: form.city,
        state: form.state || user?.state || 'Tamil Nadu',
        district: form.district || user?.district || '',
        pincode: form.pincode,
        aadharNumber: form.aadharNumber,
        panNumber: form.panNumber,
        accountHolderName: form.accountHolderName || form.fullName.trim(),
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode,
        branchName: form.branchName,
        status: form.status || 'active',
        loginId: form.loginId.trim(),
        password: form.password
      };

      const res = await dataService.addManager(payload);
      if (res.success) {
        setAddSuccess(res.message || 'Manager registered successfully!');
        loadData();
        setTimeout(() => {
          setShowAddModal(false);
          setAddSuccess('');
        }, 1200);
      } else {
        setAddError(res.message || 'Failed to register manager.');
      }
    } catch (err) {
      setAddError(err.message || 'Failed to add manager.');
    } finally {
      setAddLoading(false);
    }
  };

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
      return;
    }
    if (val.length > 10) {
      val = val.slice(0, 10);
    }
    setF({ mobile: val });
  };

  const validateStep = (step) => {
    if (step === 1) {
      if (!form.fullName.trim()) return 'Please enter the Full Name.';
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid Email Address.';
      if (!form.mobile.trim()) return 'Please enter the Mobile Number.';
      if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) return 'Mobile number must be 10 digits and start with 6, 7, 8, or 9.';
      if (form.dob && !is18Plus(form.dob)) return 'Date of Birth must be 18+ years ago (Manager must be at least 18 years old).';
      return null;
    }
    if (step === 2) {
      const activeRole = form.role || designatedRole;
      if (activeRole === 'state_manager' && !(form.assignedState || user?.state)) return 'Please assign State jurisdiction.';
      if (activeRole === 'district_manager' && (!(form.assignedState || user?.state) || !(form.assignedDistrict || user?.district))) return 'Please assign District jurisdiction.';
      if (activeRole === 'division_manager' && (!(form.assignedState || user?.state) || !(form.assignedDistrict || user?.district) || !(form.assignedDivision || user?.division))) return 'Please assign Division jurisdiction.';
      if (activeRole === 'pincode_manager' && !(form.assignedPincode || user?.pincode)) return 'Please assign Pincode jurisdiction.';
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

  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  }`;


  const availableDistricts = registeredDistrictList;
  const availableDivisions = (form.assignedState && form.assignedDistrict) ? getDivisionsForDistrict(form.assignedState, form.assignedDistrict) : [];
  const availablePincodes = (form.assignedState && form.assignedDistrict && form.assignedDivision)
    ? getPincodesForDivision(form.assignedState, form.assignedDistrict, form.assignedDivision)
    : [];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <FieldInput label="Full Name" required>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="e.g. Anand Kumar"
                    value={form.fullName}
                    onChange={(e) => setF({ fullName: e.target.value })}
                  />
                </FieldInput>
              </div>
              <FieldInput label="Email Address" required>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="e.g. anand.mgr@gmail.com"
                  value={form.email}
                  onChange={(e) => setF({ email: e.target.value, loginId: form.loginId || e.target.value })}
                />
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
                  onChange={(e) => setF({ dob: e.target.value })}
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
              <FieldInput label="Gender">
                <select
                  className={inputCls}
                  value={form.gender}
                  onChange={(e) => setF({ gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </FieldInput>
              <div className="sm:col-span-2">
                <FieldInput label="Profile Photo">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                      isDark
                        ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400'
                        : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">
                      {form.profilePhoto ? form.profilePhoto.name : 'Choose JPG/PNG photo'}
                    </span>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </div>
                </FieldInput>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            {isSuperAdmin ? (
              <FieldInput label="Manager Operational Role" required>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { id: 'state_manager', label: 'State Manager', level: 1 },
                    { id: 'district_manager', label: 'District Manager', level: 2 },
                    { id: 'division_manager', label: 'Division Manager', level: 3 },
                    { id: 'pincode_manager', label: 'Pincode Manager', level: 4 }
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setF({ role: r.id })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        form.role === r.id
                          ? isDark
                            ? 'bg-blue-950/70 border-blue-500 text-blue-300 ring-2 ring-blue-500/40'
                            : 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-100'
                          : isDark
                          ? 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs">{r.label}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">Tier {r.level} Operations</div>
                    </button>
                  ))}
                </div>
              </FieldInput>
            ) : (
              <div className={`p-4 rounded-xl border ${
                isDark ? 'bg-blue-950/40 border-blue-800/60' : 'bg-blue-50/70 border-blue-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Designated Operational Role
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Authority Locked
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {designatedRoleLabel}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      As a {user?.role || 'Administrator'}, you are authorized to add and onboard {designatedRoleLabel}s within your administrative jurisdiction.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <FieldInput label="Assigned State" required>
                {isSuperAdmin ? (
                  <select
                    className={inputCls}
                    value={form.assignedState}
                    onChange={(e) => setF({ assignedState: e.target.value, assignedDistrict: '', assignedDivision: '', assignedPincode: '' })}
                  >
                    <option value="">Select State</option>
                    {ALL_INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    className={`${inputCls} opacity-80 cursor-not-allowed bg-slate-100 dark:bg-slate-800 font-semibold`}
                    value={form.assignedState || user?.state || 'Tamil Nadu'}
                  />
                )}
              </FieldInput>

              {form.role !== 'state_manager' && (
                <FieldInput label="Assigned District" required={form.role !== 'state_manager'}>
                  {isSuperAdmin ? (
                    <select
                      className={inputCls}
                      value={form.assignedDistrict}
                      onChange={(e) => setF({ assignedDistrict: e.target.value, assignedDivision: '', assignedPincode: '' })}
                    >
                      <option value="">Select District</option>
                      {availableDistricts.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  ) : (isDistrictAdmin || isDivisionalAdmin || isPincodeAdmin) ? (
                    <input
                      type="text"
                      disabled
                      className={`${inputCls} opacity-80 cursor-not-allowed bg-slate-100 dark:bg-slate-800 font-semibold`}
                      value={form.assignedDistrict || user?.district || ''}
                    />
                  ) : (
                    <select
                      className={inputCls}
                      value={form.assignedDistrict}
                      onChange={(e) => setF({ assignedDistrict: e.target.value, assignedDivision: '', assignedPincode: '' })}
                    >
                      <option value="">Select District</option>
                      {availableDistricts.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  )}
                </FieldInput>
              )}

              {(form.role === 'division_manager' || form.role === 'pincode_manager') && (
                <FieldInput label="Assigned Division" required>
                  {isDivisionalAdmin || isPincodeAdmin ? (
                    <input
                      type="text"
                      disabled
                      className={`${inputCls} opacity-80 cursor-not-allowed bg-slate-100 dark:bg-slate-800 font-semibold`}
                      value={form.assignedDivision || user?.division || ''}
                    />
                  ) : availableDivisions.length > 0 ? (
                    <select
                      className={inputCls}
                      value={form.assignedDivision}
                      onChange={(e) => setF({ assignedDivision: e.target.value, assignedPincode: '' })}
                    >
                      <option value="">Select Division</option>
                      {availableDivisions.map((div) => (
                        <option key={div} value={div}>{div}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. Attur"
                      value={form.assignedDivision}
                      onChange={(e) => setF({ assignedDivision: e.target.value })}
                    />
                  )}
                </FieldInput>
              )}

              {form.role === 'pincode_manager' && (
                <FieldInput label="Assigned Pincode" required>
                  {isPincodeAdmin ? (
                    <input
                      type="text"
                      disabled
                      className={`${inputCls} opacity-80 cursor-not-allowed bg-slate-100 dark:bg-slate-800 font-semibold`}
                      value={form.assignedPincode || user?.pincode || ''}
                    />
                  ) : availablePincodes.length > 0 ? (
                    <select
                      className={inputCls}
                      value={form.assignedPincode}
                      onChange={(e) => setF({ assignedPincode: e.target.value })}
                    >
                      <option value="">Select 6-digit Pincode</option>
                      {availablePincodes.map((pin) => (
                        <option key={pin} value={pin}>{pin}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. 636102"
                      maxLength={6}
                      value={form.assignedPincode}
                      onChange={(e) => setF({ assignedPincode: e.target.value.replace(/\D/g, '') })}
                    />
                  )}
                </FieldInput>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldInput label="Door No / Street">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. 12, Bazaar Street"
                  value={form.doorStreet}
                  onChange={(e) => setF({ doorStreet: e.target.value })}
                />
              </FieldInput>
            </div>
            <FieldInput label="Area / Locality">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Gandhinagar"
                value={form.area}
                onChange={(e) => setF({ area: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="City / Town">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Salem"
                value={form.city}
                onChange={(e) => setF({ city: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="District">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Salem"
                value={form.district}
                onChange={(e) => setF({ district: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="State">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Tamil Nadu"
                value={form.state}
                onChange={(e) => setF({ state: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="Pincode">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. 636001"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => setF({ pincode: e.target.value.replace(/\D/g, '') })}
              />
            </FieldInput>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Aadhaar Card Number">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="12-digit Aadhaar Number"
                  maxLength={12}
                  value={form.aadharNumber}
                  onChange={(e) => setF({ aadharNumber: e.target.value.replace(/\D/g, '') })}
                />
              </FieldInput>
              <FieldInput label="Aadhaar Document Photo">
                <div
                  onClick={() => aadharFileRef.current?.click()}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                    isDark
                      ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400'
                      : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                  }`}
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">
                    {form.aadharPhoto ? form.aadharPhoto.name : 'Upload Aadhaar front/back'}
                  </span>
                  <input ref={aadharFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleAadharUpload} />
                </div>
              </FieldInput>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="PAN Card Number">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  value={form.panNumber}
                  onChange={(e) => setF({ panNumber: e.target.value.toUpperCase() })}
                />
              </FieldInput>
              <FieldInput label="PAN Document Photo">
                <div
                  onClick={() => panFileRef.current?.click()}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                    isDark
                      ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400'
                      : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                  }`}
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">
                    {form.panPhoto ? form.panPhoto.name : 'Upload PAN card scan'}
                  </span>
                  <input ref={panFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handlePanUpload} />
                </div>
              </FieldInput>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldInput label="Account Holder Name">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Anand Kumar"
                  value={form.accountHolderName}
                  onChange={(e) => setF({ accountHolderName: e.target.value })}
                />
              </FieldInput>
            </div>
            <FieldInput label="Bank Name">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. State Bank of India"
                value={form.bankName}
                onChange={(e) => setF({ bankName: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="Account Number">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. 123456789012"
                value={form.accountNumber}
                onChange={(e) => setF({ accountNumber: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="IFSC Code">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. SBIN0001234"
                maxLength={11}
                value={form.ifscCode}
                onChange={(e) => setF({ ifscCode: e.target.value.toUpperCase() })}
              />
            </FieldInput>
            <FieldInput label="Branch Name">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Salem Main Branch"
                value={form.branchName}
                onChange={(e) => setF({ branchName: e.target.value })}
              />
            </FieldInput>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs ${
              isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <strong>Account Setup:</strong> Login ID can be an email or custom username. Password must be at least 6 characters.
            </div>

            <FieldInput label="Login ID / Username" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. anand.mgr or email"
                value={form.loginId}
                onChange={(e) => setF({ loginId: e.target.value })}
              />
            </FieldInput>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Password" required>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className={inputCls}
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={(e) => setF({ password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FieldInput>

              <FieldInput label="Confirm Password" required>
                <div className="relative">
                  <input
                    type={showConfirmPwd ? 'text' : 'password'}
                    className={`${inputCls} ${form.confirmPassword && form.password !== form.confirmPassword ? '!border-rose-400 !ring-rose-100' : ''}`}
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={(e) => setF({ confirmPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FieldInput>
            </div>

            <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/60 dark:bg-blue-950/40 dark:border-blue-800/60 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-blue-900 dark:text-blue-200">
                  Direct KYC Pipeline Registration
                </div>
                <div className="text-blue-700/90 dark:text-blue-300/90 mt-0.5">
                  When registered by an Admin, this manager profile will automatically move directly to the KYC Team for document verification. Once verified, the manager account will activate and login will be enabled.
                </div>
              </div>
            </div>

            {/* Registration Summary */}
            <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
              isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <p className="font-semibold text-slate-600 dark:text-slate-300 mb-2">Registration Summary</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div><span className="text-slate-400">Name:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.fullName || '—'}</span></div>
                <div><span className="text-slate-400">Email:</span> <span className={`font-medium font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.email || '—'}</span></div>
                <div><span className="text-slate-400">Role:</span> <span className="font-semibold text-blue-600 capitalize">{form.role.replace('_', ' ')}</span></div>
                <div><span className="text-slate-400">Jurisdiction:</span> <span className={`font-medium ${isDark ? 'text-cyan-300' : 'text-blue-600'}`}>
                  {form.assignedPincode ? `PIN: ${form.assignedPincode}` : form.assignedDivision ? `${form.assignedDivision} Div` : form.assignedDistrict ? `${form.assignedDistrict} Dist` : `${form.assignedState || 'State'} Tier`}
                </span></div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const columns = [
    {
      header: 'Manager Details',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center font-bold text-xs shrink-0">
            {row.name ? row.name.charAt(0).toUpperCase() : <UserCog className="w-4 h-4" />}
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <span>{row.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${config.badgeColor}`}>
                {config.badge}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">{row.email}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Jurisdiction & Authority',
      accessor: 'jurisdiction',
      render: (row) => (
        <div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {row.jurisdiction || 'Tamil Nadu'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={row.assignedArea}>
            {row.assignedArea || 'State Zone'}
          </div>
          {row.targetAdminRole && (
            <div className="mt-1">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/60 dark:border-blue-800/50">
                Routed: {row.targetAdminRole}
              </span>
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Contact',
      accessor: 'phone',
      render: (row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1">
          <Phone className="w-3 h-3 text-slate-400" /> {row.mobile || row.phone}
        </span>
      )
    },
    {
      header: 'Applied / Joined Date',
      accessor: 'joinedDate',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.joinedDate || 'Recently Registered'}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status || 'Active'} />
    },
    {
      header: 'Action',
      accessor: 'actions',
      render: (row) => {
        const isPendingAdmin = row.status === 'under_review' || row.status === 'pending' || row.status === 'pending_admin_approval';
        const canApprove = row.canApprove !== false;
        return (
          <div className="flex items-center gap-2">
            {isPendingAdmin ? (
              <button
                type="button"
                onClick={() => handleOpenModal(row)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                  canApprove
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {canApprove ? 'Review & Approve' : 'View Request'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenModal(row)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                View Details
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header with + Add Manager button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{config.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{config.subtitle}</p>
        </div>

        {canAddManager && (
          <button
            type="button"
            onClick={openAddManager}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manager</span>
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total {config.title}</span>
            <UserCog className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{totalCount}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">Jurisdiction directory</div>
        </div>

        <div className={`p-3.5 rounded-2xl border shadow-sm transition ${
          pendingCount > 0
            ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
            : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${pendingCount > 0 ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
              Pending Approvals
            </span>
            <AlertCircle className={`w-4 h-4 ${pendingCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className={`text-lg font-bold mt-1.5 ${pendingCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
            {pendingCount}
          </div>
          <div className={`text-[10px] font-medium mt-0.5 ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
            {pendingCount > 0 ? 'Awaiting your admin review' : 'All registrations verified'}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Roster</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{activeCount}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Approved & active</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Territory Coverage</span>
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">100%</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">Hierarchical alignment</div>
        </div>
      </div>

      {/* Pending Approvals Quick Alert Banner */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200/80 dark:border-amber-800/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {pendingCount} New Manager Registration{pendingCount > 1 ? 's' : ''} Awaiting Admin Approval
              </h4>
              <p className="text-[11px] text-amber-700/90 dark:text-amber-400 mt-0.5">
                Review candidate credentials and accept registration to activate their manager account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700 transition self-start sm:self-auto cursor-pointer"
          >
            Filter Pending Requests
          </button>
        </div>
      )}

      {/* Data Table with Filter Options placed after the search bar */}
      <DataTable
        title={config.tableTitle}
        subtitle={config.tableSubtitle}
        columns={columns}
        data={filteredManagers}
        onRowClick={(row) => handleOpenModal(row)}
        loading={loading}
        onRefresh={loadData}
        filterOptions={[
          { label: `All Managers (${totalCount})`, value: 'all' },
          { label: `Pending Approvals (${pendingCount})`, value: 'pending' },
          { label: `Active Managers (${activeCount})`, value: 'active' }
        ]}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        searchPlaceholder={`Search ${config.title.toLowerCase()} by name, jurisdiction, or phone...`}
        exportFileName={config.exportFile}
      />

      {/* Manager Registration & KYC Review Modal */}
      <ManagerApprovalModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        manager={selectedManager}
        onManagerUpdated={handleManagerUpdated}
      />

      {/* Add Manager Wizard Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={closeAddManager}
        title={`Add ${config.title.slice(0, -1)} / Operations Lead`}
        maxWidth="max-w-2xl"
      >
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
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium hidden sm:block ${
                    isCurrent ? 'text-blue-600 dark:text-cyan-400 font-bold' : isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step Title */}
          <div className={`pb-2 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1]?.label} Information
            </h3>
            <p className="text-xs text-slate-500">
              {currentStep === 1 && 'Enter manager personal, contact, and identity details.'}
              {currentStep === 2 && 'Assign operational tier, designated administrative jurisdiction, and service zone.'}
              {currentStep === 3 && 'Residential permanent/correspondence address details.'}
              {currentStep === 4 && 'KYC identification documents verification (Aadhaar & PAN).'}
              {currentStep === 5 && 'Bank account details for commissions, allowances, and settlements.'}
              {currentStep === 6 && 'Create manager portal login credentials and finalize status.'}
            </p>
          </div>

          {/* Error / Success Feedback */}
          {addError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}
          {addSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{addSuccess}</span>
            </div>
          )}

          {/* Step Content */}
          <div className="min-h-[260px]">
            {renderStepContent()}
          </div>

          {/* Wizard Footer Navigation */}
          <div className="flex items-center justify-between pt-4 border-t dark:border-slate-700">
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              disabled={currentStep === 1 || addLoading}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentStep === 1
                  ? 'opacity-40 cursor-not-allowed text-slate-400'
                  : isDark
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeAddManager}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>

              {currentStep < STEPS.length ? (
                <button
                  type="button"
                  onClick={() => {
                    const err = validateStep(currentStep);
                    if (!err) {
                      setAddError('');
                      setCurrentStep((s) => Math.min(STEPS.length, s + 1));
                    } else {
                      setAddError(err);
                    }
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddSubmit}
                  disabled={addLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {addLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Register Manager</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
