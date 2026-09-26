import React, { useState, useEffect, useRef } from 'react';
import { dataService } from '../services/dataService';
import { resolvePincodeHierarchy } from '../utils/pincodeDirectory';
import { useAuth } from '../context/AuthContext';
import {
  Store, User, Phone, Mail, MapPin, Globe, Clock, Image as ImageIcon,
  FileText, CreditCard, Building2, CheckCircle, AlertCircle,
  ChevronRight, ChevronLeft, Eye, EyeOff, Upload, X, Lock,
  Hash, Shield, Briefcase, Camera, BadgeCheck
} from 'lucide-react';

/* ─── Constants ──────────────────────────────────────────── */
const STEPS = [
  { id: 1, label: 'Business',  short: '1', icon: Store },
  { id: 2, label: 'Owner',     short: '2', icon: User },
  { id: 3, label: 'Documents', short: '3', icon: FileText },
  { id: 4, label: 'Bank',      short: '4', icon: CreditCard },
  { id: 5, label: 'Review',    short: '5', icon: BadgeCheck },
];

const CATEGORIES = ['Services', 'Products', 'Daily Needs', 'Food', 'Stay', 'Travel', 'Jobs'];

const blank = {
  businessName: '', logo: null, logoPreview: null,
  category: 'Services', businessPhone: '', email: '',
  address: '', pincode: '', website: '', operatingHours: '',
  businessImages: [], businessImagePreviews: [],
  ownerName: '', alternatePhone: '', agentName: '', coPartnerName: '',
  password: '', confirmPassword: '',
  panNumber: '', aadhaarNumber: '', companyRegNumber: '',
  gstStatus: 'Registered', msmeStatus: 'Not Registered', businessLicense: null,
  accountHolderName: '', bankName: '', bankBranch: '', bankStreet: '',
  bankCity: '', accountNumber: '', ifsc: '',
  declaration: false,
};

/* ─── Validators ─────────────────────────────────────────── */
const phoneOk  = v => /^[6-9]\d{9}$/.test(v.replace(/\s/g, ''));
const panOk    = v => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.toUpperCase());
const aadhaarOk= v => /^\d{12}$/.test(v.replace(/\s/g, ''));
const ifscOk   = v => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase());

const maskAadhaar = v => v ? v.replace(/\d(?=\d{4})/g,'•') : '';
const maskAccount = v => v && v.length > 4 ? '•'.repeat(v.length - 4) + v.slice(-4) : v;

