/**
 * Shared utility for vendor onboarding eligibility and metrics.
 * Determines whether a vendor has successfully completed all required
 * onboarding, approval, and verification stages and is officially onboarded.
 *
 * Requirements:
 * 1. Must NOT be Rejected in any approval status, kycStatus, or operational status.
 * 2. Must NOT be in Pending, Awaiting Pincode Approval, Awaiting KYC Team, Under Review, or Additional Info.
 * 3. Must NOT have incomplete intermediate status (e.g. PINCODE_APPROVED without KYC approval).
 * 4. Must have operational status ('Active' or 'Approved') AND cleared KYC ('Verified', 'KYC Approved', or 'approved').
 */
export function isFullyOnboardedVendor(v, options = {}) {
  if (!v) return false;
  const { allowSuspended = true, allowDeleted = true } = options;

  const status = String(v.status || '').toLowerCase().trim();
  const appStatus = String(v.approvalStatus || '').toLowerCase().trim();
  const kycStatus = String(v.kycStatus || '').toLowerCase().trim();
  const pinStatus = String(v.pincodeAdminApproval?.status || '').toLowerCase().trim();
  const kycTeamStatus = String(v.kycTeamApproval?.status || '').toLowerCase().trim();

  const isSuspendedAccount = status === 'suspended' || v.isSuspended === true;
  const isDeletedAccount = status === 'deleted' || v.isDeleted === true || status === 'deactivated';

  // 1. Explicit rejection
  if (
    status === 'rejected' ||
    appStatus.includes('reject') ||
    kycStatus.includes('reject') ||
    pinStatus === 'rejected' ||
    kycTeamStatus === 'rejected' ||
    (v.isApproved === false && status !== 'active' && status !== 'approved')
  ) {
    return false;
  }

  if (isSuspendedAccount) {
    if (!allowSuspended) return false;
  } else if (isDeletedAccount) {
    if (!allowDeleted) return false;
  } else if (v.isActive === false && status !== 'active' && status !== 'approved') {
    return false;
  }

  // 2. Pending Stage 1 (Pincode Admin approval) or general pending/review
  if (
    status.includes('pending') ||
    status === 'under review' ||
    status === 'submitted' ||
    status === 'draft' ||
    status === 'incomplete' ||
    appStatus.includes('pending') ||
    appStatus === 'under review' ||
    appStatus === 'submitted' ||
    pinStatus === 'pending'
  ) {
    return false;
  }

  // 3. Pending Stage 2 (KYC Team review) or incomplete intermediate stage
  if (
    appStatus === 'pincode_approved' ||
    appStatus === 'pincode admin approved' ||
    status === 'pending kyc review' ||
    status === 'payment pending' ||
    status === 'additional info required' ||
    appStatus === 'additional_information_required' ||
    kycTeamStatus === 'pending' ||
    kycTeamStatus.includes('additional')
  ) {
    return false;
  }

  // 4. Must be in active or approved operational state
  const isOperational = status === 'active' || status === 'approved';
  if (!isOperational) {
    return false;
  }

  return true;
}

/**
 * Computes standard KPI metrics strictly for the officially onboarded vendor dataset.
 */
export function computeOnboardedVendorKpis(vendors = []) {
  const eligible = Array.isArray(vendors) ? vendors.filter(isFullyOnboardedVendor) : [];
  const total = eligible.length;
  const active = eligible.filter(v => (v.status || '').toLowerCase() === 'active' || (v.status || '').toLowerCase() === 'approved').length;
  const topRated = eligible.filter(v => Number(v.rating || 0) >= 4.0).length;
  const pendingPayout = eligible.reduce((sum, v) => sum + (Number(v.pendingPayout) || 0), 0);

  return {
    total,
    active,
    topRated,
    pendingPayout,
    eligibleVendors: eligible
  };
}
