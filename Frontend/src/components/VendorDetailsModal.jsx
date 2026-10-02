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
  ArrowRight
} from 'lucide-react';

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

  const pincodeApproval = vendor.pincodeAdminApproval || {
    status: vendor.kycStatus === 'Pending Pincode Admin Approval' ? 'Pending' : (vendor.kycStatus?.includes('Approved') || vendor.kycStatus === 'Verified') ? 'Approved' : 'Pending',
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null
  };

  const kycApproval = vendor.kycTeamApproval || {
    status: (vendor.kycStatus === 'KYC Approved' || vendor.kycStatus === 'Verified') ? 'Approved' : (vendor.kycStatus === 'KYC Rejected' ? 'Rejected' : 'Pending'),
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null
  };

  // Only Pincode Admin has permission for Stage 1 Verification actions
  const isPincodeAdmin = user?.role === 'Pincode Admin' || (typeof window !== 'undefined' && window.location.pathname.includes('/pincode-admin'));
  const isKYCTeam = user?.role === 'KYC Team' || user?.role === 'Super Admin';
  const addedBy = resolveVendorAddedBy(vendor);

  const canPincodeVerify = (user?.role === 'Pincode Admin') && (vendor.kycStatus === 'Pending Pincode Admin Approval' || pincodeApproval.status === 'Pending');
  const canKYCVerify = isKYCTeam && (vendor.kycStatus === 'KYC Pending' || vendor.kycStatus === 'Pincode Admin Approved' || (pincodeApproval.status === 'Approved' && kycApproval.status === 'Pending'));

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

          {/* 2. Onboarded By (Admin, Manager, or Agent who registered this vendor) */}
          <div className={`p-3.5 rounded-2xl border ${
            isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200/80 shadow-xs'
          }`}>
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Added / Onboarded By
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                addedBy.role?.includes('Admin')
                  ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800'
                  : addedBy.role?.includes('Manager')
                  ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800'
                  : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800'
              }`}>
                {addedBy.role}
              </span>
            </div>

            <div className={`p-3 rounded-xl border ${
              addedBy.role?.includes('Admin')
                ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/70 dark:border-indigo-900/40'
                : addedBy.role?.includes('Manager')
                ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40'
                : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                    addedBy.role?.includes('Admin')
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                      : addedBy.role?.includes('Manager')
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  }`}>
                    {addedBy.role?.includes('Admin') ? (
                      <UserCog className="w-5 h-5" />
                    ) : addedBy.role?.includes('Manager') ? (
                      <Building2 className="w-5 h-5" />
                    ) : (
                      <UserCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                      <span className="truncate">{addedBy.name}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                        addedBy.role?.includes('Admin')
                          ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950'
                          : addedBy.role?.includes('Manager')
                          ? 'text-amber-600 bg-amber-50 dark:bg-amber-950'
                          : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950'
                      }`}>
                        {addedBy.role}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {addedBy.phone || 'Not Available'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {addedBy.email || 'Not Available'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-start sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60 dark:border-slate-800 shrink-0">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    Added Date
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {addedBy.addedAt || 'Not Available'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2b. Assigned Team (Pincode Admin, Pincode Manager, Pincode Agent) for non-pincode admin views */}
          {!isPincodeAdmin && (
            <div className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200/80 shadow-xs'
            }`}>
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Assigned Team (Pincode: {pincode})
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                  Auto-Mapped
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {/* Pincode Admin */}
                <div className="p-2.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                    <UserCog className="w-3.5 h-3.5" />
                    <span>Pincode Admin</span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {assignedTeam.pincodeAdmin?.name || 'Unassigned'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {assignedTeam.pincodeAdmin?.phone || '-'}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {assignedTeam.pincodeAdmin?.email || '-'}
                  </div>
                </div>

                {/* Pincode Manager */}
                <div className="p-2.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 mb-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Pincode Manager</span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {assignedTeam.pincodeManager?.name || 'Unassigned'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {assignedTeam.pincodeManager?.phone || '-'}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {assignedTeam.pincodeManager?.email || '-'}
                  </div>
                </div>

                {/* Pincode Agent */}
                <div className="p-2.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Pincode Agent</span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {assignedTeam.pincodeAgent?.name || 'Unassigned'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {assignedTeam.pincodeAgent?.phone || '-'}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {assignedTeam.pincodeAgent?.email || '-'}
                  </div>
                </div>
              </div>
            </div>
          )}

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
