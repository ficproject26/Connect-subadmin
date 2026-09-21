import React, { useState } from 'react';
import { Modal } from './Modal';
import { StatusBadge } from './Badge';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import {
  UserCog,
  ShieldCheck,
  Building2,
  Layers,
  MapPin,
  Award,
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Eye,
  Check,
  X,
  CreditCard,
  UserCheck,
  Maximize2,
  Download,
  Clock
} from 'lucide-react';

export function ManagerApprovalModal({ isOpen, onClose, manager, onManagerUpdated }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [previewMedia, setPreviewMedia] = useState(null); // { url, title, isPdf }
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  if (!manager) return null;

  const isPendingAdmin = manager.status === 'under_review' || manager.status === 'pending' || manager.status === 'pending_admin_approval';
  const isPendingKyc = manager.status === 'pending_kyc';
  const isPending = isPendingAdmin || isPendingKyc;
  const isActive = manager.status === 'active';
  const isRejected = manager.status === 'rejected';

  // Format relative uploads so they route via current host & Vite proxy cleanly
  const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/') ? url : `/${url}`;
  };

  const handleApprove = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await dataService.approveManager(manager.id || manager._id);
      if (res.success) {
        setSuccessMsg(res.message || 'Registration accepted & approved! Manager account is now Active and login is enabled.');
        if (onManagerUpdated) onManagerUpdated(res.manager);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(res.message || 'Failed to approve manager.');
      }
    } catch (err) {
      setError(err.message || 'Error occurred while approving manager.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Please provide a reason for rejecting the manager registration.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await dataService.rejectManager(manager.id || manager._id, { reason: rejectReason.trim() });
      if (res.success) {
        setSuccessMsg(res.message || 'Manager application rejected.');
        if (onManagerUpdated) onManagerUpdated(res.manager);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(res.message || 'Failed to reject manager.');
      }
    } catch (err) {
      setError(err.message || 'Error occurred while rejecting manager.');
    } finally {
      setLoading(false);
    }
  };

  const docs = manager.documents || {};
  const docList = [
    {
      key: 'aadhaar',
      label: 'Aadhaar Card',
      value: docs.aadharUrl || docs.aadhaarUrl || docs.aadhaar || docs.aadhaarFront,
      fileName: docs.aadharFileName || docs.aadhaarFileName || 'Aadhaar_Document'
    },
    {
      key: 'pan',
      label: 'PAN Card',
      value: docs.panUrl || docs.pan,
      fileName: docs.panFileName || 'PAN_Document'
    },
    {
      key: 'bankPassbook',
      label: 'Bank Passbook / Cheque',
      value: docs.bankUrl || docs.bankPassbook || docs.passbookUrl || docs.bankDetailsUrl || docs.bank,
      fileName: docs.bankFileName || 'Bank_Passbook'
    },
    {
      key: 'signature',
      label: 'Authorized Signature',
      value: docs.signatureUrl || docs.signature,
      fileName: docs.signatureFileName || 'Specimen_Signature'
    }
  ];

  const avatarSrc = manager.avatarUrl || manager.avatar;
  const resolvedAvatar = avatarSrc ? resolveMediaUrl(avatarSrc) : null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manager Registration Review & Approval"
        maxWidth="max-w-3xl"
      >
        <div className="p-6 space-y-6">
          {/* Status Notification Alerts */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">{successMsg}</div>
            </div>
          )}

          {/* Manager Header Info with Profile Photo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center gap-4">
              {resolvedAvatar && !avatarLoadFailed ? (
                <div className="relative group cursor-pointer" onClick={() => setPreviewMedia({ url: resolvedAvatar, title: `${manager.name} - Profile Photo`, isPdf: false })}>
                  <img
                    src={resolvedAvatar}
                    alt={manager.name}
                    onError={() => setAvatarLoadFailed(true)}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500/40 dark:border-blue-400/50 shrink-0 shadow-md transition group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                  {manager.name ? manager.name.charAt(0).toUpperCase() : 'M'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">{manager.name}</h4>
                  <StatusBadge status={manager.status || 'Active'} />
                </div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                  {manager.roleTitle || manager.role?.replace(/_/g, ' ')}
                </p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Applied on: {manager.joinedDate || 'Recently Registered'}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right sm:border-l sm:border-slate-200 sm:dark:border-slate-700 sm:pl-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Jurisdiction Tier</span>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                Level {manager.level || 1} Ops
              </div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {manager.jurisdiction}
              </div>
            </div>
          </div>

          {/* Operational Scope & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                <MapPin className="w-4 h-4 text-amber-500" />
                <span>Assigned Administrative Territory</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">State:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{manager.stateName || 'Tamil Nadu'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">District:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{manager.districtName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Division:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{manager.divisionName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Postal PIN:</span>
                  <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                    {manager.pincodeCode || (manager.pincodeId ? manager.pincodeId.replace('pin_', '') : 'N/A')}
                  </span>
                </div>
                {manager.targetAdminRole && (
                  <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Designated Authority:</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {manager.targetAdminRole}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Phone className="w-4 h-4 text-blue-500" />
                <span>Contact & Personal Credentials</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-semibold font-mono text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={manager.email}>
                    {manager.email}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mobile:</span>
                  <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">{manager.mobile || manager.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gender / DOB:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {manager.gender || 'Not specified'} {manager.dob ? `(${manager.dob})` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Address:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={manager.address || 'Not provided'}>
                    {manager.address || 'Not provided'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* KYC Verification & Uploaded Documents with Embedded Previews */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>KYC Verification Documents (Click any document to inspect)</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                {manager.kycStatus || 'pending_verification'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {docList.map((d) => {
                const mediaUrl = d.value ? resolveMediaUrl(d.value) : null;
                const isPdf = mediaUrl ? mediaUrl.toLowerCase().endsWith('.pdf') : false;

                return (
                  <div
                    key={d.key}
                    className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-800 dark:text-slate-200">{d.label}</span>
                      </div>
                      {mediaUrl ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Uploaded
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">
                          Self-attested
                        </span>
                      )}
                    </div>

                    {mediaUrl ? (
                      <div className="flex items-center justify-between pt-1 gap-2">
                        {/* Thumbnail image or PDF badge */}
                        {!isPdf ? (
                          <div
                            onClick={() => setPreviewMedia({ url: mediaUrl, title: d.label, isPdf: false })}
                            className="relative w-16 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer group bg-black/5"
                          >
                            <img
                              src={mediaUrl}
                              alt={d.label}
                              className="w-full h-full object-cover group-hover:scale-110 transition"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-16 h-12 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 flex flex-col items-center justify-center text-red-600 dark:text-red-400 text-[10px] font-bold shrink-0">
                            <span>PDF</span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate font-mono" title={d.fileName}>
                            {d.fileName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => setPreviewMedia({ url: mediaUrl, title: d.label, isPdf })}
                              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Maximize2 className="w-3 h-3" /> Preview
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <a
                              href={mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> New Tab
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic py-1">
                        No physical document file uploaded
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-lg flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                Terms of Employment & Code of Conduct: <strong>{manager.declarationAccepted ? 'Formally Accepted by Candidate' : 'Acknowledged'}</strong>
              </span>
            </div>
          </div>

          {/* Approval History / Status Summary */}
          {isActive && (
            <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">Account Active & Operational</div>
                <div className="text-emerald-700/90 dark:text-emerald-400 mt-0.5">
                  Approved by <strong>{manager.adminApprovedBy || 'Administrator'}</strong>. The manager has full portal credentials and operational access to their dashboard.
                </div>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="p-3.5 rounded-xl bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-red-800 dark:text-red-300">Registration Application Rejected</div>
                <div className="text-red-700/90 dark:text-red-400 mt-0.5">
                  Reason: {manager.rejectionReason || 'Criteria not met.'}
                </div>
              </div>
            </div>
          )}

          {/* Designated Reviewer Notice if viewer is not the authorized admin */}
          {isPending && manager.canApprove === false && (
            <div className="p-3.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-blue-900 dark:text-blue-200">
                  Designated Approval Authority: {manager.targetAdminRole}
                </div>
                <div className="text-blue-700/90 dark:text-blue-300 mt-0.5">
                  Registration requests for this jurisdiction must be approved by the designated <strong>{manager.targetAdminRole}</strong> ({manager.targetJurisdiction || manager.jurisdiction}). You are viewing this candidate in supervisory overview mode.
                </div>
              </div>
            </div>
          )}

          {/* Rejection Reason Input Box */}
          {showRejectBox && (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 space-y-3 animate-fadeIn">
              <label className="block text-xs font-bold text-red-700 dark:text-red-300">
                Reason for Rejection (Visible to Manager on sign in attempt):
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Document mismatch, incomplete KYC proofs, or jurisdictional cap exceeded."
                className="w-full text-xs p-2.5 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectBox(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleReject}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          )}

          {/* Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Close
            </button>

            {isPending && manager.canApprove === false && (
              <span className="text-xs font-semibold text-slate-500 italic px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                Authority designated to {manager.targetAdminRole}
              </span>
            )}

            {!isActive && !showRejectBox && manager.canApprove !== false && (
              <>
                {!isRejected && (
                  <button
                    type="button"
                    onClick={() => setShowRejectBox(true)}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800/60 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {loading ? 'Approving & Activating...' : (isRejected ? 'Reconsider & Approve Manager' : 'Accept & Approve Manager')}
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Full Resolution Document & Photo Lightbox / Previewer */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                {previewMedia.title}
              </h4>
              <div className="flex items-center gap-2">
                <a
                  href={previewMedia.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewMedia(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex items-center justify-center max-h-[80vh] bg-slate-100 dark:bg-slate-950/30">
              {previewMedia.isPdf ? (
                <iframe
                  src={previewMedia.url}
                  title={previewMedia.title}
                  className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-800"
                />
              ) : (
                <img
                  src={previewMedia.url}
                  alt={previewMedia.title}
                  className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
