/**
 * Authoritative Backend Validation Rules for Bank & Address details (Modules 11 & 12)
 */

function validateBankAndAddress(data = {}, options = {}) {
  const { requiresDistrict = false, requiresDivision = false } = options;

  // 1. Bank Details (Module 11)
  const holder = String(data.accountHolderName || '').trim();
  if (!holder) return 'Account Holder Name is required.';
  if (holder.length < 2) return 'Please enter a valid Account Holder Name.';

  const bankName = String(data.bankName || '').trim();
  if (!bankName) return 'Bank Name is required.';

  const accNo = String(data.accountNumber || '').trim();
  if (!accNo) return 'Account Number is required.';
  if (!/^\d+$/.test(accNo)) return 'Account Number must contain digits only.';
  if (accNo.length < 9 || accNo.length > 18) return 'Account Number must be between 9 and 18 digits.';

  const ifsc = String(data.ifscCode || data.ifsc || '').trim().toUpperCase();
  if (!ifsc) return 'IFSC Code is required.';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return 'Please enter a valid IFSC code (e.g. SBIN0001235).';

  const branch = String(data.branchName || data.bankBranch || '').trim();
  if (!branch) return 'Branch Name is required.';

  // 2. Address Details (Module 12)
  const door = String(data.doorStreet || data.doorNumber || data.address || '').trim();
  if (!door) return 'Door / House Number is required.';

  const area = String(data.area || data.locality || data.village || data.city || '').trim();
  if (!area) return 'Village / Area / Locality is required.';

  const pin = String(data.pincode || data.addrPincode || data.assignedPincode || '').trim();
  if (!pin) return 'Pincode is required.';
  if (!/^\d{6}$/.test(pin)) return 'Please enter a valid 6-digit pincode.';

  const state = String(data.state || data.addrState || data.assignedState || '').trim();
  if (!state) return 'State is required.';

  if (requiresDistrict) {
    const district = String(data.district || data.districtAddr || data.assignedDistrict || '').trim();
    if (!district) return 'District is required.';
  }

  if (requiresDivision) {
    const division = String(data.division || data.divisionName || data.assignedDivision || data.city || '').trim();
    if (!division) return 'Division is required.';
  }

  return null;
}

module.exports = {
  validateBankAndAddress
};
