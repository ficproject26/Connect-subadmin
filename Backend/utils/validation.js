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

/**
 * Authoritative Backend Validation Rules for KYC Documents
 * Enforces mandatory Aadhaar & PAN with strict formats and uploaded documents
 */
function validateKycDocuments(data = {}) {

  // 1. Aadhaar Number
  const rawAadhaar = data.aadharNumber || data.aadhaarNumber || (data.documents && (data.documents.aadharNumber || data.documents.aadhaarNumber)) || '';
  const aadhar = String(rawAadhaar).trim().replace(/\s+/g, '');
  if (!aadhar) {
    return 'Aadhaar Number is required.';
  }
  if (!/^\d{12}$/.test(aadhar)) {
    return 'Aadhaar Number must be exactly 12 numeric digits with no letters or special characters.';
  }

  // 2. Aadhaar Document Upload
  const docs = data.documents || {};
  const kycDocs = data.kycDocs || {};
  const kyc = data.kyc || {};
  const hasAadhaarDoc = !!(
    data.aadharPhoto ||
    data.aadharUrl ||
    data.aadhaarPhoto ||
    data.aadhaarUrl ||
    data.aadharFileName ||
    data.aadhaarFileName ||
    data.aadharPhotoPreview ||
    data.aadhaarPhotoPreview ||
    data.aadharFile ||
    data.aadhaarFile ||
    docs.aadharUrl ||
    docs.aadhaarUrl ||
    docs.aadharPhoto ||
    docs.aadhaarPhoto ||
    docs.aadhaarFront ||
    docs.aadhar ||
    docs.aadhaar ||
    (kycDocs.aadhaarFront && (typeof kycDocs.aadhaarFront === 'object' ? kycDocs.aadhaarFront.url : kycDocs.aadhaarFront)) ||
    kyc.aadhaarImage
  );
  if (!hasAadhaarDoc) {
    return 'Aadhaar Card document upload is mandatory.';
  }

  // 3. PAN Number
  const rawPan = data.panNumber || (data.documents && data.documents.panNumber) || '';
  const pan = String(rawPan).trim().toUpperCase();
  if (!pan) {
    return 'PAN Number is required.';
  }
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
    return 'PAN Number must be in valid format (e.g. ABCDE1234F - 5 uppercase letters, 4 digits, 1 uppercase letter).';
  }

  // 4. PAN Document Upload
  const hasPanDoc = !!(
    data.panPhoto ||
    data.panUrl ||
    data.panFileName ||
    data.panPhotoPreview ||
    data.panFile ||
    docs.panUrl ||
    docs.panPhoto ||
    docs.panCard ||
    docs.pan ||
    (kycDocs.panCard && (typeof kycDocs.panCard === 'object' ? kycDocs.panCard.url : kycDocs.panCard)) ||
    kyc.panImage
  );
  if (!hasPanDoc) {
    return 'PAN Card document upload is mandatory.';
  }

  return null;
}

module.exports = {
  validateBankAndAddress,
  validateKycDocuments
};
