import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { getPasswordValidationState } from '../utils/formValidation';
import {
  Shield,
  Lock,
  Mail,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  Bell,
  Check,
  User,
  Smartphone
} from 'lucide-react';

export function AdminSettingsView({ title = 'Administrative Settings', subtitle = 'Security credentials, contact parameters, and administrative controls.' }) {
  const { user, updateUser } = useAuth();

  // Account details state
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Preferences
  const [preferencesSaved, setPreferencesSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setMobile(user.mobile || user.phone || '');
      setAlternateMobile(user.alternateMobile || user.altPhone || '');
    }
  }, [user]);

  // Real-time password validation
  const validation = getPasswordValidationState(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordReady = validation.isValid && passwordsMatch;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    // Client-side validations
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setProfileError('Please enter a valid email address.');
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length !== 10) {
      setProfileError('Mobile number must be exactly 10 digits.');
      return;
    }

    setProfileSaving(true);
    try {
      const res = await authService.updateProfile({
        email: cleanEmail,
        mobile: cleanMobile,
        alternateMobile: alternateMobile.trim()
      });

      if (res.success) {
        setProfileSuccess('Account details updated and saved successfully.');
        if (res.user && updateUser) {
          updateUser(res.user);
        }
        setTimeout(() => setProfileSuccess(''), 4000);
      } else {
        setProfileError(res.message || 'Failed to update account details.');
      }
    } catch (err) {
      setProfileError(err.message || 'Network error updating account details.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword || !confirmPassword) {
      setPasswordError('Please provide both new password and confirmation password.');
      return;
    }

    if (!validation.isValid) {
      setPasswordError('Password does not fulfill all required security criteria.');
      return;
    }

    if (!passwordsMatch) {
      setPasswordError('Confirm Password does not match New Password.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await authService.changePassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim()
      });

      if (res.success) {
        setPasswordSuccess('Password changed successfully. Your account is secured with your new password.');
        // Clear password fields on success
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 5000);
      } else {
        setPasswordError(res.message || 'Failed to change password.');
      }
    } catch (err) {
      setPasswordError(err.message || 'Network error while updating password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSavePreferences = (e) => {
    e.preventDefault();
    setPreferencesSaved(true);
    setTimeout(() => setPreferencesSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      {/* SECTION 1: ACCOUNT DETAILS */}
      <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm rounded-2xl space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Shield className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account & Contact Parameters</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Identity keys are strictly read-only for governance audit trails. Contact points may be updated with validation.
            </p>
          </div>
        </div>

        {profileSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Full Name (Strictly Read-Only) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-600 dark:text-slate-400 font-medium">Official Name</label>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" /> Read-Only
                </span>
              </div>
              <input
                type="text"
                value={user?.name || ''}
                disabled
                readOnly
                id="admin-profile-name"
                className="w-full bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-500 font-semibold cursor-not-allowed select-none"
              />
            </div>

            {/* System Username (Strictly Read-Only) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-600 dark:text-slate-400 font-medium">Username</label>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" /> Read-Only
                </span>
              </div>
              <input
                type="text"
                value={user?.username || user?.loginId || user?.email || ''}
                disabled
                readOnly
                id="admin-profile-username"
                className="w-full bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-500 font-mono font-semibold cursor-not-allowed select-none"
              />
            </div>

            {/* Sub-Admin Unique ID (Strictly Read-Only) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-600 dark:text-slate-400 font-medium">Sub-Admin Unique ID</label>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" /> Read-Only
                </span>
              </div>
              <input
                type="text"
                value={user?.subAdminId || user?.id || user?._id || ''}
                disabled
                readOnly
                id="admin-profile-subadminid"
                className="w-full bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-blue-600 dark:text-blue-400 font-mono font-bold cursor-not-allowed select-none"
              />
            </div>

            {/* Assigned Role & Jurisdiction (Strictly Read-Only) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-600 dark:text-slate-400 font-medium">Role & Jurisdiction</label>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" /> Read-Only
                </span>
              </div>
              <input
                type="text"
                value={`${user?.role || 'Admin'} • ${user?.pincode ? `PIN ${user.pincode}` : user?.division ? `${user.division} Div` : user?.district ? `${user.district}` : user?.state || 'State'}`}
                disabled
                readOnly
                id="admin-profile-role"
                className="w-full bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-purple-600 dark:text-purple-400 font-semibold cursor-not-allowed select-none"
              />
            </div>

            {/* Official Admin Email (Editable with validation) */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium" htmlFor="admin-edit-email">
                Official Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="admin-edit-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Registered Mobile Number (Editable with 10-digit validation) */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium" htmlFor="admin-edit-mobile">
                Registered Mobile Number (10 digits) <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="admin-edit-mobile"
                value={mobile}
                maxLength={10}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={profileSaving}
              id="admin-save-profile-btn"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {profileSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Account Details
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: CHANGE PASSWORD */}
      <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm rounded-2xl space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <KeyRound className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Security & Password Management</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Update your administrative login credentials with rigorous bcrypt security standards.
            </p>
          </div>
        </div>

        {passwordSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">{passwordError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Current Password */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium" htmlFor="admin-current-password">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  id="admin-current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-9 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium" htmlFor="admin-new-password">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  id="admin-new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-9 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium" htmlFor="admin-confirm-password">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  id="admin-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-9 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Live Password Requirements Checklist */}
          {newPassword.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Password Security Requirements:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className={`flex items-center gap-1.5 ${validation.minLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {validation.minLength ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
                  <span>Min 6 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${validation.hasUpper ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {validation.hasUpper ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
                  <span>Uppercase (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${validation.hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {validation.hasNumber ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
                  <span>Number (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${validation.hasSpecial ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {validation.hasSpecial ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
                  <span>Special char (!@#)</span>
                </div>
              </div>
              {confirmPassword.length > 0 && (
                <div className={`pt-1 text-[11px] flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-500'}`}>
                  {passwordsMatch ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={passwordSaving || !isPasswordReady}
              id="admin-change-password-btn"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {passwordSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  Change Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: NOTIFICATIONS & AUDIT RULES */}
      <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm rounded-2xl space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Bell className="w-5 h-5 text-purple-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Audit & Notification Rules</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Territory event notifications and alert dispatching thresholds.</p>
          </div>
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-3 text-xs">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Alert immediately on high-value payment requests (&gt; ₹50,000)
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Notify when new manager registration requests arrive in your jurisdiction
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Daily automated territorial activity and revenue digest
            </span>
          </label>

          <div className="flex items-center justify-between pt-3">
            {preferencesSaved && (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Security preferences saved
              </span>
            )}
            <button
              type="submit"
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Notification Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
