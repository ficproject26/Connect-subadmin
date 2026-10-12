import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { getRoleDashboardPath } from '../../utils/permissions';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  LogOut,
  MapPin,
  User,
  Phone,
  Mail,
  Building2,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export function getRegistrationState(user) {
  if (!user) return { stateKey: 'unknown' };

  const currentStatus = String(user.status || 'pending').toLowerCase().trim();
  const adminApprovalStatus = String(user.adminApprovalStatus || '').toLowerCase().trim();
  const kycStatus = String(user.kycStatus || '').toLowerCase().trim();
  const rejectionReason = (user.rejectionReason || user.adminRejectionReason || user.kycRejectionReason || '').trim();
  const pendingReason = (user.pendingReason || user.adminNotes || user.kycPendingReason || '').trim();

  // State 4: Rejected
  if (currentStatus === 'rejected' || adminApprovalStatus === 'rejected' || kycStatus === 'rejected') {
    return {
      stateKey: 'rejected',
      stateNumber: 4,
      title: 'Registration Not Approved',
      primaryMessage: 'Your registration request has not been approved.',
      reason: rejectionReason || 'Territory or KYC requirements were not satisfied during administrative review.',
      badgeVariant: 'red',
      badgeText: 'Rejected'
    };
  }

  // State 5: Approved and activated
  const isFullyApproved = (currentStatus === 'active' || currentStatus === 'approved') &&
    (adminApprovalStatus === 'approved' || !adminApprovalStatus) &&
    (kycStatus === 'verified' || kycStatus === 'approved' || !kycStatus) &&
    user.isActive !== false &&
    !user.requiresApproval;

  if (isFullyApproved) {
    return {
      stateKey: 'approved',
      stateNumber: 5,
      title: 'Registration Approved & Activated',
      primaryMessage: 'Congratulations! Your registration and KYC verification have been approved and activated.',
      badgeVariant: 'emerald',
      badgeText: 'Approved & Active'
    };
  }

  // State 3: Pending with a reason
  if (pendingReason) {
    return {
      stateKey: 'pending_with_reason',
      stateNumber: 3,
      title: 'Registration Pending Action',
      primaryMessage: 'Your registration is currently pending.',
      reason: pendingReason,
      nextSteps: 'Please review the reviewer note above. If additional documentation is required, reach out to your administrator or await re-evaluation by the review team.',
      badgeVariant: 'amber',
      badgeText: 'Pending with Reason'
    };
  }

  // State 2: Awaiting KYC verification
  if (adminApprovalStatus === 'approved' || currentStatus === 'pending_kyc' || kycStatus === 'pending_verification') {
    return {
      stateKey: 'awaiting_kyc',
      stateNumber: 2,
      title: 'Awaiting KYC Verification',
      primaryMessage: 'Your registration has been reviewed by the administrator and is awaiting KYC verification. Dashboard access will be available after all required approvals are completed.',
      badgeVariant: 'blue',
      badgeText: 'Awaiting KYC Verification'
    };
  }

  // State 1: Pending administrative approval
  return {
    stateKey: 'pending_admin',
    stateNumber: 1,
    title: 'Pending Administrative Approval',
    primaryMessage: 'Your registration request is pending administrative approval. Please contact your administrator for further information.',
    badgeVariant: 'yellow',
    badgeText: 'Pending Administrative Approval'
  };
}