/* ─── Step Indicator ─────────────────────────────────────── */
function StepBar({ current }) {
  return (
    <div className="flex items-center w-full px-1 mb-4">
      {STEPS.map((s, i) => {
        const done   = current > s.id;
        const active = current === s.id;
        const Icon   = s.icon;
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                done   ? 'bg-gradient-to-br from-blue-600 to-violet-600 border-transparent shadow-md shadow-blue-400/40' :
                active ? 'bg-white dark:bg-slate-900 border-blue-600 shadow shadow-blue-400/20' :
                         'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                {done
                  ? <CheckCircle className="w-4 h-4 text-white" />
                  : <Icon className={`w-3.5 h-3.5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />}
              </div>
              <span className={`text-[9px] font-semibold mt-1 whitespace-nowrap ${
                active ? 'text-blue-600' : done ? 'text-violet-500' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 mx-1 mb-3.5 h-0.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                <div className={`h-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-500 ${done ? 'w-full' : 'w-0'}`} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── Field wrapper ──────────────────────────────────────── */
function Field({ label, required, icon: Icon, error, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <div className="relative">{children}</div>
      {error && (
        <p className="mt-1 text-[10px] text-rose-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

const ic = (icon=true, err=false) =>
  `w-full ${icon?'pl-9':'pl-3'} pr-3 py-[7px] text-xs rounded-lg border ${
    err ? 'border-rose-400 focus:ring-rose-300' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-400'
  } bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:outline-none transition`;

const sc = (icon=true) =>
  `w-full ${icon?'pl-9':'pl-3'} pr-3 py-[7px] text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none cursor-pointer transition`;

/* ─── Review row ─────────────────────────────────────────── */
const RRow = ({ label, value }) => (
  <div>
    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
    <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium mt-0.5 break-all">{value || '—'}</p>
  </div>
);

const RSection = ({ title, icon: Icon, children }) => (
  <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden mb-2.5">
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
      <Icon className="w-3.5 h-3.5 text-blue-600" />
      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{title}</span>
    </div>
    <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export function RegisterVendorModal({ isOpen, onClose, onVendorCreated, initialPincode = '' }) {
  const { user } = useAuth();
  const isPincodeLocked = Boolean(
    user?.pincode && 
    (user.role?.toLowerCase().includes('pincode') || user.role?.toLowerCase().includes('agent'))
  );

  const defaultPin = initialPincode || (isPincodeLocked ? user?.pincode : '') || '';

  const [step,        setStep]        = useState(1);
  const [form,        setForm]        = useState({ ...blank, pincode: defaultPin });
  const [errors,      setErrors]      = useState({});
  const [showPw,      setShowPw]      = useState(false);
  const [showCPw,     setShowCPw]     = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [globalError, setGlobalError] = useState('');

  const logoRef    = useRef(null);
  const imgRef     = useRef(null);
  const licenseRef = useRef(null);
  const bodyRef    = useRef(null);

  useEffect(() => {
    const pin = initialPincode || (isPincodeLocked ? user?.pincode : '') || '';
    setForm(p => ({ ...p, pincode: pin }));
  }, [initialPincode, user]);

  useEffect(() => {
    if (!isOpen) {
      const pin = initialPincode || (isPincodeLocked ? user?.pincode : '') || '';
      const t = setTimeout(() => {
        setStep(1); setForm({ ...blank, pincode: pin });
        setErrors({}); setGlobalError('');
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen, user]);

  // Scroll body back to top on every step change
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [step]);

  if (!isOpen) return null;

  /* helpers */
  const upd = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => { const e={...p}; delete e[k]; return e; });
  };
  const onChange = e => {
    const { name, value, type, checked } = e.target;
    upd(name, type === 'checkbox' ? checked : value);
  };

  /* file handlers */
  const onLogo = e => {
    const f = e.target.files[0];
    if (f) { upd('logo', f); upd('logoPreview', URL.createObjectURL(f)); }
  };
  const onImgs = e => {
    const files = Array.from(e.target.files);
    const all   = [...form.businessImages,        ...files].slice(0,5);
    const prev  = [...form.businessImagePreviews, ...files.map(f=>URL.createObjectURL(f))].slice(0,5);
    upd('businessImages', all); upd('businessImagePreviews', prev);
  };
  const rmImg = idx => {
    upd('businessImages',        form.businessImages.filter((_,i)=>i!==idx));
    upd('businessImagePreviews', form.businessImagePreviews.filter((_,i)=>i!==idx));
  };
  const onLicense = e => { if(e.target.files[0]) upd('businessLicense', e.target.files[0]); };

  /* validation */
  const validate = s => {
    const e = {};
    if (s===1) {
      if (!form.businessName.trim())  e.businessName  = 'Business name is required';
      if (!form.businessPhone.trim()) e.businessPhone = 'Business phone is required';
      else if (!phoneOk(form.businessPhone)) e.businessPhone = 'Must be 10 digits starting with 6–9';
      if (!form.email.trim())         e.email    = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address';
      if (!form.address.trim())       e.address  = 'Business address is required';
      if (!form.pincode.trim() || form.pincode.length!==6) e.pincode = 'Enter a valid 6-digit pincode';
    }
    if (s===2) {
      if (!form.ownerName.trim()) e.ownerName = 'Owner name is required';
      if (form.alternatePhone.trim() && !phoneOk(form.alternatePhone))
        e.alternatePhone = 'Must be 10 digits starting with 6–9';
      if (!form.password)        e.password = 'Password is required';
      else if (form.password.length < 8) e.password = 'At least 8 characters';
      if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password';
      else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    if (s===3) {
      if (!form.panNumber.trim())    e.panNumber    = 'PAN number is required';
      else if (!panOk(form.panNumber)) e.panNumber  = 'Invalid PAN (e.g. ABCDE1234F)';
      if (!form.aadhaarNumber.trim()) e.aadhaarNumber = 'Aadhaar number is required';
      else if (!aadhaarOk(form.aadhaarNumber)) e.aadhaarNumber = 'Must be 12 digits';
    }
    if (s===4) {
      if (!form.accountHolderName.trim()) e.accountHolderName = 'Required';
      if (!form.bankName.trim())   e.bankName   = 'Bank name is required';
      if (!form.bankBranch.trim()) e.bankBranch = 'Branch is required';
      if (!form.accountNumber.trim()) e.accountNumber = 'Account number is required';
      else if (form.accountNumber.length < 9 || form.accountNumber.length > 18)
        e.accountNumber = 'Must be 9–18 digits';
      if (!form.ifsc.trim())    e.ifsc = 'IFSC is required';
      else if (!ifscOk(form.ifsc)) e.ifsc = 'Invalid IFSC (e.g. HDFC0001234)';
    }
    if (s===5 && !form.declaration) e.declaration = 'Please accept the declaration to proceed';
    return e;
  };

  const next = () => {
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setStep(s=>s+1);
  };
  const prev = () => { setErrors({}); setStep(s=>s-1); };

  /* submit */
  const submit = async () => {
    const e = validate(5);
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true); setGlobalError('');
    try {
      const resolved = resolvePincodeHierarchy(form.pincode.trim());
      const stateVal = resolved.state || user?.state || 'Tamil Nadu';
      const districtVal = resolved.district || user?.district || '';
      const divisionVal = resolved.division || user?.division || '';

      const payload  = {
        businessName: form.businessName.trim(), name: form.businessName.trim(),
        category: form.category,
        mobile: form.businessPhone.replace(/\s/g,''), phone: form.businessPhone.replace(/\s/g,''),
        email: form.email.trim(), address: form.address.trim(), pincode: form.pincode.trim(),
        website: form.website.trim(), operatingHours: form.operatingHours.trim(),
        ownerName: form.ownerName.trim(), contactPerson: form.ownerName.trim(),
        alternatePhone: form.alternatePhone.trim(), agentName: form.agentName.trim(),
        coPartnerName: form.coPartnerName.trim(), password: form.password,
        panNumber: form.panNumber.toUpperCase().trim(),
        aadhaarNumber: form.aadhaarNumber.replace(/\s/g,''),
        companyRegNumber: form.companyRegNumber.trim(),
        gstStatus: form.gstStatus, msmeStatus: form.msmeStatus,
        accountHolderName: form.accountHolderName.trim(), bankName: form.bankName.trim(),
        bankBranch: form.bankBranch.trim(), bankStreet: form.bankStreet.trim(),
        bankCity: form.bankCity.trim(), accountNumber: form.accountNumber.trim(),
        ifsc: form.ifsc.toUpperCase().trim(),
        state: stateVal, district: districtVal, division: divisionVal,
        addedBy: {
          id: user?._id || user?.id || 'admin',
          name: user?.name || 'Administrator',
          role: user?.role || 'Admin',
          pincode: form.pincode.trim(),
          division: divisionVal,
          district: districtVal,
          state: stateVal
        }
      };
      const res = await dataService.createVendor(payload);
      if (res.success) { if (onVendorCreated) onVendorCreated(res.vendor); onClose(); }
      else setGlobalError(res.message || 'Failed to register vendor');
    } catch (err) {
      setGlobalError(err.message || 'Failed to register vendor');
    } finally { setSubmitting(false); }
  };

  /* ── Step 1 ── */
  const step1 = (
    <div className="grid grid-cols-2 gap-3">
      {/* Business Name — full width */}
      <div className="col-span-2">
        <Field label="Business / Shop Name" required error={errors.businessName}>
          <Store className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input type="text" name="businessName" value={form.businessName}
            onChange={onChange} placeholder="e.g. Fresh Grocers"
            className={ic(true, !!errors.businessName)} />
        </Field>
      </div>

      {/* Logo upload */}
      <div className="col-span-2">
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
          Shop / Brand Logo
        </label>
        <div
          onClick={() => logoRef.current?.click()}
          className="flex items-center gap-3 px-3 py-2 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition"
        >
          {form.logoPreview
            ? <img src={form.logoPreview} alt="logo" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
            : <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-slate-400" />
              </div>}
          <div>
            <p className="text-xs font-semibold text-blue-600">{form.logo ? form.logo.name : 'Click to upload logo'}</p>
            <p className="text-[10px] text-slate-400">PNG, JPG up to 2MB</p>
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
        </div>
      </div>

      {/* Category */}
      <Field label="Product / Service Category" required error={errors.category}>
        <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <select name="category" value={form.category} onChange={onChange} className={sc()}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>

      {/* Phone */}
      <Field label="Business Phone" required error={errors.businessPhone}>
        <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="tel" name="businessPhone" value={form.businessPhone} maxLength={10}
          onChange={e => upd('businessPhone', e.target.value.replace(/\D/g,'').slice(0,10))}
          placeholder="9876543210"
          className={ic(true, !!errors.businessPhone)} />
      </Field>

      {/* Email */}
      <Field label="Email Address" required error={errors.email}>
        <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="email" name="email" value={form.email}
          onChange={onChange} placeholder="contact@shop.com"
          className={ic(true, !!errors.email)} />
      </Field>

      {/* Pincode */}
      <Field label={`PIN Code ${isPincodeLocked ? '(Locked to your Territory)' : ''}`} required error={errors.pincode}>
        <MapPin className="w-3.5 h-3.5 text-blue-500 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="text" name="pincode" value={form.pincode} maxLength={6}
          readOnly={isPincodeLocked}
          onChange={e => !isPincodeLocked && upd('pincode', e.target.value.replace(/\D/g,'').slice(0,6))}
          placeholder="6-digit Pincode"
          className={ic(true, !!errors.pincode) + ' font-mono font-bold ' + (isPincodeLocked ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : '')} />
      </Field>

      {/* Territory auto-derived display */}
      {(() => {
        const res = resolvePincodeHierarchy(form.pincode);
        const resolvedDiv = res.division || user?.division;
        const resolvedDist = res.district || user?.district;
        const resolvedState = res.state || user?.state || 'Tamil Nadu';
        if (form.pincode && form.pincode.length === 6) {
          return (
            <div className="col-span-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs flex items-center justify-between">
              <span className="text-blue-700 dark:text-blue-300 font-semibold">Hierarchy Scope:</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-white">
                <span>{resolvedState}</span>
                <span className="text-slate-400">›</span>
                <span>{resolvedDist || 'District'}</span>
                <span className="text-slate-400">›</span>
                <span>{resolvedDiv || 'Division'}</span>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Address — full width */}
      <div className="col-span-2">
        <Field label="Business Address" required error={errors.address}>
          <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input type="text" name="address" value={form.address}
            onChange={onChange} placeholder="Street, Area, City"
            className={ic(true, !!errors.address)} />
        </Field>
      </div>

      {/* Website */}
      <Field label="Website (Optional)">
        <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="url" name="website" value={form.website}
          onChange={onChange} placeholder="https://yourwebsite.com"
          className={ic()} />
      </Field>

      {/* Operating Hours - Time Slot Method */}
      <div className="col-span-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Business Operating Hours & Time Slots
          </label>
          {form.operatingHours && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200">
              Active: {form.operatingHours}
            </span>
          )}
        </div>
        
        {/* Quick Slot Presets */}
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {[
            { label: 'General Retail', slot: '09:00 AM - 09:00 PM' },
            { label: 'Commercial / Mall', slot: '10:00 AM - 10:00 PM' },
            { label: 'Daily Needs', slot: '08:00 AM - 08:00 PM' },
            { label: 'Morning Shift', slot: '06:00 AM - 02:00 PM' },
            { label: 'Food & Dining', slot: '11:00 AM - 11:00 PM' },
            { label: '24/7', slot: 'Open 24/7' }
          ].map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => setForm(prev => ({ ...prev, operatingHours: p.slot }))}
              className={`text-[10px] px-2.5 py-1 rounded-md border transition ${
                form.operatingHours === p.slot
                  ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
              }`}
            >
              {p.label} <span className="opacity-75 text-[9px]">({p.slot})</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            name="operatingHours"
            value={form.operatingHours}
            onChange={onChange}
            placeholder="09:00 AM - 09:00 PM (or select a preset above)"
            className={ic()}
          />
        </div>
      </div>

      {/* Business Images */}
      <div className="col-span-2">
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
          Business Images <span className="font-normal text-slate-400">(Optional, max 5)</span>
        </label>
        <div
          onClick={() => form.businessImages.length < 5 && imgRef.current?.click()}
          className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer transition min-h-[48px]"
        >
          {form.businessImagePreviews.map((src,i) => (
            <div key={i} className="relative shrink-0">
              <img src={src} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
              <button type="button" onClick={e=>{e.stopPropagation();rmImg(i);}}
                className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center">
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          ))}
          {form.businessImages.length < 5 && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <ImageIcon className="w-4 h-4" />
              <span className="text-[10px]">{form.businessImages.length === 0 ? 'Upload images' : 'Add more'}</span>
            </div>
          )}
          <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={onImgs} />
        </div>
      </div>
    </div>
  );

  /* ── Step 2 ── */
  const step2 = (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Owner / Contact Person Name" required error={errors.ownerName}>
          <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input type="text" name="ownerName" value={form.ownerName}
            onChange={onChange} placeholder="Full legal name"
            className={ic(true, !!errors.ownerName)} />
        </Field>
      </div>

      <Field label="Alternate Phone (Optional)" error={errors.alternatePhone}>
        <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="tel" name="alternatePhone" value={form.alternatePhone} maxLength={10}
          onChange={e => upd('alternatePhone', e.target.value.replace(/\D/g,'').slice(0,10))}
          placeholder="Alternate number"
          className={ic(true, !!errors.alternatePhone)} />
      </Field>

      <Field label="Agent Name (Optional)">
        <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="text" name="agentName" value={form.agentName}
          onChange={onChange} placeholder="Agent name"
          className={ic()} />
      </Field>

      <div className="col-span-2">
        <Field label="Co-partner Name (Optional)">
          <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input type="text" name="coPartnerName" value={form.coPartnerName}
            onChange={onChange} placeholder="Co-partner name"
            className={ic()} />
        </Field>
      </div>

      <Field label="Account Password" required error={errors.password}>
        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type={showPw ? 'text' : 'password'} name="password" value={form.password}
          onChange={onChange} placeholder="Min. 8 characters"
          className={ic(true, !!errors.password) + ' pr-9'} />
        <button type="button" onClick={() => setShowPw(p=>!p)}
          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
          {showPw ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
        </button>
      </Field>

      <Field label="Confirm Password" required error={errors.confirmPassword}>
        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type={showCPw ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword}
          onChange={onChange} placeholder="Re-enter password"
          className={ic(true, !!errors.confirmPassword) + ' pr-9'} />
        <button type="button" onClick={() => setShowCPw(p=>!p)}
          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
          {showCPw ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
        </button>
      </Field>
    </div>
  );

  /* ── Step 3 ── */
  const step3 = (
    <div className="grid grid-cols-2 gap-3">
      <Field label="PAN Number" required error={errors.panNumber}>
        <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="text" name="panNumber" value={form.panNumber} maxLength={10}
          onChange={e => upd('panNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10))}
          placeholder="ABCDE1234F"
          className={ic(true,!!errors.panNumber) + ' font-mono font-bold tracking-widest uppercase'} />
      </Field>

      <Field label="Aadhaar Number" required error={errors.aadhaarNumber}>
        <Shield className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="text" name="aadhaarNumber" value={form.aadhaarNumber} maxLength={12}
          onChange={e => upd('aadhaarNumber', e.target.value.replace(/\D/g,'').slice(0,12))}
          placeholder="12-digit number"
          className={ic(true,!!errors.aadhaarNumber) + ' font-mono font-bold tracking-widest'} />
      </Field>

      <div className="col-span-2">
        <Field label="Company Registration Number (Optional)">
          <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input type="text" name="companyRegNumber" value={form.companyRegNumber}
            onChange={onChange} placeholder="Optional"
            className={ic()} />
        </Field>
      </div>

      <Field label="GST Status">
        <CheckCircle className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <select name="gstStatus" value={form.gstStatus} onChange={onChange} className={sc()}>
          <option>Registered</option>
          <option>Not Registered</option>
          <option>Applied</option>
        </select>
      </Field>

      <Field label="MSME Status">
        <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <select name="msmeStatus" value={form.msmeStatus} onChange={onChange} className={sc()}>
          <option>Registered</option>
          <option>Not Registered</option>
          <option>Applied</option>
        </select>
      </Field>

      <div className="col-span-2">
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
          Business License / Document
        </label>
        <div onClick={() => licenseRef.current?.click()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer transition">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${form.businessLicense ? 'bg-green-100 dark:bg-green-900/30':'bg-slate-100 dark:bg-slate-800'}`}>
            {form.businessLicense
              ? <CheckCircle className="w-4.5 h-4.5 text-green-600" />
              : <Upload className="w-4.5 h-4.5 text-slate-400" />}
          </div>
          <div>
            {form.businessLicense
              ? <><p className="text-xs font-semibold text-green-600">Uploaded</p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[220px]">{form.businessLicense.name}</p></>
              : <><p className="text-xs font-semibold text-blue-600">Click to upload document</p>
                  <p className="text-[10px] text-slate-400">PDF, JPG, PNG up to 5MB</p></>}
          </div>
          <input ref={licenseRef} type="file" accept=".pdf,image/*" className="hidden" onChange={onLicense} />
        </div>
      </div>
    </div>
  );

  /* ── Step 4 ── */
  const step4 = (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Account Holder Name" required error={errors.accountHolderName}>
          <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input type="text" name="accountHolderName" value={form.accountHolderName}
            onChange={onChange} placeholder="As on bank records"
            className={ic(true,!!errors.accountHolderName)} />
        </Field>
      </div>

      <Field label="Bank Name" required error={errors.bankName}>
        <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="text" name="bankName" value={form.bankName}
          onChange={onChange} placeholder="e.g. HDFC Bank"
          className={ic(true,!!errors.bankName)} />
      </Field>

      <Field label="Bank Branch" required error={errors.bankBranch}>
        <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="text" name="bankBranch" value={form.bankBranch}
          onChange={onChange} placeholder="Branch name"
          className={ic(true,!!errors.bankBranch)} />
      </Field>

      <Field label="Bank Street (Optional)">
        <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="text" name="bankStreet" value={form.bankStreet}
          onChange={onChange} placeholder="Street address"
          className={ic()} />
      </Field>

      <Field label="Bank City (Optional)">
        <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="text" name="bankCity" value={form.bankCity}
          onChange={onChange} placeholder="City"
          className={ic()} />
      </Field>

      <Field label="Account Number" required error={errors.accountNumber}>
        <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="text" name="accountNumber" value={form.accountNumber} maxLength={18}
          onChange={e => upd('accountNumber', e.target.value.replace(/\D/g,'').slice(0,18))}
          placeholder="9–18 digit number"
          className={ic(true,!!errors.accountNumber) + ' font-mono font-bold tracking-widest'} />
      </Field>

      <Field label="IFSC Code" required error={errors.ifsc}>
        <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        <input type="text" name="ifsc" value={form.ifsc} maxLength={11}
          onChange={e => upd('ifsc', e.target.value.toUpperCase().slice(0,11))}
          placeholder="HDFC0001234"
          className={ic(true,!!errors.ifsc) + ' font-mono font-bold uppercase tracking-widest'} />
      </Field>
    </div>
  );

  /* ── Step 5 – Review ── */
  const step5 = (
    <div className="space-y-0">
      <RSection title="Business Information" icon={Store}>
        <RRow label="Business Name"   value={form.businessName} />
        <RRow label="Category"        value={form.category} />
        <RRow label="Phone"           value={form.businessPhone} />
        <RRow label="Email"           value={form.email} />
        <RRow label="Address"         value={form.address} />
        <RRow label="Pincode"         value={form.pincode} />
        <RRow label="Website"         value={form.website || 'Not provided'} />
        <RRow label="Operating Hours" value={form.operatingHours || 'Not provided'} />
      </RSection>

      <RSection title="Owner Information" icon={User}>
        <RRow label="Owner Name"     value={form.ownerName} />
        <RRow label="Alternate Phone"value={form.alternatePhone || 'Not provided'} />
        <RRow label="Agent Name"     value={form.agentName || 'Not provided'} />
        <RRow label="Co-partner"     value={form.coPartnerName || 'Not provided'} />
      </RSection>

      <RSection title="Documents" icon={FileText}>
        <RRow label="PAN Number"       value={form.panNumber} />
        <RRow label="Aadhaar"          value={maskAadhaar(form.aadhaarNumber)} />
        <RRow label="Company Reg. No." value={form.companyRegNumber || 'Not provided'} />
        <RRow label="GST Status"       value={form.gstStatus} />
        <RRow label="MSME Status"      value={form.msmeStatus} />
        <RRow label="Business License" value={form.businessLicense ? form.businessLicense.name : 'Not uploaded'} />
      </RSection>

      <RSection title="Bank Details" icon={CreditCard}>
        <RRow label="Account Holder" value={form.accountHolderName} />
        <RRow label="Bank Name"      value={form.bankName} />
        <RRow label="Branch"         value={form.bankBranch} />
        <RRow label="Account No."   value={maskAccount(form.accountNumber)} />
        <RRow label="IFSC Code"      value={form.ifsc} />
        {form.bankCity && <RRow label="City" value={form.bankCity} />}
      </RSection>

      {/* Declaration */}
      <div className={`rounded-xl border-2 p-3 mt-2 ${errors.declaration
        ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20'
        : 'border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20'}`}>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" name="declaration" checked={form.declaration}
            onChange={onChange}
            className="mt-0.5 w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0" />
          <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
            I declare that all the information provided is true and accurate to the best of my knowledge. False information may result in rejection or legal action.
          </span>
        </label>
        {errors.declaration && (
          <p className="mt-1.5 text-[10px] text-rose-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />{errors.declaration}
          </p>
        )}
      </div>
    </div>
  );

  const stepContent = [step1, step2, step3, step4, step5];

  /* ── Render ── */
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* card */}
      <div className="relative w-full max-w-[640px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col"
           style={{ maxHeight: 'min(90vh, 780px)' }}>

        {/* ─ Header ─ */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Vendor Onboarding
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Step {step} of {STEPS.length} — <span className="font-semibold text-blue-600">{STEPS[step-1].label}</span>
              </p>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 ml-3">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <StepBar current={step} />
        </div>

        {/* ─ Body ─ */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
          {globalError && (
            <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{globalError}
            </div>
          )}
          {stepContent[step - 1]}
        </div>

        {/* ─ Footer ─ */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <button type="button" onClick={step === 1 ? onClose : prev}
            className="inline-flex items-center gap-1 px-3.5 py-[7px] text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
            <ChevronLeft className="w-3.5 h-3.5" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {/* dot progress */}
          <div className="flex items-center gap-1.5">
            {STEPS.map(s => (
              <div key={s.id} className={`rounded-full transition-all duration-300 ${
                s.id === step  ? 'w-5 h-2 bg-blue-600' :
                s.id < step   ? 'w-2 h-2 bg-violet-500' :
                                 'w-2 h-2 bg-slate-200 dark:bg-slate-700'}`} />
            ))}
          </div>

          {step < 5 ? (
            <button type="button" onClick={next}
              className="inline-flex items-center gap-1 px-4 py-[7px] text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-md shadow-blue-500/25 transition cursor-pointer">
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting}
              className="inline-flex items-center gap-1 px-4 py-[7px] text-xs font-semibold rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-md shadow-green-500/25 transition cursor-pointer disabled:opacity-60">
              {submitting ? (
                <><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>Registering...</>
              ) : (
                <><BadgeCheck className="w-3.5 h-3.5" />Register Business</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
