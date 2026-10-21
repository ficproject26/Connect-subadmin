import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { StatusBadge } from './Badge';
import { AlertTriangle, ShieldAlert, CheckCircle2, Trash2, Loader2, Info } from 'lucide-react';

/**
 * AccountActionModal
 * Reusable confirmation dialog for Suspend, Activate, and Soft Delete actions
 * on Manager, Vendor, and Agent accounts.
 */
export function AccountActionModal({
  isOpen,
  onClose,
  account,
  accountType = 'Account', // 'Manager' | 'Vendor' | 'Agent'
  actionType, // 'suspend' | 'activate' | 'delete'
  onConfirm
}) {
  const [reason, setReason] = useState('');
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when opened with new action or account
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setDeleteConfirmationText('');
      setConfirmedCheckbox(false);
      setError('');
      setLoading(false);
    }
  }, [isOpen, actionType, account]);

  if (!isOpen || !account || !actionType) return null;

  const accountName = account.name || account.businessName || account.contactPerson || 'Account';
  const accountRole = account.roleTitle || account.role || account.level || account.category || accountType;
  const currentStatus = account.status || 'Active';
  const territory = account.jurisdiction || account.assignedArea || account.pincode || account.district || account.state || 'Assigned Territory';

  const isSuspend = actionType === 'suspend';
  const isActivate = actionType === 'activate';
  const isDelete = actionType === 'delete';

  const canSubmit = !loading && (
    !isDelete || (confirmedCheckbox || deleteConfirmationText.trim().toUpperCase() === 'DELETE')
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError('');
    setLoading(true);
    try {
      await onConfirm({
        action: actionType,
        reason: reason.trim()
      });
      onClose();
    } catch (err) {
      console.error('Account action error:', err);
      setError(err.message || `Failed to ${actionType} account. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const getModalTitle = () => {
    if (isSuspend) return `Suspend ${accountType} Account`;
    if (isActivate) return `Activate ${accountType} Account`;
    if (isDelete) return `Permanently Disable & Soft Delete ${accountType}`;
    return 'Account Action';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={getModalTitle()}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Account Summary Dossier */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {accountName}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {String(accountRole).replace(/_/g, ' ')}
              </p>
              {account.email && (
                <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  {account.email}
                </p>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <StatusBadge status={currentStatus} />
              <span className="text-[10px] text-slate-400">Current Status</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span className="text-slate-400 text-[11px]">Territory:</span>
            <span className="font-medium text-right truncate max-w-[240px]">{territory}</span>
          </div>
        </div>

        {/* Action Specific Guidance & Warnings */}
        {isSuspend && (
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Temporary Suspension Notice</span>
            </div>
            <p className="leading-relaxed text-[11px] text-amber-900/90 dark:text-amber-200/90">
              Suspending this account will temporarily block all dashboard access, terminate active sessions immediately, and reject future login attempts.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 pt-1 border-t border-amber-200/60 dark:border-amber-800/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>All historical records, orders, assignments, and activities remain safely preserved.</span>
            </div>
          </div>
        )}

        {isActivate && (
          <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Restore Account Access</span>
            </div>
            <p className="leading-relaxed text-[11px] text-emerald-900/90 dark:text-emerald-200/90">
              Activating this account will restore its status to <strong>Active</strong>. The user will be permitted to log in and resume authorized territory operations according to application security rules.
            </p>
          </div>
        )}

        {isDelete && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>Permanent Access Deactivation (Soft Delete Only)</span>
              </div>
              <p className="leading-relaxed text-[11px] text-rose-900/90 dark:text-rose-200/90">
                This account will be permanently disabled. Existing authentication tokens and sessions will be immediately revoked, and login will be permanently blocked.
              </p>
              <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-rose-200 dark:border-rose-800/50 text-[11px] space-y-1">
                <p className="font-semibold text-rose-950 dark:text-rose-200 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Historical Data Preservation Guarantee:
                </p>
                <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-0.5 pl-1">
                  <li>Original account details, audit trail, and activity logs remain accessible to administrators.</li>
                  <li>Vendor products, services, transactions, and commission payouts are never physically deleted.</li>
                  <li>Agent field assignments, reports, and manager historical performance stay preserved.</li>
                </ul>
              </div>
            </div>

            {/* Explicit Confirmation Checkbox & Input */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmedCheckbox}
                  onChange={(e) => setConfirmedCheckbox(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                  disabled={loading}
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">
                  I explicitly confirm that I want to permanently disable this account's access while preserving its historical records for reporting.
                </span>
              </label>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Or type <span className="font-bold font-mono text-rose-600 dark:text-rose-400">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  placeholder="Type DELETE"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Reason / Notes Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Reason / Administrative Notes {isDelete ? '(Recommended for Audit)' : '(Optional)'}
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            placeholder={
              isSuspend
                ? 'e.g. Temporary suspension due to KYC document re-verification request...'
                : isActivate
                ? 'e.g. Document verification completed, authorized by territory administrator...'
                : 'e.g. Account permanently deactivated as per regional administrator authorization...'
            }
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          {isSuspend && (
            <button
              type="submit"
              disabled={!canSubmit}
              id="confirm-suspend-btn"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Suspending...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Suspend Account</span>
                </>
              )}
            </button>
          )}

          {isActivate && (
            <button
              type="submit"
              disabled={!canSubmit}
              id="confirm-activate-btn"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Activating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Activate Account</span>
                </>
              )}
            </button>
          )}

          {isDelete && (
            <button
              type="submit"
              disabled={!canSubmit}
              id="confirm-delete-btn"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deactivating...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanently Disable (Soft Delete)</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
