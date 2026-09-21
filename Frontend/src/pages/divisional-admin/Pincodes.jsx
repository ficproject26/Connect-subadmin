import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import {
  MapPin,
  Phone,
  Building2,
  Plus,
  User,
  Home,
  FileText,
  Landmark,
  ShieldCheck,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Upload,
  Eye,
  EyeOff
} from 'lucide-react';
import { getPincodesForDivision, ALL_INDIAN_STATES, getDistrictsForState } from '../../utils/indiaPostalData';

const STEPS = [
  { id: 1, label: 'Personal',   icon: User },
  { id: 2, label: 'Address',    icon: Home },
  { id: 3, label: 'Document',   icon: FileText },
  { id: 4, label: 'Bank',       icon: Landmark },
  { id: 5, label: 'Assignment', icon: ShieldCheck },
  { id: 6, label: 'Login',      icon: KeyRound },
];

const EMPTY_FORM = {
  fullName: '', email: '', mobile: '', dob: '', profilePhoto: null, profilePhotoPreview: '',
  doorStreet: '', area: '', city: '', district: '', state: '', pincode: '',
  aadharNumber: '', aadharPhoto: null, aadharPhotoPreview: '',
  panNumber: '', panPhoto: null, panPhotoPreview: '',
  accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '', branchName: '',
  assignedState: '', assignedDistrict: '', assignedDivision: '', assignedPincode: '', status: 'Active',
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

const FALLBACK_DIVISIONAL_PINCODES = [
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
    customerCount: 0
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
    customerCount: 0
  }
];