export function RegistrationStatus() {
  const { user: initialUser, logout } = useAuth();
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setCurrentUser(initialUser);
  }, [initialUser]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMsg('');
    try {
      const res = await authService.getMe();
      if (res.success && res.user) {
        setCurrentUser(res.user);
        localStorage.setItem('ams_user', JSON.stringify(res.user));
        setRefreshMsg('Status updated successfully.');
        setTimeout(() => setRefreshMsg(''), 3000);
      }
    } catch (err) {
      console.error('Failed to refresh status:', err);
      setRefreshMsg('Unable to refresh status. Please check connectivity.');
      setTimeout(() => setRefreshMsg(''), 3000);
    } finally {
      setRefreshing(false);
    }
  };

  const user = currentUser || {};
  const statusInfo = getRegistrationState(user);

  const formattedRole = (user.role || 'Applicant')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const territoryItems = [
    user.state && `State: ${user.state}`,
    user.district && `District: ${user.district}`,
    user.division && `Division: ${user.division}`,
    user.pincode && `Pincode: ${user.pincode}`
  ].filter(Boolean);

  const submissionDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'Recently Submitted';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans">
      {/* Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Connect Operations Portal
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registration & Verification Workflow
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Sign out of your account"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </header>

      {/* Main Body */}
      <main className="max-w-4xl w-full mx-auto my-8 space-y-6">
        {/* Banner Alert according to the 5 States */}
        <div
          className={`rounded-2xl p-6 sm:p-8 border shadow-sm transition-all ${
            statusInfo.stateKey === 'approved'
              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-100'
              : statusInfo.stateKey === 'rejected'
              ? 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-800/60 text-red-900 dark:text-red-100'
              : statusInfo.stateKey === 'pending_with_reason'
              ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-100'
              : statusInfo.stateKey === 'awaiting_kyc'
              ? 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-100'
              : 'bg-yellow-50/70 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/60 text-yellow-900 dark:text-yellow-100'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="shrink-0 mt-0.5">
              {statusInfo.stateKey === 'approved' && (
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
              )}
              {statusInfo.stateKey === 'rejected' && (
                <div className="w-12 h-12 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/20">
                  <XCircle className="w-7 h-7" />
                </div>
              )}
              {statusInfo.stateKey === 'pending_with_reason' && (
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                  <AlertTriangle className="w-7 h-7" />
                </div>
              )}
              {statusInfo.stateKey === 'awaiting_kyc' && (
                <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Clock className="w-7 h-7" />
                </div>
              )}
              {statusInfo.stateKey === 'pending_admin' && (
                <div className="w-12 h-12 rounded-2xl bg-yellow-500 text-white flex items-center justify-center shadow-md shadow-yellow-500/20">
                  <ShieldAlert className="w-7 h-7" />
                </div>
              )}
            </div>

            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold tracking-tight">
                  {statusInfo.title}
                </h2>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                    statusInfo.stateKey === 'approved'
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                      : statusInfo.stateKey === 'rejected'
                      ? 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300'
                      : statusInfo.stateKey === 'pending_with_reason'
                      ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                      : statusInfo.stateKey === 'awaiting_kyc'
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300'
                      : 'bg-yellow-100 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-300'
                  }`}
                >
                  {statusInfo.badgeText}
                </span>
              </div>

              {/* Exact required wording from specifications */}
              <p className="text-sm font-medium leading-relaxed opacity-90">
                {statusInfo.primaryMessage}
              </p>

              {/* Reason block for Rejected or Pending with Reason */}
              {statusInfo.reason && (
                <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/80 shadow-xs space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Reviewer Reason:
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {statusInfo.reason}
                  </p>
                </div>
              )}

              {/* Next Steps for Pending with Reason */}
              {statusInfo.nextSteps && (
                <div className="p-3.5 rounded-xl bg-amber-100/60 dark:bg-amber-950/40 border border-amber-300/40 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <span className="font-bold block">Next steps:</span>
                  <p>{statusInfo.nextSteps}</p>
                </div>
              )}

              {/* State 5 Action: Enter Role-Specific Dashboard */}
              {statusInfo.stateKey === 'approved' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate(getRoleDashboardPath(user.role), { replace: true })}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    <span>Enter {formattedRole} Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Applicant Overview Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              <span>Applicant Profile & Registration Details</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Submitted: {submissionDate}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Full Name
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {user.name || 'Applicant'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Applied Role
              </span>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {formattedRole}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Contact Phone
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{user.mobile || user.phone || 'N/A'}</span>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Email Address
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{user.email || 'N/A'}</span>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1 sm:col-span-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Territorial Jurisdiction
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                <span>{territoryItems.length > 0 ? territoryItems.join(' • ') : 'Territory details pending'}</span>
              </p>
            </div>
          </div>

          {/* Workflow Stage Timeline */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Multi-Stage Verification Sequence
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Step 1: Territory Review */}
              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  user.adminApprovalStatus === 'approved'
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                    : user.adminApprovalStatus === 'rejected'
                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold bg-white dark:bg-slate-900 shrink-0 shadow-xs">
                  {user.adminApprovalStatus === 'approved' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : user.adminApprovalStatus === 'rejected' ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <span>1</span>
                  )}
                </div>
                <div>
                  <div className="font-bold">Step 1: Sub-Admin Territory Review</div>
                  <div className="text-[11px] opacity-80">
                    {user.adminApprovalStatus === 'approved'
                      ? 'Approved by designated territory Sub-Admin'
                      : user.adminApprovalStatus === 'rejected'
                      ? 'Rejected by territory Sub-Admin'
                      : 'Pending review by designated Sub-Admin'}
                  </div>
                </div>
              </div>

              {/* Step 2: KYC Verification */}
              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  user.kycStatus === 'Verified' || user.kycStatus === 'approved'
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                    : user.kycStatus === 'Rejected'
                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold bg-white dark:bg-slate-900 shrink-0 shadow-xs">
                  {user.kycStatus === 'Verified' || user.kycStatus === 'approved' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : user.kycStatus === 'Rejected' ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <span>2</span>
                  )}
                </div>
                <div>
                  <div className="font-bold">Step 2: KYC Documents Verification</div>
                  <div className="text-[11px] opacity-80">
                    {user.kycStatus === 'Verified' || user.kycStatus === 'approved'
                      ? 'Verified by KYC Compliance Team'
                      : user.kycStatus === 'Rejected'
                      ? 'Rejected by KYC Compliance Team'
                      : user.adminApprovalStatus === 'approved'
                      ? 'Queued for KYC document verification'
                      : 'Pending completion of Step 1'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Checking Live Database...' : 'Refresh Status'}</span>
            </button>

            {refreshMsg && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-fadeIn">
                {refreshMsg}
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center py-4 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200/60 dark:border-slate-800/60">
        Connect App Sub-Admin & Operations Management System &bull; Secure Territory Verification Portal
      </footer>
    </div>
  );
}

export default RegistrationStatus;
