import React, { useState } from 'react';
import { Modal } from './Modal';
import { StatusBadge } from './Badge';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { resolvePincodeHierarchy, resolveVendorAddedBy } from '../utils/pincodeDirectory';
import {
  Store,
  User,
  Phone,
  Mail,
  Tag,
  MapPin,
  Building2,
  Layers,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserPlus,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileCheck2,
  ArrowRight,
  ShieldAlert,
  Info
} from 'lucide-react';

function formatTimestamp(ts) {
  if (!ts) return 'Not Available';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(ts);
  }
}

export function VendorDetailsModal({ isOpen, onClose, vendor, onVendorUpdated }) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectStage, setRejectStage] = useState(''); // 'pincode' | 'kyc'
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  if (!vendor) return null;

  // Fallback resolution for location & team if not directly on vendor object
  const resolved = resolvePincodeHierarchy(vendor.pincode);
  const state = vendor.state || resolved.state;
  const district = vendor.district || resolved.district;
  const division = vendor.division || resolved.division;
  const pincode = vendor.pincode || resolved.pincode;

  const assignedTeam = vendor.assignedTeam || {
    pincodeAdmin: resolved.pincodeAdmin,
    pincodeManager: resolved.pincodeManager,
    pincodeAgent: resolved.pincodeAgent
  };

  // Dynamic Onboarding Agent details
  const addedBy = resolveVendorAddedBy(vendor);
  const onboardingAgent = vendor.onboardingAgent || {};
  const agentName = onboardingAgent.name || addedBy.name || 'Not Available';
  const agentId = onboardingAgent.id || onboardingAgent._id || addedBy.id || '-';
  const agentPhone = onboardingAgent.phone || addedBy.phone || 'Not Available';
  const agentEmail = onboardingAgent.email || addedBy.email || 'Not Available';
  const agentRole = onboardingAgent.tier || onboardingAgent.role || addedBy.role || 'Pincode Agent';
  const submittedAt = onboardingAgent.submittedAt || vendor.submissionDate || vendor.submittedAt || vendor.createdAt;

  // Dynamic Responsible Admin details (determined by vendor's actual pincode)
  const respAdmin = vendor.responsibleAdmin || {};
  const assignmentInfo = vendor.responsibleAdminAssignment || {};
  const adminName = respAdmin.name || assignedTeam.pincodeAdmin?.name || 'Unassigned';
  const adminId = respAdmin.id || respAdmin._id || assignedTeam.pincodeAdmin?.id || '-';
  const adminPhone = respAdmin.phone || assignedTeam.pincodeAdmin?.phone || 'Not Available';
  const adminEmail = respAdmin.email || assignedTeam.pincodeAdmin?.email || 'Not Available';
  const adminRole = respAdmin.role || assignedTeam.pincodeAdmin?.role || 'Pincode Admin';
  const adminState = respAdmin.state || state || '-';
  const adminDistrict = respAdmin.district || district || '-';
  const adminDivision = respAdmin.division || division || '-';
  const adminPincode = respAdmin.pincode || pincode || '-';
  const isAssignmentPending = assignmentInfo.status === 'PENDING_ADMIN_ASSIGNMENT' || adminName === 'Unassigned';

  const pincodeApproval = vendor.pincodeAdminApproval || {
    status: (vendor.kycStatus === 'Pending Pincode Admin Approval' || vendor.status === 'PENDING_PINCODE_APPROVAL' || vendor.status === 'SUBMITTED') ? 'Pending' : (vendor.kycStatus?.includes('Approved') || vendor.kycStatus === 'Verified' || vendor.status === 'PINCODE_APPROVED' || vendor.status === 'KYC_PENDING' || vendor.status === 'ACTIVE') ? 'Approved' : (vendor.status === 'PINCODE_REJECTED' ? 'Rejected' : 'Pending'),
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null
  };

  const kycApproval = vendor.kycTeamApproval || {
    status: (vendor.kycStatus === 'KYC Approved' || vendor.kycStatus === 'Verified' || vendor.status === 'ACTIVE' || vendor.status === 'KYC_APPROVED') ? 'Approved' : (vendor.kycStatus === 'KYC Rejected' || vendor.status === 'KYC_REJECTED' ? 'Rejected' : 'Pending'),
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null
  };

  // Authorization checks
  const userPincodes = [
    user?.pincode,
    ...(Array.isArray(user?.pincodes) ? user.pincodes : []),
    ...(Array.isArray(user?.assignedPincodes) ? user.assignedPincodes : [])
  ].filter(Boolean).map(String);

  const isAssignedPincodeAdmin = (user?.role === 'Pincode Admin' || (typeof window !== 'undefined' && window.location.pathname.includes('/pincode-admin'))) && (
    userPincodes.length === 0 || userPincodes.includes(String(vendor.pincode || ''))
  );

  const isKYCTeam = user?.role === 'KYC Team' || user?.role === 'Super Admin';

  const canPincodeVerify = (user?.role === 'Super Admin' || isAssignedPincodeAdmin) && 
    (pincodeApproval.status === 'Pending' || vendor.kycStatus === 'Pending Pincode Admin Approval' || vendor.status === 'PENDING_PINCODE_APPROVAL' || vendor.status === 'SUBMITTED');

  const canKYCVerify = isKYCTeam && 
    (pincodeApproval.status === 'Approved' || vendor.status === 'PINCODE_APPROVED' || vendor.status === 'KYC_PENDING') &&
    (kycApproval.status === 'Pending' || vendor.kycStatus === 'KYC Pending' || vendor.status === 'KYC_PENDING');

  // Handler for Pincode Admin Accept
  const handlePincodeAccept = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await dataService.pincodeVerifyVendor(vendor.id, { action: 'Accept' });
      if (res.success) {
        if (onVendorUpdated) onVendorUpdated(res.vendor);
        onClose();
      } else {
        setActionError(res.message || 'Failed to accept vendor');
      }
    } catch (err) {
      setActionError(err.message || 'Verification error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler for KYC Team Approve
  const handleKYCApprove = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await dataService.kycVerifyVendor(vendor.id, { action: 'Approve' });
      if (res.success) {
        if (onVendorUpdated) onVendorUpdated(res.vendor);
        onClose();
      } else {
        setActionError(res.message || 'Failed to approve KYC');
      }
    } catch (err) {
      setActionError(err.message || 'KYC approval error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open rejection modal with mandatory reason prompt
  const openRejectDialog = (stage) => {
    setRejectStage(stage);
    setRejectionReason('');
    setActionError('');
    setRejectModalOpen(true);
  };

  // Submit rejection with mandatory reason
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setActionError('Rejection reason is mandatory.');
      return;
    }

    setActionLoading(true);
    setActionError('');

    try {
      let res;
      if (rejectStage === 'pincode') {
        res = await dataService.pincodeVerifyVendor(vendor.id, {
          action: 'Reject',
          rejectionReason: rejectionReason.trim()
        });
      } else {
        res = await dataService.kycVerifyVendor(vendor.id, {
          action: 'Reject',
          rejectionReason: rejectionReason.trim()
        });
      }

      if (res.success) {
        if (onVendorUpdated) onVendorUpdated(res.vendor);
        setRejectModalOpen(false);
        onClose();
      } else {
        setActionError(res.message || 'Failed to reject vendor');
      }
    } catch (err) {
      setActionError(err.message || 'Error processing rejection');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Vendor Profile & Verification Dossier"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Top Banner */}
          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200/90'
          } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-base shrink-0 border border-amber-200 dark:border-amber-700/50">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {vendor.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-900/60">
                    {vendor.category || 'Services'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>ID: <strong className="font-mono text-slate-700 dark:text-slate-300">{vendor.id}</strong></span>
                  <span>•</span>
                  <span>Contact: {vendor.contactPerson} ({vendor.phone})</span>
                </div>
              </div>
            </div>

            <div className="self-start sm:self-auto">
              <StatusBadge status={vendor.kycStatus || 'Pending Pincode Admin Approval'} />
            </div>
          </div>

          {/* 1. Complete Location Hierarchy */}
          <div className={`p-3.5 rounded-2xl border ${
            isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200/80 shadow-xs'
          }`}>
            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
              <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Location Hierarchy (State &rarr; District &rarr; Division &rarr; Pincode)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">State</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{state}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">District</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{district}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">Division</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{division}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <span className="text-[10px] text-blue-600 dark:text-blue-400 block font-bold">Pincode</span>
                <span className="font-mono font-black text-blue-700 dark:text-blue-300 block mt-0.5">{pincode}</span>
              </div>
            </div>

            <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pl-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Registered Address:</span>
              <span className="truncate">{vendor.address || 'Commercial Center, Main Bazaar'}</span>
            </div>
          </div>

          {/* 2. Onboarding & Approval Details Section */}
          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200/80 shadow-xs'
          } space-y-3`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Onboarding & Approval Details
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Jurisdiction assignment and onboarding agent traceability
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                isAssignmentPending
                  ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800'
                  : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800'
              }`}>
                {isAssignmentPending ? 'Pending Admin Assignment' : `Assigned: ${respAdmin.assignedLevel || 'Pincode'} Hierarchy`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Onboarding Agent Details */}
              <div className="p-3 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Onboarding Agent
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {agentRole}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="truncate">{agentName}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <span>Agent ID:</span>
                      <strong className="font-mono text-slate-700 dark:text-slate-300">{agentId}</strong>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                      <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-semibold">{agentPhone}</span>
                    </div>
                    {agentEmail && agentEmail !== 'Not Available' && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{agentEmail}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/30 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Submitted:
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatTimestamp(submittedAt)}
                  </span>
                </div>
              </div>

              {/* Responsible Admin Details */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between ${
                isAssignmentPending
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40'
                  : 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200/70 dark:border-indigo-900/40'
              }`}>
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                      <UserCog className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Responsible Admin
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100/80 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {adminRole}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="truncate">{adminName}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <span>Admin ID:</span>
                      <strong className="font-mono text-slate-700 dark:text-slate-300">{adminId}</strong>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                      <Phone className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="font-semibold">{adminPhone}</span>
                    </div>
                    {adminEmail && adminEmail !== 'Not Available' && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{adminEmail}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/30">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Jurisdiction:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                        {adminDistrict}, {adminDivision}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span>Assigned PIN:</span>
                      <strong className="font-mono text-indigo-600 dark:text-indigo-400">{adminPincode}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Two-Stage KYC Approval Progress Tracker */}
          <div className={`p-3.5 rounded-2xl border ${
            isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200/80 shadow-xs'
          } space-y-3`}>
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <FileCheck2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Two-Stage Verification Progress
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Stage 1: Pincode Admin Approval */}
              <div className={`p-3 rounded-xl border ${
                pincodeApproval.status === 'Approved'
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                  : pincodeApproval.status === 'Rejected'
                  ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                  : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
              }`}>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-bold text-slate-900 dark:text-white">
                    1. Pincode Admin Verification
                  </span>
                  <StatusBadge status={
                    pincodeApproval.status === 'Approved'
                      ? 'Approved'
                      : pincodeApproval.status === 'Rejected'
                      ? 'Pincode Admin Rejected'
                      : 'Pending Pincode Admin Approval'
                  } />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Responsible: <strong>{assignedTeam.pincodeAdmin?.name}</strong>
                </div>
                {pincodeApproval.decidedBy && (
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Decided by: {pincodeApproval.decidedBy}
                  </div>
                )}
                {pincodeApproval.rejectionReason && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-100/60 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-[11px]">
                    <strong>Rejection Reason:</strong> {pincodeApproval.rejectionReason}
                  </div>
                )}

                {/* Stage 1 Action Buttons for Pincode Admin */}
                {canPincodeVerify && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handlePincodeAccept}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept Vendor</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => openRejectDialog('pincode')}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject Vendor</span>
                    </button>
                  </div>
                )}

                {/* Sub-Admin Non-Bypass Note */}
                {!canPincodeVerify && pincodeApproval.status === 'Pending' && (
                  <div className="mt-2.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 text-[10px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Awaiting verification by the authorized Pincode Admin ({adminName}). Sub-Admins can track progress but cannot bypass Pincode Admin approval.
                    </span>
                  </div>
                )}
              </div>

              {/* Stage 2: KYC Team Verification */}
              <div className={`p-3 rounded-xl border ${
                kycApproval.status === 'Approved'
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                  : kycApproval.status === 'Rejected'
                  ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
              }`}>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-bold text-slate-900 dark:text-white">
                    2. Final KYC Team Verification
                  </span>
                  <StatusBadge status={
                    kycApproval.status === 'Approved'
                      ? 'KYC Approved'
                      : kycApproval.status === 'Rejected'
                      ? 'KYC Rejected'
                      : (pincodeApproval.status === 'Approved' ? 'KYC Pending' : 'Waiting Pincode Approval')
                  } />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Responsible: <strong>Central Compliance & KYC Team</strong>
                </div>
                {kycApproval.decidedBy && (
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Verified by: {kycApproval.decidedBy}
                  </div>
                )}
                {kycApproval.rejectionReason && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-100/60 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-[11px]">
                    <strong>KYC Rejection Reason:</strong> {kycApproval.rejectionReason}
                  </div>
                )}

                {/* Stage 2 Action Buttons for KYC Team */}
                {canKYCVerify && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleKYCApprove}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve KYC</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => openRejectDialog('kyc')}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject KYC</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Mandatory Rejection Reason Sub-Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={rejectStage === 'pincode' ? 'Reject Vendor (Pincode Admin Clearance)' : 'Reject Vendor KYC (Compliance)'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-3.5">
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span>
              A <strong>mandatory rejection reason</strong> is required. This will be permanently recorded on the vendor dossier and displayed to all jurisdictional administrators.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Rejection Reason *
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Shop premises does not exist at registered address; documents unverified on physical inspection."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading || !rejectionReason.trim()}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Submitting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