export function DivisionalPincodes() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [pincodes, setPincodes] = useState(FALLBACK_DIVISIONAL_PINCODES);
  const [loading, setLoading] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // Add Pincode Admin Wizard State
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

  const divisionName = user?.division || 'Attur';
  const districtName = user?.district || 'Salem';
  const stateName = user?.state || 'Tamil Nadu';

  const setF = (patch) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => {
    if (user) {
      setF({
        assignedState: user.state || 'Tamil Nadu',
        state: user.state || 'Tamil Nadu',
        assignedDistrict: user.district || '',
        district: user.district || '',
        assignedDivision: user.division || ''
      });
    }
  }, [user]);

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
      division: row.division || row.divisionName || divisionName,
      district: districtName,
      state: user?.state || 'Tamil Nadu',
      totalCustomers: row.customerCount || 0,
      population: row.population || '-',
      status: row.status || 'Active',
      joinedDate: row.joinedDate || '-',
      address: row.address || `Pincode Hub ${row.pincode}, ${districtName}`
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let res = await dataService.getPincodes();
      let list = (res?.success && res.pincodes?.length > 0) ? res.pincodes : FALLBACK_DIVISIONAL_PINCODES;

      // Filter only registered pincode administrators
      list = list.filter(p => {
        const name = p.adminName || p.assignedAdmin || p.admin;
        return name && name !== 'Unassigned' && name !== '-';
      });

      if (divisionName) {
        const normDiv = divisionName.toLowerCase().replace(/tth/g, 'tt').replace(/\s+division/g, '').replace(/^div-/, '').trim();
        const divFiltered = list.filter(p => {
          const pd = (p.division || p.divisionName || '').toLowerCase().replace(/tth/g, 'tt').replace(/\s+division/g, '').replace(/^div-/, '').trim();
          return pd === normDiv || pd.includes(normDiv) || normDiv.includes(pd);
        });
        if (divFiltered.length > 0) {
          list = divFiltered;
        }
      }

      list.sort((a, b) => String(a.pincode).localeCompare(String(b.pincode)));
      setPincodes(list.length > 0 ? list : FALLBACK_DIVISIONAL_PINCODES);
    } catch (e) {
      console.error('Failed to load divisional pincodes:', e);
      setPincodes(FALLBACK_DIVISIONAL_PINCODES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, divisionName]);

  const openAdd = () => {
    setForm({
      ...EMPTY_FORM,
      assignedState: user?.state || 'Tamil Nadu',
      state: user?.state || 'Tamil Nadu',
      assignedDistrict: user?.district || '',
      district: user?.district || '',
      assignedDivision: user?.division || ''
    });
    setCurrentStep(1);
    setAddError('');
    setAddSuccess('');
    setShowAddModal(true);
  };

  const closeAdd = () => {
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
    if (!form.email.trim()) return setAddError('Email is required.');
    if (!form.mobile.trim()) return setAddError('Mobile number is required.');
    if (!form.assignedPincode.trim()) return setAddError('Assigned Pincode is required.');
    if (!form.loginId.trim()) return setAddError('Login ID is required.');
    if (form.password.length < 6) return setAddError('Password must be at least 6 characters.');
    if (form.password !== form.confirmPassword) return setAddError('Passwords do not match.');

    setAddLoading(true);
    try {
      const payload = {
        adminName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.mobile.trim(),
        dob: form.dob,
        address: form.doorStreet,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        aadharNumber: form.aadharNumber,
        panNumber: form.panNumber,
        accountHolderName: form.accountHolderName,
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode,
        branchName: form.branchName,
        assignedState: form.assignedState,
        assignedDistrict: form.assignedDistrict,
        assignedDivision: form.assignedDivision,
        assignedPincode: form.assignedPincode.trim(),
        status: form.status,
        loginId: form.loginId.trim(),
        password: form.password,
      };

      const res = await dataService.addPincodeAdmin(payload);
      if (res.success) {
        setAddSuccess(res.message || 'Pincode Admin registered successfully.');
        loadData();
      } else {
        setAddError(res.message || 'Failed to register Pincode Admin.');
      }
    } catch (err) {
      setAddError(err.message || 'An error occurred. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const canNextStep = () => {
    if (currentStep === 1) return form.fullName.trim() && form.email.trim() && form.mobile.trim();
    if (currentStep === 5) return form.assignedPincode.trim();
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
      accessor: (row) => `${row.district || districtName} ${row.division || divisionName}`,
      render: (row) => {
        const district = row.district || districtName;
        const division = row.division || divisionName;
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <FieldInput label="Full Name" required>
                  <input type="text" className={inputCls} placeholder="e.g. Anand Kumar"
                    value={form.fullName} onChange={e => setF({ fullName: e.target.value })} />
                </FieldInput>
              </div>
              <FieldInput label="Email Address" required>
                <input type="email" className={inputCls} placeholder="e.g. anand@admin.com"
                  value={form.email} onChange={e => setF({ email: e.target.value, loginId: form.loginId || e.target.value })} />
              </FieldInput>
              <FieldInput label="Mobile Number" required>
                <input type="tel" className={inputCls} placeholder="e.g. 9876543210" maxLength={10}
                  value={form.mobile} onChange={e => setF({ mobile: e.target.value.replace(/\D/g, '') })} />
              </FieldInput>
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
                  <span className="text-xs text-slate-400">
                    {form.profilePhoto ? form.profilePhoto.name : 'Choose JPG/PNG photo'}
                  </span>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </div>
              </FieldInput>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldInput label="Door No / Street">
                <input type="text" className={inputCls} placeholder="e.g. 12, Bazaar Street"
                  value={form.doorStreet} onChange={e => setF({ doorStreet: e.target.value })} />
              </FieldInput>
            </div>
            <FieldInput label="Area / Locality">
              <input type="text" className={inputCls} placeholder="e.g. Town Center"
                value={form.area} onChange={e => setF({ area: e.target.value })} />
            </FieldInput>
            <FieldInput label="City / Town">
              <input type="text" className={inputCls} placeholder="e.g. Salem"
                value={form.city} onChange={e => setF({ city: e.target.value })} />
            </FieldInput>
            <FieldInput label="District">
              <select
                className={inputCls}
                value={form.district}
                onChange={e => setF({ district: e.target.value })}
              >
                <option value="">Select District</option>
                {getDistrictsForState(form.state || user?.state || 'Tamil Nadu').map((dName, idx) => (
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
              <input type="text" className={inputCls} placeholder="6-digit PIN" maxLength={6}
                value={form.pincode} onChange={e => setF({ pincode: e.target.value.replace(/\D/g, '') })} />
            </FieldInput>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Aadhaar Number">
                <input type="text" className={inputCls} placeholder="12-digit Aadhaar Number" maxLength={12}
                  value={form.aadharNumber} onChange={e => setF({ aadharNumber: e.target.value.replace(/\D/g, '') })} />
              </FieldInput>
              <FieldInput label="Aadhaar Photo">
                <div onClick={() => aadharFileRef.current?.click()}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed cursor-pointer ${
                    isDark ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400' : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                  }`}>
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">{form.aadharPhoto ? form.aadharPhoto.name : 'Upload Aadhaar Card'}</span>
                  <input ref={aadharFileRef} type="file" accept="image/*" className="hidden" onChange={handleAadharUpload} />
                </div>
              </FieldInput>
              <FieldInput label="PAN Card Number">
                <input type="text" className={inputCls} placeholder="10-digit PAN (e.g. ABCDE1234F)" maxLength={10}
                  value={form.panNumber} onChange={e => setF({ panNumber: e.target.value.toUpperCase() })} />
              </FieldInput>
              <FieldInput label="PAN Photo">
                <div onClick={() => panFileRef.current?.click()}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed cursor-pointer ${
                    isDark ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400' : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                  }`}>
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">{form.panPhoto ? form.panPhoto.name : 'Upload PAN Card'}</span>
                  <input ref={panFileRef} type="file" accept="image/*" className="hidden" onChange={handlePanUpload} />
                </div>
              </FieldInput>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <FieldInput label="Account Holder Name">
              <input type="text" className={inputCls} placeholder="e.g. Anand Kumar"
                value={form.accountHolderName} onChange={e => setF({ accountHolderName: e.target.value })} />
            </FieldInput>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Bank Name">
                <input type="text" className={inputCls} placeholder="e.g. State Bank of India"
                  value={form.bankName} onChange={e => setF({ bankName: e.target.value })} />
              </FieldInput>
              <FieldInput label="Account Number">
                <input type="text" className={inputCls} placeholder="e.g. 123456789012"
                  value={form.accountNumber} onChange={e => setF({ accountNumber: e.target.value.replace(/\D/g, '') })} />
              </FieldInput>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="IFSC Code">
                <input type="text" className={inputCls} placeholder="e.g. SBIN0001234" maxLength={11}
                  value={form.ifscCode} onChange={e => setF({ ifscCode: e.target.value.toUpperCase() })} />
              </FieldInput>
              <FieldInput label="Branch Name">
                <input type="text" className={inputCls} placeholder="e.g. Attur Town Branch"
                  value={form.branchName} onChange={e => setF({ branchName: e.target.value })} />
              </FieldInput>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs ${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
              <strong>Jurisdiction Policy:</strong> Each PIN Code has a maximum limit of <strong>1 Pincode Admin</strong>. Assigned State, District, and Division are automatically populated.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FieldInput label="Assigned State">
                <input type="text" className={`${inputCls} opacity-70 cursor-not-allowed`}
                  value={form.assignedState} readOnly />
              </FieldInput>
              <FieldInput label="Assigned District">
                <input type="text" className={`${inputCls} opacity-70 cursor-not-allowed`}
                  value={form.assignedDistrict} readOnly />
              </FieldInput>
              <FieldInput label="Assigned Division">
                <input type="text" className={`${inputCls} opacity-70 cursor-not-allowed`}
                  value={form.assignedDivision} readOnly />
              </FieldInput>
            </div>
            <FieldInput label="Assigned PIN Code" required>
              <select
                className={inputCls}
                value={form.assignedPincode}
                onChange={e => setF({ assignedPincode: e.target.value })}
              >
                <option value="">Select PIN Code to Assign</option>
                {getPincodesForDivision(
                  form.assignedState || user?.state || 'Tamil Nadu',
                  form.assignedDistrict || user?.district || 'Salem',
                  form.assignedDivision || user?.division || 'Attur'
                ).map((pin, idx) => {
                  const existing = pincodes.find(p => p.pincode === pin);
                  const isAssigned = existing && existing.adminName && existing.adminName !== 'Unassigned';
                  return (
                    <option key={idx} value={pin} disabled={isAssigned}>
                      PIN: {pin} — {isAssigned ? '1/1 Admin (FULL)' : '0/1 Admin (Available)'}
                    </option>
                  );
                })}
              </select>
            </FieldInput>
            <FieldInput label="Status">
              <div className="flex gap-3 mt-1">
                {['Active', 'Inactive'].map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="pinStatus" value={s}
                      checked={form.status === s}
                      onChange={() => setF({ status: s })}
                      className="w-4 h-4 accent-blue-600" />
                    <span className={`text-sm font-semibold ${s === 'Active' ? 'text-emerald-600' : 'text-rose-500'}`}>{s}</span>
                  </label>
                ))}
              </div>
            </FieldInput>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs ${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <strong>Account Setup:</strong> Login ID must be unique. Password must be at least 6 characters.
            </div>
            <FieldInput label="Login ID / Username" required>
              <input type="text" className={inputCls} placeholder="e.g. pin.636102.admin"
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
              </FieldInput>
            </div>
            {/* Registration Summary */}
            <div className={`p-3 rounded-xl border text-xs space-y-1 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <p className="font-semibold text-slate-600 dark:text-slate-300 mb-2">Registration Summary</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div><span className="text-slate-400">Name:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.fullName || '—'}</span></div>
                <div><span className="text-slate-400">Email:</span> <span className={`font-medium font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.email || '—'}</span></div>
                <div><span className="text-slate-400">Pincode:</span> <span className={`font-bold font-mono ${isDark ? 'text-cyan-300' : 'text-blue-600'}`}>{form.assignedPincode || '—'}</span></div>
                <div><span className="text-slate-400">Division:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.assignedDivision || '—'}</span></div>
                <div><span className="text-slate-400">District:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.assignedDistrict || '—'}</span></div>
                <div><span className="text-slate-400">Role:</span> <span className="font-semibold text-blue-600">Pincode Admin</span></div>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Division Pincodes Directory
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            All registered pincode service zones and appointed local administrators across the Division. Click a row to view Admin details.
          </p>
        </div>

        {/* Add Pincode Admin Button */}
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Pincode Admin</span>
        </button>
      </div>

      <DataTable
        title="Division Pincodes Registry"
        subtitle="Manage pincode coverage and serviceability parameters. Click any row to inspect Admin details."
        columns={columns}
        data={pincodes}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search pincode or area name..."
        exportFileName="division_pincodes.csv"
        onRowClick={(row) => setSelectedAdmin(getPincodeAdminDetails(row))}
      />

      {/* Add Pincode Admin Wizard Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={closeAdd}
        title="Add Pincode Administrator"
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
          <div className={`pb-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Step {currentStep}: {STEPS[currentStep - 1].label} Details
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentStep === 1 && 'Enter the personal information of the Pincode Admin.'}
              {currentStep === 2 && 'Provide residential or local station address.'}
              {currentStep === 3 && 'Upload government identity documents (Aadhaar & PAN).'}
              {currentStep === 4 && 'Provide bank account details for operational disbursals.'}
              {currentStep === 5 && 'Assign postal PIN code coverage and station status.'}
              {currentStep === 6 && 'Set up login credentials for Pincode Admin portal access.'}
            </p>
          </div>

          {/* Error Alert */}
          {addError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
              {addError}
            </div>
          )}

          {/* Success Alert */}
          {addSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span>{addSuccess}</span>
              <button
                type="button"
                onClick={closeAdd}
                className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
              >
                Close
              </button>
            </div>
          )}

          {/* Step Body */}
          {!addSuccess && (
            <>
              <div className="min-h-[220px]">
                {renderStepContent()}
              </div>

              {/* Wizard Nav Buttons */}
              <div className="flex items-center justify-between pt-3 border-t dark:border-slate-700">
                <button
                  type="button"
                  disabled={currentStep === 1}
                  onClick={() => { setAddError(''); setCurrentStep(s => s - 1); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                    currentStep === 1
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700 cursor-pointer'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <div className="text-xs text-slate-400 font-medium">
                  {currentStep} / {STEPS.length}
                </div>

                {currentStep < 6 ? (
                  <button
                    type="button"
                    disabled={!canNextStep()}
                    onClick={() => { setAddError(''); setCurrentStep(s => s + 1); }}
                    className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white transition ${
                      canNextStep()
                        ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm'
                        : 'bg-blue-400 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={addLoading || !canNextStep()}
                    onClick={handleAddSubmit}
                    className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white transition ${
                      addLoading
                        ? 'bg-emerald-400 opacity-60 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-sm'
                    }`}
                  >
                    {addLoading ? (
                      <span>Registering...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm & Register</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

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
