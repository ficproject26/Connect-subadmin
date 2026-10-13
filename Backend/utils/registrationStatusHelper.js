/**
 * Registration status helper for mapping applicant states to the 5 canonical UI states.
 */
function getRegistrationState(user) {
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

  // State 2: Awaiting KYC verification (Requires Sub-admin approval completed first)
  const isSubAdminApproved = adminApprovalStatus === 'approved' || currentStatus === 'pending_kyc' || currentStatus === 'pending_kyc_approval';
  if (isSubAdminApproved && (kycStatus !== 'verified' && kycStatus !== 'approved')) {
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

module.exports = {
  getRegistrationState
};
