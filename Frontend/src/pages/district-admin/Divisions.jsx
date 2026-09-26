import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import {
  Layers,
  ArrowRight,
  Phone,
  Building2,
  GraduationCap,
  FileText,
  MapPin,
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
  Eye,
  EyeOff,
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
import { getDivisionsForDistrict, syncTerritoryFromAdmin } from '../../utils/indiaPostalData';

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
  assignedState: '', assignedDistrict: '', divisionName: '', status: 'Active',
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

export function DistrictDivisions() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [allPincodes, setAllPincodes] = useState([]);

  // Add Division Admin Wizard State
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [allDistrictDivisions, setAllDistrictDivisions] = useState([]);
  const [customDivMode, setCustomDivMode] = useState(false);
  const [territoryVersion, setTerritoryVersion] = useState(0);
  const fileRef = useRef();
  const aadharFileRef = useRef();
  const panFileRef = useRef();

  const setF = (patch) => setForm(f => ({ ...f, ...patch }));

  // Auto-fill state & district from logged-in District Admin
  useEffect(() => {
    if (user) {
      setF({
        assignedState: user.state || 'Tamil Nadu',
        state: user.state || 'Tamil Nadu',
        assignedDistrict: user.district || '',
        district: user.district || ''
      });
    }
  }, [user]);

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
      district: row.districtName || user?.district || 'Assigned District',
      state: row.stateName || user?.state || 'Tamil Nadu',
      pincodesCount: row.pincodes?.length || row.pincodesCount || 0,
      pincodes: row.pincodes || [],
      status: row.status || 'Active',
      joinedDate: row.adminCreatedAt ? new Date(row.adminCreatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
      qualification: row.adminQualification || row.qualification || '-',
      course: row.adminCourse || '-',
      institution: row.adminInstitution || '-',
      passingYear: row.adminPassingYear || '-',
      accountHolderName: row.adminAccountHolder || '-',
      bankName: row.adminBankName || '-',
      accountNumber: row.adminAccountNumber || '-',
      ifscCode: row.adminIfsc || '-',
      branchName: row.adminBranch || '-',
      loginId: row.adminLoginId || '-',
      address: row.adminAddress || `Divisional Office, ${row.name || ''}, ${row.districtName || ''}`
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, pinRes] = await Promise.all([
        dataService.getDivisions(),
        dataService.getPincodes().catch(() => ({ success: false }))
      ]);
      if (res.success) {
        const districtName = (user?.district || '').toLowerCase();
        let list = res.divisions || [];
        if (districtName) {
          list = list.filter(
            d => (d.districtName || d.district || '').toLowerCase() === districtName
          );
        }
        setAllDistrictDivisions(list);
        // Only show divisions with registered admins
        const registered = list.filter(d => d.adminName && d.adminName.toLowerCase() !== 'unassigned' && d.adminName.trim() !== '-' && d.adminName.trim() !== '');
        setDivisions(registered);
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
    syncTerritoryFromAdmin().then(() => setTerritoryVersion(v => v + 1)).catch(() => {});
    const onTerritorySync = () => setTerritoryVersion(v => v + 1);
    window.addEventListener('territory_updated', onTerritorySync);
    return () => window.removeEventListener('territory_updated', onTerritorySync);
  }, [user]);

  const handleToggleStatus = async (row) => {
    const currentStatus = row.status || 'Active';
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    setDivisions(prev =>
      prev.map(d => (d.id === row.id || d.name === row.name ? { ...d, status: newStatus } : d))
    );

    try {
      await dataService.updateDivisionStatus(row.id || row.name, newStatus);
    } catch (err) {
      console.error('Failed to update division status', err);
      setDivisions(prev =>
        prev.map(d => (d.id === row.id || d.name === row.name ? { ...d, status: currentStatus } : d))
      );
    }
  };

  const openAdd = () => {
    setForm({
      ...EMPTY_FORM,
      assignedState: user?.state || 'Tamil Nadu',
      state: user?.state || 'Tamil Nadu',
      assignedDistrict: user?.district || '',
      district: user?.district || ''
    });
    setCustomDivMode(false);
    setCurrentStep(1);
    setAddError('');
    setAddSuccess('');
    setShowAddModal(true);
  };

  const closeAdd = () => {
    setShowAddModal(false);
    setCurrentStep(1);
    setAddError('');
    setAddSuccess('');
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
    switch (step) {
      case 1:
        if (!form.fullName.trim()) return 'Please enter the Full Name.';
        if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid Email Address.';
        if (!form.mobile.trim()) return 'Please enter the Mobile Number.';
        if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) return 'Mobile number must be 10 digits and start with 6, 7, 8, or 9.';
        if (form.dob && !is18Plus(form.dob)) return 'Date of Birth must be 18+ years ago (Admin must be at least 18 years old).';
        return null;
      case 2:
        return null;
      case 3:
        return null;
      case 4:
        return null;
      case 5:
        if (!form.divisionName.trim()) return 'Please enter the Division Name.';
        return null;
      case 6:
        if (!form.loginId.trim()) return 'Please enter a Login ID.';
        if (form.password.length < 6) return 'Password must be at least 6 characters.';
        if (form.password !== form.confirmPassword) return 'Password and Confirm Password do not match.';
        return null;
      default:
        return null;
    }
  };

  const canNextStep = () => {
    return !validateStep(currentStep);
  };

  const handleSubmit = async () => {
    setAddError('');
    if (!form.fullName.trim() || !form.email.trim() || !form.divisionName.trim()) {
      setAddError('Full name, email, and division name are required.');
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      setAddError('Passwords do not match.');
      return;
    }

    setAddLoading(true);
    try {
      const payload = {
        adminName: form.fullName,
        email: form.email,
        phone: form.mobile,
        dob: form.dob,
        address: [form.doorStreet, form.area, form.city].filter(Boolean).join(', '),
        city: form.city,
        state: form.state || form.assignedState,
        pincode: form.pincode,
        // documents
        aadharNumber: form.aadharNumber,
        panNumber: form.panNumber,
        accountHolderName: form.accountHolderName,
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode,
        branchName: form.branchName,
        assignedState: form.assignedState,
        assignedDistrict: form.assignedDistrict,
        divisionName: form.divisionName,
        status: form.status,
        loginId: form.loginId,
        password: form.password || 'admin123',
      };

      const res = await dataService.addDivisionAdmin(payload);
      if (res.success) {
        setAddSuccess(res.message || 'Division Admin registered successfully.');
        loadData();
      } else {
        setAddError(res.message || 'Failed to register Division Admin.');
      }
    } catch (err) {
      setAddError(err.message || 'An error occurred. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const inputCls = `w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600'
  }`;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Full Name" required>
                <input type="text" className={inputCls} placeholder="e.g. Rajesh Kannan"
                  value={form.fullName} onChange={e => setF({ fullName: e.target.value })} />
              </FieldInput>
              <FieldInput label="Email Address" required>
                <input type="email" className={inputCls} placeholder="e.g. rajesh.division@admin.com"
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

      case 2:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldInput label="Door No / Street">
                <input type="text" className={inputCls} placeholder="e.g. 15, Gandhi Road"
                  value={form.doorStreet} onChange={e => setF({ doorStreet: e.target.value })} />
              </FieldInput>
            </div>
            <FieldInput label="Area">
              <input type="text" className={inputCls} placeholder="e.g. Rayakottai Road"
                value={form.area} onChange={e => setF({ area: e.target.value })} />
            </FieldInput>
            <FieldInput label="City">
              <input type="text" className={inputCls} placeholder="e.g. Hosur"
                value={form.city} onChange={e => setF({ city: e.target.value })} />
            </FieldInput>
            <FieldInput label="District">
              <input type="text" className={inputCls} placeholder="e.g. Krishnagiri"
                value={form.district} onChange={e => setF({ district: e.target.value })} />
            </FieldInput>
            <FieldInput label="State">
              <input type="text" className={inputCls} placeholder="e.g. Tamil Nadu"
                value={form.state} onChange={e => setF({ state: e.target.value })} />
            </FieldInput>
            <FieldInput label="Pincode">
              <input type="text" className={inputCls} placeholder="e.g. 635109"
                value={form.pincode} onChange={e => setF({ pincode: e.target.value })} />
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

      case 4:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldInput label="Account Holder Name">
                <input type="text" className={inputCls} placeholder="e.g. Rajesh Kannan"
                  value={form.accountHolderName} onChange={e => setF({ accountHolderName: e.target.value })} />
              </FieldInput>
            </div>
            <FieldInput label="Bank Name">
              <input type="text" className={inputCls} placeholder="e.g. State Bank of India"
                value={form.bankName} onChange={e => setF({ bankName: e.target.value })} />
            </FieldInput>
            <FieldInput label="Account Number">
              <input type="text" className={inputCls} placeholder="e.g. 987654321098"
                value={form.accountNumber} onChange={e => setF({ accountNumber: e.target.value })} />
            </FieldInput>
            <FieldInput label="IFSC Code">
              <input type="text" className={inputCls} placeholder="e.g. SBIN0001235"
                value={form.ifscCode} onChange={e => setF({ ifscCode: e.target.value.toUpperCase() })} />
            </FieldInput>
            <FieldInput label="Branch Name">
              <input type="text" className={inputCls} placeholder="e.g. Hosur Main"
                value={form.branchName} onChange={e => setF({ branchName: e.target.value })} />
            </FieldInput>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs ${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
              <strong>Jurisdiction Scope:</strong> Assigned District is automatically set to your district. Enter the Division Name to be created and assigned to this Division Admin.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Assigned State">
                <input type="text" className={`${inputCls} opacity-70 cursor-not-allowed`}
                  value={form.assignedState} readOnly />
              </FieldInput>
              <FieldInput label="Assigned District">
                <input type="text" className={`${inputCls} opacity-70 cursor-not-allowed`}
                  value={form.assignedDistrict} readOnly />
              </FieldInput>
              <div className="sm:col-span-2">
                <FieldInput label="Division Name" required>
                  {(() => {
                    const postalDivs = getDivisionsForDistrict(form.assignedState || user?.state || 'Tamil Nadu', form.assignedDistrict || user?.district || '');
                    const dbDivNames = allDistrictDivisions.map(d => d.name).filter(Boolean);
                    const availableDivList = Array.from(new Set([...dbDivNames, ...postalDivs])).sort();

                    return (
                      <div className="space-y-2">
                        <select
                          className={inputCls}
                          value={customDivMode ? '__custom__' : form.divisionName}
                          onChange={e => {
                            if (e.target.value === '__custom__') {
                              setCustomDivMode(true);
                              setF({ divisionName: '' });
                            } else {
                              setCustomDivMode(false);
                              setF({ divisionName: e.target.value });
                            }
                          }}
                        >
                          <option value="">Select Postal Division</option>
                          {availableDivList.map((divName, idx) => {
                            const existing = divisions.find(d => d.name?.toLowerCase() === divName.toLowerCase());
                            const count = (existing && existing.adminName && existing.adminName !== 'Unassigned') ? 1 : 0;
                            const isFull = count >= 1;
                            return (
                              <option key={idx} value={divName} disabled={isFull}>
                                {divName} — {count}/1 Admin {isFull ? '(FULL)' : '(Available)'}
                              </option>
                            );
                          })}
                          <option value="__custom__">+ Enter Custom Division Name...</option>
                        </select>

                        {customDivMode && (
                          <input
                            type="text"
                            className={inputCls}
                            placeholder="Enter division name (e.g. Tiruchengode)"
                            value={form.divisionName}
                            onChange={e => setF({ divisionName: e.target.value })}
                            autoFocus
                          />
                        )}
                      </div>
                    );
                  })()}
                  <p className="text-[10px] text-slate-400 mt-1">Select from official India Post postal divisions under your district or enter a custom division name.</p>
                </FieldInput>
              </div>
              <div className="sm:col-span-2">
                <FieldInput label="Status">
                  <div className="flex gap-3 mt-1">
                    {['Active', 'Inactive'].map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="divStatus" value={s}
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

      case 6:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs ${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <strong>Account Setup:</strong> Login ID must be unique. Password must be at least 6 characters.
            </div>
            <FieldInput label="Login ID / Username" required>
              <input type="text" className={inputCls} placeholder="e.g. div.hosur.admin"
                value={form.loginId} onChange={e => setF({ loginId: e.target.value })} />
              <p className="text-[10px] text-slate-400 mt-1">Unique login ID for Division Admin portal sign-in.</p>
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
            {/* Registration Summary */}
            <div className={`p-3 rounded-xl border text-xs space-y-1 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <p className="font-semibold text-slate-600 dark:text-slate-300 mb-2">Registration Summary</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div><span className="text-slate-400">Name:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.fullName || '—'}</span></div>
                <div><span className="text-slate-400">Email:</span> <span className={`font-medium font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.email || '—'}</span></div>
                <div><span className="text-slate-400">Division:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.divisionName || '—'}</span></div>
                <div><span className="text-slate-400">District:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.assignedDistrict || '—'}</span></div>
                <div><span className="text-slate-400">Role:</span> <span className="font-semibold text-blue-600">Division Admin</span></div>
                <div><span className="text-slate-400">Status:</span> <span className={`font-semibold ${form.status === 'Active' ? 'text-emerald-600' : 'text-rose-500'}`}>{form.status}</span></div>
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
      header: 'DIVISION NAME / ID',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg border ${
            isDark ? 'bg-indigo-950/80 border-indigo-700/50 text-indigo-400' : 'bg-blue-50 border-blue-100 text-blue-600'
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
      accessor: (row) => {
        const admin = getAdminDetails(row);
        return admin.name;
      },
      render: (row) => {
        const admin = getAdminDetails(row);
        return (
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              isDark ? 'bg-indigo-950/80 text-cyan-300 border border-indigo-800/60' : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}>
              {(admin.name || 'U')[0]}
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
      header: 'PINCODES',
      accessor: (row) => row.pincodes?.length || 0,
      render: (row) => {
        const pinCount = row.pincodes?.length || 0;
        const tooltipDetails = row.pincodes?.join(', ');

        return (
          <div className="flex items-center py-1" title={tooltipDetails ? `Pincodes: ${tooltipDetails}` : ''}>
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
              setSelectedAdmin(getAdminDetails(row));
              setSelectedDivision(row);
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/district-admin/pincodes?division=${encodeURIComponent(row.name)}`);
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
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            District Divisions Management
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Overview of all authorized divisions under this District. Click a row or "View Details" to inspect details.
          </p>
        </div>

        {/* Replaced breadcrumb with + Add Division Admin button */}
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Division Admin</span>
        </button>
      </div>

      <DataTable
        title="Divisions Directory"
        subtitle="Hierarchical administration under assigned district. Click any row or 'View Details' to inspect details."
        columns={columns}
        data={divisions}
        loading={loading}
        onRefresh={loadData}
        searchPlaceholder="Search division name or ID..."
        exportFileName="district_divisions.csv"
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
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>Division Administrator</span>
                        <span>•</span>
                        <span className="font-mono text-blue-500">{selectedAdmin.id}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    selectedAdmin.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedAdmin.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    {selectedAdmin.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                    <div className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      Personal Information
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{selectedAdmin.email}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                      <span className="text-slate-500">Phone:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{selectedAdmin.phone}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Login ID:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{selectedAdmin.loginId || '-'}</span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                    <div className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                      Territory Assignment
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                      <span className="text-slate-500">Division:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{selectedAdmin.division}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                      <span className="text-slate-500">District:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{selectedAdmin.district}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">State:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{selectedAdmin.state}</span>
                    </div>
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
                        onClick={() => navigate(`/district-admin/pincodes?division=${encodeURIComponent(div.name)}`)}
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

      {/* Add Division Admin Modal */}
      <Modal isOpen={showAddModal} onClose={closeAdd} title="Add New Division Administrator" maxWidth="max-w-3xl">
        {addSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Division Admin Registered!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">{addSuccess}</p>
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
                {currentStep === 1 && 'Enter personal details of the Division Admin.'}
                {currentStep === 2 && 'Provide residential or official address.'}
                {currentStep === 3 && 'Enter educational qualification details.'}
                {currentStep === 4 && 'Provide bank account details.'}
                {currentStep === 5 && 'Set division name and jurisdictional assignment.'}
                {currentStep === 6 && 'Set up login credentials for the Division Admin.'}
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
                  {addLoading ? 'Registering...' : <><CheckCircle2 className="w-4 h-4" /> Register Division Admin</>}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
export default DistrictDivisions;
