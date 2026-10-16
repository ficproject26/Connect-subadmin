import { formatName, validateName, validateEmail, cleanIndianMobile, validateIndianMobile } from '../utils/formValidation.js';
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { normalizeRole } from '../utils/permissions';
import {
  UserPlus,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Layers,
  Award,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck
} from 'lucide-react';

export function AgentOnboardingModal({ isOpen, onClose, onSuccess, level }) {
  const { user } = useAuth();

  // Determine authorized level from logged-in Sub-Admin's account
  const userRole = String(user?.role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const adminUserRole = String(user?.adminRole || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const isSuperAdmin = (userRole.includes('super admin') || userRole === 'main admin' || (userRole === 'admin' && !adminUserRole.includes('state') && !adminUserRole.includes('district') && !adminUserRole.includes('division') && !adminUserRole.includes('pincode') && !user?.level?.includes('state'))) && (!user?.state || user?.state.toLowerCase() === 'all india');

  let activeLevel = 'state';
  if (userRole.includes('pincode')) activeLevel = 'pincode';
  else if (userRole.includes('division') || userRole.includes('divisional')) activeLevel = 'division';
  else if (userRole.includes('district')) activeLevel = 'district';
  else if (userRole.includes('state')) activeLevel = 'state';
  else if (level) activeLevel = level;

  // Title and badge configs
  const LEVEL_META = {
    state: {
      title: 'Add State Agent',
      badge: 'State Agent',
      roleTitle: 'State Agent',
      icon: Award,
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
    },
    district: {
      title: 'Add District Agent',
      badge: 'District Agent',
      roleTitle: 'District Agent',
      icon: Building2,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
    },
    division: {
      title: 'Add Division Agent',
      badge: 'Division Agent',
      roleTitle: 'Division Agent',
      icon: Layers,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
    },
    pincode: {
      title: 'Add Pincode Agent',
      badge: 'Pincode Agent',
      roleTitle: 'Pincode Agent',
      icon: MapPin,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
    }
  };

  const meta = LEVEL_META[activeLevel] || LEVEL_META.state;
  const LevelIcon = meta.icon;

  // Prefilled & locked territory from authenticated account
  const assignedState = user?.state || user?.assignedState || 'Tamil Nadu';
  const assignedDistrict = user?.district || user?.assignedDistrict || '';
  const assignedDivision = user?.division || user?.assignedDivision || '';
  const assignedPincode = user?.pincode ? String(user.pincode).trim() : (user?.assignedPincode ? String(user.assignedPincode).trim() : '');

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    level: activeLevel
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        mobile: '',
        email: '',
        level: activeLevel
      });
      setError('');
      setSuccessMsg('');
      setSubmitting(false);
    }
  }, [isOpen, activeLevel]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'mobile') {
      const cleaned = cleanIndianMobile(value);
      setFormData(prev => ({ ...prev, mobile: cleaned }));
      return;
    }
    if (name === 'name') {
      setFormData(prev => ({ ...prev, name: formatName(value) }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const nameCheck = validateName(formData.name, 'Agent Full Name', true);
    if (!nameCheck.isValid) {
      setError(nameCheck.message);
      return;
    }

    const mobileCheck = validateIndianMobile(formData.mobile, true, 'Mobile number');
    if (!mobileCheck.isValid) {
      setError(mobileCheck.message);
      return;
    }

    const emailCheck = validateEmail(formData.email, true);
    if (!emailCheck.isValid) {
      setError(emailCheck.message);
      return;
    }

    setSubmitting(true);
    try {
      // Build authoritative payload strictly bound to user's assigned territory
      const payload = {
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        phone: formData.mobile.trim(),
        email: formData.email.trim().toLowerCase(),
        level: activeLevel,
        // Send prefilled territory parameters matching caller scope
        state: assignedState,
        district: activeLevel === 'state' ? null : (assignedDistrict || null),
        division: (activeLevel === 'division' || activeLevel === 'pincode') ? (assignedDivision || null) : null,
        pincode: activeLevel === 'pincode' ? (assignedPincode || null) : null,
        stateId: user?.stateId || null,
        districtId: activeLevel === 'state' ? null : (user?.districtId || null),
        divisionId: (activeLevel === 'division' || activeLevel === 'pincode') ? (user?.divisionId || null) : null,
        pincodeId: activeLevel === 'pincode' ? (user?.pincodeId || null) : null
      };

      const res = await dataService.addAgent(payload);
      if (res && res.success) {
        setSuccessMsg(res.message || `${meta.roleTitle} onboarded successfully! Awaiting review in Agent Requests.`);
        setTimeout(() => {
          if (onSuccess) onSuccess(res.agent);
          onClose();
        }, 1200);
      } else {
        setError(res?.message || 'Failed to onboard agent. Please verify details.');
      }
    } catch (err) {
      console.error('Agent onboarding error:', err);
      setError(err?.message || 'Server error occurred while onboarding agent.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={meta.title} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner with locked level and territory restriction rule */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
            <LevelIcon className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">Onboarding Scope:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${meta.badgeColor}`}>
                {meta.badge}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Agents onboarded under this portal enter pending status for territory verification and approval.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Agent Details */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Agent Information
          </h4>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Ramesh Kumar"
                required
                disabled={submitting}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
            </div>
          </div>

          {/* Mobile & Email Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  placeholder="10-digit mobile"
                  maxLength={10}
                  required
                  disabled={submitting}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="agent@example.com"
                  required
                  disabled={submitting}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Territory Assignment (Strictly Locked and Prefilled) */}
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>Authorized Territory</span>
              <Lock className="w-3.5 h-3.5 text-amber-500" />
            </h4>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full font-medium">
              Locked to your jurisdiction
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* State */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <span>State</span>
                <Lock className="w-3 h-3 text-slate-400" />
              </label>
              <input
                type="text"
                value={assignedState || 'Tamil Nadu'}
                readOnly
                disabled
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed font-medium select-none"
              />
            </div>

            {/* District */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <span>District</span>
                <Lock className="w-3 h-3 text-slate-400" />
              </label>
              <input
                type="text"
                value={activeLevel === 'state' ? 'Statewide (All Districts)' : (assignedDistrict || 'Assigned District')}
                readOnly
                disabled
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed font-medium select-none"
              />
            </div>

            {/* Division (if division or pincode agent) */}
            {(activeLevel === 'division' || activeLevel === 'pincode') && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <span>Division</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </label>
                <input
                  type="text"
                  value={assignedDivision || 'Assigned Division'}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed font-medium select-none"
                />
              </div>
            )}

            {/* Pincode (if pincode agent) */}
            {activeLevel === 'pincode' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <span>Postal Pincode</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </label>
                <input
                  type="text"
                  value={assignedPincode ? `PIN: ${assignedPincode}` : 'Assigned Pincode'}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed font-mono font-medium select-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Onboarding...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Submit & Stage for Review</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
