/**
 * Authoritative Form Validation Rules for Onboarding & Edit Flows
 * Strict Indian Banking & Postal address validation
 */

/**
 * Validates Bank Details according to Module 11
 * @param {Object} bank - Bank details object
 * @returns {string|null} Error message or null if valid
 */
export function validateBankDetails(bank = {}) {
  const holder = String(bank.accountHolderName || '').trim();
  if (!holder) {
    return 'Account Holder Name is required.';
  }
  if (holder.length < 2) {
    return 'Please enter a valid Account Holder Name.';
  }

  const bankName = String(bank.bankName || '').trim();
  if (!bankName) {
    return 'Bank Name is required.';
  }

  const accNo = String(bank.accountNumber || '').trim();
  if (!accNo) {
    return 'Account Number is required.';
  }
  if (!/^\d+$/.test(accNo)) {
    return 'Account Number must contain digits only.';
  }
  if (accNo.length < 9 || accNo.length > 18) {
    return 'Account Number must be between 9 and 18 digits.';
  }

  const ifsc = String(bank.ifscCode || bank.ifsc || '').trim().toUpperCase();
  if (!ifsc) {
    return 'IFSC Code is required.';
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return 'Please enter a valid IFSC code (e.g. SBIN0001235).';
  }

  const branch = String(bank.branchName || bank.bankBranch || '').trim();
  if (!branch) {
    return 'Branch Name is required.';
  }

  return null;
}

/**
 * Validates Address Details according to Module 12 & 13
 * @param {Object} addr - Address details object
 * @param {Object} options - Options (requiresDistrict, requiresDivision)
 * @returns {string|null} Error message or null if valid
 */
export function validateAddressDetails(addr = {}, options = {}) {
  const { requiresDistrict = true, requiresDivision = false } = options;

  const door = String(addr.doorStreet || addr.doorNumber || addr.street || addr.address || '').trim();
  if (!door) {
    return 'Door / House Number is required.';
  }

  const area = String(addr.area || addr.locality || addr.village || addr.city || '').trim();
  if (!area) {
    return 'Village / Area / Locality is required.';
  }

  const pin = String(addr.pincode || addr.addrPincode || addr.assignedPincode || '').trim();
  if (!pin) {
    return 'Pincode is required.';
  }
  if (!/^\d{6}$/.test(pin)) {
    return 'Please enter a valid 6-digit pincode.';
  }

  const state = String(addr.state || addr.addrState || addr.assignedState || '').trim();
  if (!state) {
    return 'State is required.';
  }

  if (requiresDistrict) {
    const district = String(addr.district || addr.districtAddr || addr.assignedDistrict || '').trim();
    if (!district) {
      return 'District is required.';
    }
  }

  if (requiresDivision) {
    const division = String(addr.division || addr.divisionName || addr.assignedDivision || addr.city || '').trim();
    if (!division) {
      return 'Division is required.';
    }
  }

  return null;
}

/**
 * Format helpers for inputs
 */
export function cleanAccountNumber(val) {
  return String(val || '').replace(/\D/g, '').slice(0, 18);
}

export function cleanIFSC(val) {
  return String(val || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
}

export function cleanPincode(val) {
  return String(val || '').replace(/\D/g, '').slice(0, 6);
}
