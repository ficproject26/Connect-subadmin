import React, { useState } from 'react';
import { Modal } from './Modal';
import { StatusBadge } from './Badge';
import { resolvePincodeHierarchy } from '../utils/pincodeDirectory';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Building2,
  Store,
  Tag,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  Compass,
  ShieldCheck,
  Calendar,
  FileCheck2,
  CheckCircle2,
  Clock,
  XCircle,
  Briefcase,
  UserCog,
  UserCheck,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

export function VendorKYCDetailsModal({ isOpen, onClose, vendor, onVendorUpdated }) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectStage, setRejectStage] = useState(''); // 'pincode' | 'kyc'
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  if (!vendor) return null;

  const businessName = vendor.businessName || vendor.name || 'Vendor Enterprise';
  const category = vendor.category || 'Services';
  const businessType = vendor.businessType || 'Proprietorship';
  const businessDescription =
    vendor.businessDescription ||
    'Authorized merchant operations managing certified trade services and retail provisions.';

  const vendorName = vendor.vendorName || vendor.contactPerson || 'Vendor Owner';
  const phone = vendor.phone || '+91 94431 00000';
  const email = vendor.email || 'vendor@company.com';

  const fullAddress = vendor.fullAddress || vendor.address || '-';
  const pincode = vendor.pincode || '';

  // Resolve hierarchy & team based on pincode
  const resolved = pincode ? resolvePincodeHierarchy(pincode) : {};
  const state = vendor.state || resolved?.state || '-';
  const district = vendor.district || resolved?.district || '-';
  const division = vendor.division || resolved?.division || '-';

  const assignedTeam = vendor.assignedTeam || {
    pincodeAdmin: resolved.pincodeAdmin,
    pincodeManager: resolved.pincodeManager,
    pincodeAgent: resolved.pincodeAgent
  };

  const kycStatus = vendor.status || vendor.kycStatus || 'Pending Pincode Admin Approval';

  const pincodeApproval = vendor.pincodeAdminApproval || {
    status: kycStatus === 'Pending Pincode Admin Approval' ? 'Pending' : (kycStatus.includes('Approved') || kycStatus === 'Verified' || kycStatus === 'KYC Pending') ? 'Approved' : 'Pending',
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null
  };

  const kycApproval = vendor.kycTeamApproval || {
    status: (kycStatus === 'KYC Approved' || kycStatus === 'Verified') ? 'Approved' : (kycStatus === 'KYC Rejected' ? 'Rejected' : 'Pending'),
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null
  };

  const submittedDocuments = Array.isArray(vendor.submittedDocuments) && vendor.submittedDocuments.length > 0
    ? vendor.submittedDocuments
    : [
        'GST Registration Certificate',
        'Business PAN Card',
        'Trade / Municipal Health License',
        'Cancelled Cheque / Bank Passbook'
      ];

  // Only Pincode Admin has permission for Stage 1 Verification actions
  const isPincodeAdmin = user?.role === 'Pincode Admin';
  const isKYCTeam = user?.role === 'KYC Team' || user?.role === 'Super Admin' || user?.role === 'State Admin';
  const isManager = vendor.type === 'Manager' || vendor.managerId || (vendor.id && String(vendor.id).startsWith('KYC-MGR-'));

  const canPincodeVerify = !isManager && isPincodeAdmin && (kycStatus === 'Pending Pincode Admin Approval' || pincodeApproval.status === 'Pending');
  const canKYCVerify = isManager
    ? (kycStatus.toLowerCase() === 'pending' || kycStatus.toLowerCase() === 'pending verification')
    : (isKYCTeam && (kycStatus === 'KYC Pending' || kycStatus === 'Pincode Admin Approved' || (pincodeApproval.status === 'Approved' && kycApproval.status === 'Pending')));

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

  const handleKYCApprove = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      let res;
      if (isManager) {
        res = await dataService.processKYC(vendor.id, { status: 'Verified' });
      } else {
        res = await dataService.kycVerifyVendor(vendor.id, { action: 'Approve' });
      }
      if (res.success) {
        if (onVendorUpdated) onVendorUpdated(res.vendor || res.record);
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

  const openRejectDialog = (stage) => {
    setRejectStage(stage);
    setRejectionReason('');
    setActionError('');
    setRejectModalOpen(true);
  };

  const handleRejectConfirm = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setActionError('A rejection reason is strictly required.');
      return;
    }

    setActionLoading(true);
    setActionError('');

    try {
      let res;
      if (isManager) {
        res = await dataService.processKYC(vendor.id, {
          status: 'Rejected',
          reason: rejectionReason.trim()
        });
      } else if (rejectStage === 'pincode') {
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
        if (onVendorUpdated) onVendorUpdated(res.vendor || res.record);
        setRejectModalOpen(false);
        onClose();
      } else {
        setActionError(res.message || 'Failed to reject verification');
      }
    } catch (err) {
      setActionError(err.message || 'Server error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Vendor KYC Compliance & Location Dossier"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          {/* Top Summary Header Banner */}
          <div
            className={`p-3.5 rounded-2xl border ${
              isDark
                ? 'bg-slate-950/60 border-slate-800'
                : 'bg-slate-50 border-slate-200/90'
            } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base shrink-0 border border-blue-200 dark:border-blue-900/50">
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {businessName}
                  </h4>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-900/60 whitespace-nowrap">
                    {category}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>Vendor ID: <strong className="font-mono text-slate-700 dark:text-slate-300">{vendor.id || vendor.vendorId || '-'}</strong></span>
                  <span>•</span>
                  <span>Type: <strong className="text-slate-700 dark:text-slate-300">{businessType}</strong></span>
                </div>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 self-start sm:self-center">
              <StatusBadge status={kycStatus} />
            </div>
          </div>

          {/* TWO-STAGE KYC APPROVAL WORKFLOW STATUS */}
          <div className="p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20">
            <div className="flex items-center gap-2 pb-2 mb-2.5 border-b border-indigo-100 dark:border-indigo-900/40">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
                Two-Stage Vendor KYC Approval Pipeline
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Stage 1: Pincode Admin */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <span>1. Pincode Admin Verification</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    pincodeApproval.status === 'Approved'
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                      : pincodeApproval.status === 'Rejected'
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                  }`}>
                    {pincodeApproval.status === 'Approved' ? 'Accepted ✓' : pincodeApproval.status === 'Rejected' ? 'Rejected ✕' : 'Pending Review'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Assigned Pincode Admin reviews local business legitimacy and site existence.
                </p>

                {vendor.rejectionReason && (kycStatus.includes('Pincode Admin Rejected') || pincodeApproval.status === 'Rejected') && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-[11px]">
                    <strong className="font-semibold block">Rejection Reason:</strong>
                    {vendor.rejectionReason}
                  </div>
                )}

                {canPincodeVerify && (
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handlePincodeAccept}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
                    >
                      {actionLoading ? 'Processing...' : 'Accept Vendor'}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => openRejectDialog('pincode')}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
                    >
                      Reject Vendor
                    </button>
                  </div>
                )}
              </div>

              {/* Stage 2: KYC Team Verification */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    2. Central KYC Team Verification
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    kycApproval.status === 'Approved'
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                      : kycApproval.status === 'Rejected'
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : pincodeApproval.status === 'Approved'
                      ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {kycApproval.status === 'Approved'
                      ? 'Approved ✓'
                      : kycApproval.status === 'Rejected'
                      ? 'Rejected ✕'
                      : pincodeApproval.status === 'Approved'
                      ? 'Ready for Review'
                      : 'Awaiting Stage 1'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {pincodeApproval.status === 'Approved'
                    ? 'Pincode Admin accepted. KYC Team verifies official GST/PAN documents for compliance certification.'
                    : 'Vendor must be verified and accepted by Pincode Admin before moving to KYC review.'}
                </p>

                {vendor.rejectionReason && (kycStatus.includes('KYC Rejected') || kycApproval.status === 'Rejected') && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-[11px]">
                    <strong className="font-semibold block">KYC Rejection Reason:</strong>
                    {vendor.rejectionReason}
                  </div>
                )}

                {canKYCVerify && (
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleKYCApprove}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
                    >
                      {actionLoading ? 'Processing...' : 'Approve KYC'}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => openRejectDialog('kyc')}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
                    >
                      Reject KYC
                    </button>
                  </div>
                )}
              </div>
            </div>

            {actionError && (
              <div className="mt-2 p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}
          </div>

          {/* 1. LOCATION HIERARCHY */}
          <div
            className={`p-3.5 rounded-2xl border ${
              isDark
                ? 'bg-slate-900/40 border-slate-800/80'
                : 'bg-white border-slate-200/80 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
              <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Location Hierarchy (State &rarr; District &rarr; Division &rarr; Pincode)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">State</span>
                <span className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 block">{state}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">District</span>
                <span className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 block">{district}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Division</span>
                <span className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 block">{division}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block tracking-wider">Pincode</span>
                <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300 text-xs mt-0.5 block">
                  PIN: {pincode}
                </span>
              </div>
              <div className="sm:col-span-4 mt-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Shop / Office Street Address</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">{fullAddress}</span>
              </div>
            </div>
          </div>

          {/* 2. AUTOMATIC ASSIGNED TEAM */}
          <div
            className={`p-3.5 rounded-2xl border ${
              isDark
                ? 'bg-slate-900/40 border-slate-800/80'
                : 'bg-white border-slate-200/80 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
              <UserCog className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Assigned Team (Automatically Mapped by Pincode)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  Pincode Admin
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 block">
                  {assignedTeam.pincodeAdmin?.name || 'Unassigned'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 block">
                  {assignedTeam.pincodeAdmin?.phone || '-'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                  Pincode Manager
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 block">
                  {assignedTeam.pincodeManager?.name || 'Unassigned'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 block">
                  {assignedTeam.pincodeManager?.phone || '-'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  Pincode Agent
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 block">
                  {assignedTeam.pincodeAgent?.name || 'Unassigned'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 block">
                  {assignedTeam.pincodeAgent?.phone || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. BUSINESS & PERSONAL DETAILS */}
          <div
            className={`p-3.5 rounded-2xl border ${
              isDark
                ? 'bg-slate-900/40 border-slate-800/80'
                : 'bg-white border-slate-200/80 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Contact & Document Verification
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Owner / Contact</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">{vendorName}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Phone</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">{phone}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Email</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 block truncate">{email}</span>
              </div>
              <div className="sm:col-span-3 mt-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium mb-1.5">Submitted Compliance Proofs</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {submittedDocuments.map((doc, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                        isDark
                          ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">{doc}</span>
                    </div>
                  ))}
                </div>
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

      {/* MANDATORY REJECTION DIALOG */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={rejectStage === 'pincode' ? 'Reject Vendor at Pincode Admin Stage' : 'Reject Vendor KYC Certification'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRejectConfirm} className="space-y-4">
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs">
            <p className="font-bold flex items-center gap-1 mb-1">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              Rejection Reason is Strictly Mandatory
            </p>
            <p className="text-[11px] leading-relaxed">
              Please specify the precise reason for rejecting this vendor. This explanation will be permanently recorded in the audit trail.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason for Rejection *
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Physical shop does not match registered address / GST certificate expired / Incomplete trade proof..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>

          {actionError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{actionError}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading || !rejectionReason.trim()}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
