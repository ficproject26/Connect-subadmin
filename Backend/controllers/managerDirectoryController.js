const bcrypt = require('bcryptjs');
const { db } = require('../config/db');
const { getMongoDb } = require('../config/mongo');
const { validateBankAndAddress, validateKycDocuments, formatCapitalizedName, validateName } = require('../utils/validation');

/**
 * Safely format any date-like input into a YYYY-MM-DD string for submittedDate.
 * Handles Date objects, ISO strings, timestamp numbers, and date strings.
 * Falls back consistently to fallbackDate or the current date if missing or invalid.
 * Never throws and never calls .split() on an unvalidated non-string value.
 *
 * @param {Date|string|number|null|undefined} dateInput - Primary date value
 * @param {Date|string|number|null|undefined} [fallbackDate] - Optional fallback date (e.g. now)
 * @returns {string} Date formatted as YYYY-MM-DD
 */
const formatSubmittedDate = (dateInput, fallbackDate = new Date()) => {
  const toValidDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) {
      return !isNaN(val.getTime()) ? val : null;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) {
        const d = new Date(match[1]);
        if (!isNaN(d.getTime())) return d;
      }
      const d = new Date(trimmed);
      return !isNaN(d.getTime()) ? d : null;
    }
    if (typeof val === 'number') {
      const d = new Date(val);
      return !isNaN(d.getTime()) ? d : null;
    }
    return null;
  };

  const validDate = toValidDate(dateInput) || toValidDate(fallbackDate) || new Date();
  return validDate.toISOString().split('T')[0];
};


// Format human-readable role labels
const formatRoleTitle = (role) => {
  switch (role) {
    case 'state_manager': return 'State Agent Manager (Level 1)';
    case 'district_manager': return 'District Agent Manager (Level 2)';
    case 'division_manager': return 'Division Agent Manager (Level 3)';
    case 'pincode_manager': return 'Pincode Agent Manager (Level 4)';
    case 'State Admin': return 'State Administrator';
    case 'District Admin': return 'District Administrator';
    case 'Divisional Admin': return 'Divisional Administrator';
    case 'Pincode Admin': return 'Pincode Administrator';
    default: return role;
  }
};

// Clean territory strings for robust comparison
const cleanTerritory = (str) => {
  return String(str || '').trim().toLowerCase().replace(/\s+(district|division|taluk)$/, '').trim();
};

// Check if an admin and a manager share the same state
const matchesState = (admin, manager) => {
  if (!admin || !manager) return false;
  const adminState = cleanTerritory(admin.state || admin.assignedState);
  if (!adminState || adminState === 'all india') return true;
  const mgrState = cleanTerritory(manager.state || manager.assignedState);
  if (adminState && mgrState && adminState === mgrState) return true;
  const adminStateId = String(admin.stateId || admin.assignedStateId || '').trim().toLowerCase();
  const mgrStateId = String(manager.stateId || manager.assignedStateId || '').trim().toLowerCase();
  if (adminStateId && mgrStateId && adminStateId === mgrStateId) return true;
  return false;
};

// Check if an admin and a manager share the same district
const matchesDistrict = (admin, manager) => {
  if (!admin || !manager) return false;

  const adminDist = cleanTerritory(admin.district || admin.assignedDistrict);
  const mgrDist = cleanTerritory(manager.district || manager.assignedDistrict);
  const adminDistId = String(admin.districtId || admin.assignedDistrictId || '').trim().toLowerCase();
  const mgrDistId = String(manager.districtId || manager.assignedDistrictId || '').trim().toLowerCase();

  if (adminDistId && mgrDistId && adminDistId === mgrDistId) return true;
  if (adminDist && mgrDist && adminDist === mgrDist) return true;
  if (!adminDist || adminDist === 'all districts') return matchesState(admin, manager);

  if (matchesState(admin, manager)) {
    if (!adminDist || adminDist === 'all districts') return true;
    if (adminDist && mgrDist && (adminDist.includes(mgrDist) || mgrDist.includes(adminDist))) return true;
  }
  return false;
};

// Check if an admin and a manager share the same division
const matchesDivision = (admin, manager) => {
  if (!admin || !manager) return false;

  const adminDiv = cleanTerritory(admin.division || admin.assignedDivision);
  const mgrDiv = cleanTerritory(manager.division || manager.assignedDivision);
  const adminDivId = String(admin.divisionId || admin.assignedDivisionId || '').trim().toLowerCase();
  const mgrDivId = String(manager.divisionId || manager.assignedDivisionId || '').trim().toLowerCase();

  if (adminDivId && mgrDivId && adminDivId === mgrDivId) return true;
  if (adminDiv && mgrDiv && adminDiv === mgrDiv) return true;
  if (!adminDiv || adminDiv === 'all divisions') return matchesDistrict(admin, manager);

  if (matchesDistrict(admin, manager)) {
    if (!adminDiv || adminDiv === 'all divisions') return true;
    if (adminDiv && mgrDiv && (adminDiv.includes(mgrDiv) || mgrDiv.includes(adminDiv))) return true;
  }
  return false;
};

// Check if an admin and a manager share the same pincode
const matchesPincode = (admin, manager) => {
  if (!admin || !manager) return false;

  const adminPin = String(admin.pincode || admin.assignedPincode || '').trim();
  const mgrPin = String(manager.pincode || manager.assignedPincode || '').trim();
  const adminPinId = String(admin.pincodeId || admin.assignedPincodeId || '').trim().toLowerCase();
  const mgrPinId = String(manager.pincodeId || manager.assignedPincodeId || '').trim().toLowerCase();

  // Exact 6-digit PIN code match uniquely determines pincode jurisdiction
  if (adminPin && mgrPin && adminPin === mgrPin) return true;
  if (adminPinId && mgrPinId && adminPinId === mgrPinId) return true;
  if (!adminPin || adminPin === 'all') return matchesDivision(admin, manager);

  return false;
};

// Helper to determine the designated Admin Role for a Manager Role
const getRelatedAdminRole = (managerRole) => {
  switch (managerRole) {
    case 'state_manager': return 'State Admin';
    case 'district_manager': return 'District Admin';
    case 'division_manager': return 'Divisional Admin';
    case 'pincode_manager': return 'Pincode Admin';
    default: return null;
  }
};

// Helper: Find manager across in-memory db.users, db.managers, and MongoDB Atlas collections
const findManagerRecord = async (id) => {
  if (!id) return null;
  const idStr = String(id).trim();

  // 1. Check in-memory db.users
  const allUsers = Array.from(db.users || []);
  let mgr = allUsers.find(u =>
    String(u._id || u.id || '').trim() === idStr ||
    String(u.userId || '').trim() === idStr ||
    String(u.requestId || '').trim() === idStr
  );
  if (mgr) return mgr;

  // 2. Check in-memory db.managers
  if (db.managers) {
    const allMgrs = Array.from(db.managers || []);
    mgr = allMgrs.find(u =>
      String(u._id || u.id || '').trim() === idStr ||
      String(u.userId || '').trim() === idStr ||
      String(u.requestId || '').trim() === idStr
    );
    if (mgr) return mgr;
  }

  // 3. Check MongoDB Atlas managerrequests & users
  try {
    const mongoDb = await getMongoDb();
    if (mongoDb) {
      const { ObjectId } = require('mongodb');
      const orClauses = [{ userId: idStr }, { requestId: idStr }, { email: idStr.toLowerCase() }];
      if (ObjectId.isValid(idStr)) {
        orClauses.unshift({ _id: new ObjectId(idStr) });
      }

      const mReq = await mongoDb.collection('managerrequests').findOne({ $or: orClauses });
      if (mReq) {
        const levelMap = {
          'state': 'state_manager',
          'district': 'district_manager',
          'division': 'division_manager',
          'divisional': 'division_manager',
          'pincode': 'pincode_manager',
          '1': 'state_manager',
          '2': 'district_manager',
          '3': 'division_manager',
          '4': 'pincode_manager'
        };
        const derivedRole = levelMap[String(mReq.level || '').toLowerCase()] || mReq.role || 'pincode_manager';
        return {
          ...mReq,
          _id: mReq._id,
          id: mReq.userId || String(mReq._id),
          userId: mReq.userId || String(mReq._id),
          role: derivedRole,
          level: mReq.level || derivedRole.replace('_manager', ''),
          state: mReq.assignedState || mReq.state || '',
          district: mReq.assignedDistrict || mReq.district || '',
          division: mReq.assignedDivision || mReq.division || '',
          pincode: mReq.assignedPincode || mReq.pincode || '',
          assignedState: mReq.assignedState || mReq.state || '',
          assignedDistrict: mReq.assignedDistrict || mReq.district || '',
          assignedDivision: mReq.assignedDivision || mReq.division || '',
          assignedPincode: mReq.assignedPincode || mReq.pincode || '',
          status: (mReq.status || 'Pending').toLowerCase()
        };
      }

      const uDoc = await mongoDb.collection('users').findOne({ $or: orClauses });
      if (uDoc) return uDoc;
    }
  } catch (err) {
    console.warn('findManagerRecord Atlas lookup warning:', err.message);
  }

  return null;
};

// Check if an Administrator has jurisdiction to VIEW / OVERSEE a Field Manager
const canAdminManage = (admin, manager) => {
  if (!admin || !manager) return false;
  const adminRole = (admin.role || '').trim();
  const adminRoleLower = adminRole.toLowerCase().replace(/_/g, ' ');

  // Non-administrative roles (Managers, Agents, Customers, Vendors) strictly have no administrative jurisdiction
  if (!adminRoleLower.includes('admin') || adminRoleLower.includes('manager') || adminRoleLower.includes('agent')) {
    return false;
  }

  // Global Unscoped Super Admin / Main Admin can view all
  const isGlobalSuper = adminRoleLower === 'super admin' || adminRoleLower === 'main admin' || (adminRoleLower === 'admin' && (!admin.state || admin.state.toLowerCase() === 'all india'));
  if (isGlobalSuper) return true;

  let rawMgrRole = String(manager.role || manager.level || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const levelNumMap = { '1': 'state', '2': 'district', '3': 'division', '4': 'pincode' };
  if (levelNumMap[rawMgrRole]) rawMgrRole = levelNumMap[rawMgrRole];
  if (levelNumMap[String(manager.level || '').trim()]) rawMgrRole = levelNumMap[String(manager.level || '').trim()];

  // State Admin (or admin scoped to a state): can view all managers within their state
  if (adminRoleLower.includes('state') || (adminRoleLower === 'admin' && admin.state)) {
    return matchesState(admin, manager);
  }

  // District Admin: can view district, division, and pincode managers within their district
  if (adminRoleLower.includes('district')) {
    if (rawMgrRole.includes('state')) return false; // Strictly never view State Manager
    return matchesDistrict(admin, manager);
  }

  // Division Admin: can view division and pincode managers within their division
  if (adminRoleLower.includes('division') || adminRoleLower.includes('divisional')) {
    if (rawMgrRole.includes('state') || rawMgrRole.includes('district')) return false; // Strictly never view State or District Manager
    return matchesDivision(admin, manager);
  }

  // Pincode Admin: can view pincode managers within their pincode
  if (adminRoleLower.includes('pincode')) {
    if (!rawMgrRole.includes('pincode')) return false; // Strictly never view higher managers
    return matchesPincode(admin, manager);
  }

  return false;
};

// Check if an admin is the designated territorial authority with APPROVAL / REJECTION / ACTION rights
const isDesignatedTerritorialAdmin = (admin, manager) => {
  if (!admin || !manager) return false;
  const adminRole = (admin.role || '').trim();
  const adminRoleLower = adminRole.toLowerCase().replace(/_/g, ' ');

  // Non-administrative roles (Managers, Agents, Customers, Vendors) strictly have no approval authority
  if (!adminRoleLower.includes('admin') || adminRoleLower.includes('manager') || adminRoleLower.includes('agent')) {
    return false;
  }

  // Global Unscoped Super Admin
  const isGlobalSuper = adminRoleLower === 'super admin' || adminRoleLower === 'main admin' || (adminRoleLower === 'admin' && (!admin.state || admin.state.toLowerCase() === 'all india'));
  if (isGlobalSuper) return true;

  let rawMgrRole = String(manager.role || manager.level || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const levelNumMap = { '1': 'state', '2': 'district', '3': 'division', '4': 'pincode' };
  if (levelNumMap[rawMgrRole]) rawMgrRole = levelNumMap[rawMgrRole];
  if (levelNumMap[String(manager.level || '').trim()]) rawMgrRole = levelNumMap[String(manager.level || '').trim()];

  // 1. State Manager -> ONLY State Admin for that state
  if (rawMgrRole.includes('state')) {
    if (!adminRoleLower.includes('state') && !(adminRoleLower === 'admin' && admin.state)) return false;
    return matchesState(admin, manager);
  }

  // 2. District Manager -> ONLY District Admin for that district
  if (rawMgrRole.includes('district')) {
    if (!adminRoleLower.includes('district')) return false;
    return matchesDistrict(admin, manager);
  }

  // 3. Division Manager -> ONLY Division Admin for that division
  if (rawMgrRole.includes('division') || rawMgrRole.includes('divisional')) {
    if (!adminRoleLower.includes('division') && !adminRoleLower.includes('divisional')) return false;
    return matchesDivision(admin, manager);
  }

  // 4. Pincode Manager -> ONLY Pincode Admin for that exact pincode
  if (rawMgrRole.includes('pincode')) {
    if (!adminRoleLower.includes('pincode')) return false;
    return matchesPincode(admin, manager);
  }

  return false;
};

// Returns true if admin is the authorized territorial administrator for approval
const isRelatedAdminForManager = (admin, manager) => {
  return isDesignatedTerritorialAdmin(admin, manager);
};

const formatAddressString = (addr, fallback = 'Not provided') => {
  if (!addr) return fallback;
  if (typeof addr === 'string') return addr.trim() || fallback;
  if (typeof addr === 'object') {
    if (typeof addr.fullAddress === 'string' && addr.fullAddress.trim()) {
      return addr.fullAddress.trim();
    }
    const parts = [
      addr.buildingNo || addr.doorNo || addr.doorNumber || addr.houseNumber,
      addr.street || addr.streetName || addr.streetAddress,
      addr.locality || addr.area,
      addr.village || addr.town || addr.city,
      addr.postOffice,
      addr.taluk || addr.division,
      addr.district,
      addr.state,
      addr.pincode || addr.pinCode || addr.postalCode
    ].filter(Boolean).map(v => typeof v === 'string' ? v.trim() : String(v)).filter(Boolean);

    if (parts.length > 0) return parts.join(', ');
    const vals = Object.values(addr).filter(v => (typeof v === 'string' || typeof v === 'number') && String(v).trim()).map(v => String(v).trim());
    if (vals.length > 0) return vals.join(', ');
  }
  return String(addr || fallback);
};

const populateManager = async (m, relation, user) => {
  const [state, district, division, pincode] = await Promise.all([
    m.stateId ? db.states.findById(m.stateId) : null,
    m.districtId ? db.districts.findById(m.districtId) : null,
    m.divisionId ? db.divisions.findById(m.divisionId) : null,
    m.pincodeId ? db.pincodes.findById(m.pincodeId) : null
  ]);

  const isSelf = String(m._id || m.id) === String(user?.id || user?._id);
  const status = m.status || 'active';
  const adminApprovalStatus = m.adminApprovalStatus || (status === 'active' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending');

  const resolvedState = state?.name || m.state || m.assignedState || null;
  const resolvedDistrict = district?.name || m.district || m.assignedDistrict || null;
  const resolvedDivision = division?.name || m.division || m.assignedDivision || null;
  const resolvedPincode = pincode?.code || m.pincode || m.assignedPincode || null;

  const targetAdminRole = getRelatedAdminRole(m.role);
  let resolvedTargetAdminName = m.targetAdminName || null;
  if (!resolvedTargetAdminName && targetAdminRole) {
    const matchedAdmin = Array.from(db.users).find(u => isRelatedAdminForManager(u, m));
    if (matchedAdmin) resolvedTargetAdminName = matchedAdmin.name;
  }

  const canApprove = isDesignatedTerritorialAdmin(user, m);

  const s = (status || '').toLowerCase();
  const admApp = (adminApprovalStatus || '').toLowerCase();
  const subAdmApp = (m.subAdminApprovalStatus || '').toLowerCase();
  const mainAdmApp = (m.mainAdminApprovalStatus || '').toLowerCase();
  const appStage = (m.approvalStage || '').toLowerCase();
  const kycStat = (m.kycStatus || '').toLowerCase();
  let workflowStage = 'Awaiting Territory Approval';
  if (s === 'rejected' || admApp === 'rejected' || subAdmApp === 'rejected' || appStage === 'rejected') {
    workflowStage = 'Territory Rejected';
  } else if (kycStat === 'rejected') {
    workflowStage = 'KYC Rejected';
  } else if ((s === 'active' || s === 'approved') && (kycStat === 'verified' || kycStat === 'approved' || m.isActive)) {
    workflowStage = 'Activated';
  } else if (s === 'pending_kyc' || s === 'pending_kyc_approval' || s === 'pending_kyc_verification' || mainAdmApp === 'approved' || appStage === 'kyc_review') {
    workflowStage = 'Awaiting KYC Review';
  } else if (s === 'pending_main_admin_approval' || subAdmApp === 'approved' || appStage === 'mainadmin_review' || (admApp === 'approved' && mainAdmApp === 'pending')) {
    workflowStage = 'Awaiting Main Admin Review';
  } else if (s === 'active' || s === 'approved') {
    workflowStage = 'Activated';
  }

  return {
    id: m._id || m.id,
    _id: m._id || m.id,
    name: m.name,
    email: m.email,
    mobile: m.mobile || m.phone,
    phone: m.phone || m.mobile,
    role: m.role,
    roleTitle: formatRoleTitle(m.role),
    level: m.level,
    status,
    adminApprovalStatus,
    workflowStage,
    targetAdminRole,
    targetAdminName: resolvedTargetAdminName || 'Pending Admin Assignment',
    targetJurisdiction: m.targetJurisdiction || (resolvedPincode ? `PIN: ${resolvedPincode}` : resolvedDivision ? `${resolvedDivision} Division` : resolvedDistrict ? `${resolvedDistrict} District` : `${resolvedState || 'State'} Jurisdiction`),
    canApprove,
    kycStatus: m.kycStatus || (status === 'active' ? 'Verified' : 'pending_verification'),
    rejectionReason: m.rejectionReason || null,
    pendingReason: m.pendingReason || m.adminPendingReason || m.reviewerReason || null,
    reviewerReason: m.pendingReason || m.adminPendingReason || m.rejectionReason || null,
    adminPendingBy: m.adminPendingBy || null,
    adminPendingById: m.adminPendingById || null,
    adminPendingByRole: m.adminPendingByRole || m.adminPendingRole || null,
    adminPendingAt: m.adminPendingAt || null,
    reviewHistory: Array.isArray(m.reviewHistory) ? m.reviewHistory : [],
    adminApprovedBy: m.adminApprovedBy || null,
    adminApprovedAt: m.adminApprovedAt || null,
    adminRejectedBy: m.adminRejectedBy || null,
    adminRejectedAt: m.adminRejectedAt || null,
    dob: m.dob || null,
    gender: m.gender || null,
    rawAddress: m.address || null,
    address: formatAddressString(m.address, null),
    doorNumber: m.doorNumber || m.doorNo || m.houseNumber || null,
    street: m.street || m.streetName || m.doorStreet || null,
    area: m.area || m.locality || null,
    village: m.village || m.town || m.city || null,
    division: resolvedDivision || m.division || m.assignedDivision || null,
    taluk: m.taluk || resolvedDivision || m.division || m.assignedDivision || null,
    district: resolvedDistrict || m.district || m.assignedDistrict || null,
    state: resolvedState || m.state || m.assignedState || 'Tamil Nadu',
    pincode: resolvedPincode || m.pincode || m.assignedPincode || null,
    fullAddress: formatAddressString(m.fullAddress || m.address, [m.village, resolvedDivision || m.division, resolvedDistrict || m.district, resolvedState || m.state, resolvedPincode || m.pincode].filter(Boolean).join(', ')),
    aadharNumber: m.aadharNumber || m.documents?.aadharNumber || m.kyc?.aadhaarNumber || null,
    panNumber: m.panNumber || m.documents?.panNumber || m.kyc?.panNumber || null,
    bankDetails: m.bankDetails || {
      accountHolderName: m.accountHolderName || m.name || '',
      bankName: m.bankName || '',
      accountNumber: m.accountNumber || '',
      ifscCode: m.ifscCode || '',
      branchName: m.branchName || ''
    },
    documents: (() => {
      const rawDocs = m.documents || {};
      const kycDocs = m.kycDocs || {};
      const kyc = m.kyc || {};
      const getVal = (f) => {
        if (!f) return null;
        if (typeof f === 'string') return f;
        if (typeof f === 'object' && f.url) return f.url;
        return null;
      };
      const aadharUrl = rawDocs.aadharUrl || rawDocs.aadhaarUrl || rawDocs.aadhaar || rawDocs.aadhar ||
        getVal(kycDocs.aadhaarFront) || getVal(kycDocs.aadhaar) || getVal(kycDocs.aadhar) ||
        kyc.aadhaarImage || kyc.aadharImage || m.aadharUrl || m.aadhaarUrl || m.aadharPhoto || m.aadhaarPhoto || null;
      const panUrl = rawDocs.panUrl || rawDocs.pan ||
        getVal(kycDocs.panCard) || getVal(kycDocs.pan) ||
        kyc.panImage || m.panUrl || m.panPhoto || null;
      const bankUrl = rawDocs.bankPassbookUrl || rawDocs.bankUrl || rawDocs.bankPassbook || rawDocs.passbookUrl || rawDocs.bankDetailsUrl || rawDocs.bank ||
        getVal(kycDocs.bankPassbook) || getVal(kycDocs.passbook) || m.bankPassbookUrl || m.bankUrl || m.bankPhoto || m.bankPassbook || m.bankPassbookPhoto || null;
      const cancelledChequeUrl = rawDocs.cancelledChequeUrl || rawDocs.chequeUrl || rawDocs.cancelledCheque ||
        getVal(kycDocs.cancelledCheque) || getVal(kycDocs.cheque) || m.cancelledChequeUrl || m.cancelledCheque || m.cancelledChequePhoto || null;
      const signatureUrl = rawDocs.signatureUrl || rawDocs.signature ||
        getVal(kycDocs.signature) || getVal(kycDocs.authorizedSignature) || m.signatureUrl || m.signaturePhoto || m.signature || null;
      const passportUrl = rawDocs.passportUrl || rawDocs.passport ||
        getVal(kycDocs.passport) || getVal(kycDocs.passportPhoto) || m.passportUrl || m.passportPhoto || null;
      return {
        ...rawDocs,
        aadharNumber: m.aadharNumber || rawDocs.aadharNumber || kyc.aadhaarNumber || null,
        panNumber: m.panNumber || rawDocs.panNumber || kyc.panNumber || null,
        aadharUrl,
        aadharFileName: rawDocs.aadharFileName || (kycDocs.aadhaarFront?.name) || (aadharUrl ? 'Aadhaar_Document' : null),
        panUrl,
        panFileName: rawDocs.panFileName || (kycDocs.panCard?.name) || (panUrl ? 'PAN_Document' : null),
        bankUrl,
        bankPassbookUrl: bankUrl,
        bankFileName: rawDocs.bankPassbookFileName || rawDocs.bankFileName || (kycDocs.bankPassbook?.name) || (bankUrl ? 'Bank_Passbook' : null),
        cancelledChequeUrl,
        cancelledChequeFileName: rawDocs.cancelledChequeFileName || (kycDocs.cancelledCheque?.name) || (cancelledChequeUrl ? 'Cancelled_Cheque' : null),
        signatureUrl,
        signatureFileName: rawDocs.signatureFileName || (kycDocs.signature?.name) || (signatureUrl ? 'Digital_Signature' : null),
        passportUrl,
        passportFileName: rawDocs.passportFileName || (kycDocs.passport?.name) || (passportUrl ? 'Passport_Document' : null)
      };
    })(),
    kycDocs: m.kycDocs || {},
    aadharPhoto: m.aadharPhoto || m.documents?.aadharUrl || m.kycDocs?.aadhaarFront?.url || null,
    panPhoto: m.panPhoto || m.documents?.panUrl || m.kycDocs?.panCard?.url || null,
    bankPassbookPhoto: m.bankPassbookPhoto || m.documents?.bankPassbookUrl || m.documents?.bankUrl || m.kycDocs?.bankPassbook?.url || null,
    cancelledChequePhoto: m.cancelledChequePhoto || m.documents?.cancelledChequeUrl || m.kycDocs?.cancelledCheque?.url || null,
    signaturePhoto: m.signaturePhoto || m.documents?.signatureUrl || m.kycDocs?.signature?.url || null,
    avatar: m.avatar || m.avatarUrl || null,
    avatarUrl: m.avatarUrl || m.avatar || null,
    declarationAccepted: !!m.declarationAccepted,
    relation, // 'peer' or 'subordinate'
    relationLabel: isSelf ? 'You (Current User)' : (relation === 'peer' ? 'Equal Level (Peer)' : 'Under Your Scope (Subordinate)'),
    isSelf,
    stateId: m.stateId,
    stateName: resolvedState,
    districtId: m.districtId,
    districtName: resolvedDistrict,
    divisionId: m.divisionId,
    divisionName: resolvedDivision,
    pincodeId: m.pincodeId,
    pincodeCode: resolvedPincode,
    pincodeArea: pincode?.areaName || null,
    jurisdiction: resolvedPincode 
      ? `PIN: ${resolvedPincode}` 
      : resolvedDivision 
      ? `${resolvedDivision} Division` 
      : resolvedDistrict 
      ? `${resolvedDistrict} District` 
      : resolvedState || '',
    assignedArea: [
      pincode?.areaName, 
      resolvedDivision, 
      resolvedDistrict, 
      resolvedState
    ].filter(Boolean).join(', '),
    createdAt: m.createdAt || null,
    joinedDate: m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently Joined'
  };
};

// GET /api/managers - Retrieve managers directory with role-based filtering and status filtering
const getLowerLevelManagers = async (req, res) => {
  try {
    const user = req.user;
    const allUsersList = Array.from(db.users || []);
    const allManagersList = Array.from(db.managers || []);
    const combinedManagersMap = new Map();
    const emailToIdMap = new Map();

    allUsersList.filter(u => (u.role || '').toLowerCase().includes('manager')).forEach(u => {
      const primaryKey = String(u._id || u.id || u.email || '').trim().toLowerCase();
      if (primaryKey) {
        combinedManagersMap.set(primaryKey, u);
        if (u.email) emailToIdMap.set(String(u.email).trim().toLowerCase(), primaryKey);
      }
    });

    allManagersList.forEach(m => {
      const primaryKey = String(m._id || m.id || m.email || '').trim().toLowerCase();
      const existingId = combinedManagersMap.has(primaryKey) ? primaryKey : (m.email && emailToIdMap.get(String(m.email).trim().toLowerCase()));
      if (existingId) {
        Object.assign(combinedManagersMap.get(existingId), {
          ...m,
          role: m.role || 'pincode_manager',
          status: m.status || 'active'
        });
      } else if (primaryKey) {
        combinedManagersMap.set(primaryKey, {
          ...m,
          role: m.role || 'pincode_manager',
          status: m.status || 'active'
        });
        if (m.email) emailToIdMap.set(String(m.email).trim().toLowerCase(), primaryKey);
      }
    });

    // Also merge approved manager portal registrations from MongoDB Atlas managerrequests collection
    try {
      const mongoDb = await getMongoDb();
      if (mongoDb) {
        const atlasRequests = await mongoDb.collection('managerrequests').find({
          status: { $in: ['approved', 'Approved', 'active', 'Active', 'suspended', 'Suspended', 'deleted', 'Deleted'] }
        }).toArray();
        for (const reqDoc of atlasRequests) {
          const levelMap = {
            'state': 'state_manager',
            'district': 'district_manager',
            'division': 'division_manager',
            'divisional': 'division_manager',
            'pincode': 'pincode_manager',
            '1': 'state_manager',
            '2': 'district_manager',
            '3': 'division_manager',
            '4': 'pincode_manager'
          };
          const derivedRole = levelMap[String(reqDoc.level || '').toLowerCase()] || reqDoc.role || 'pincode_manager';
          const rawId = String(reqDoc.userId || reqDoc._id || reqDoc.id || '').trim().toLowerCase();
          const email = reqDoc.email ? String(reqDoc.email).trim().toLowerCase() : null;
          const existingId = (rawId && combinedManagersMap.has(rawId)) ? rawId : (email && emailToIdMap.get(email));

          const existing = existingId ? combinedManagersMap.get(existingId) : null;
          const rawStatus = reqDoc.status || existing?.status || 'active';
          const isSusp = String(rawStatus).toLowerCase() === 'suspended';
          const isDel = String(rawStatus).toLowerCase() === 'deleted' || reqDoc.isDeleted === true || existing?.isDeleted === true;

          const mappedApproved = {
            ...(existing || {}),
            _id: reqDoc._id,
            id: reqDoc.userId || String(reqDoc._id),
            userId: reqDoc.userId || String(reqDoc._id),
            name: reqDoc.name || existing?.name || 'Manager',
            email: reqDoc.email || existing?.email || '',
            phone: reqDoc.phone || reqDoc.altPhone || existing?.phone || '',
            mobile: reqDoc.phone || reqDoc.altPhone || existing?.mobile || '',
            role: derivedRole,
            level: reqDoc.level || existing?.level || derivedRole.replace('_manager', ''),
            state: reqDoc.assignedState || reqDoc.state || existing?.state || '',
            district: reqDoc.assignedDistrict || reqDoc.district || existing?.district || '',
            division: reqDoc.assignedDivision || reqDoc.division || existing?.division || '',
            pincode: reqDoc.assignedPincode || reqDoc.pincode || existing?.pincode || '',
            assignedState: reqDoc.assignedState || reqDoc.state || existing?.assignedState || '',
            assignedDistrict: reqDoc.assignedDistrict || reqDoc.district || existing?.assignedDistrict || '',
            assignedDivision: reqDoc.assignedDivision || reqDoc.division || existing?.assignedDivision || '',
            assignedPincode: reqDoc.assignedPincode || reqDoc.pincode || existing?.assignedPincode || '',
            status: isDel ? 'Deleted' : isSusp ? 'Suspended' : 'Active',
            adminApprovalStatus: reqDoc.adminApprovalStatus || existing?.adminApprovalStatus || 'approved',
            kycStatus: reqDoc.kycStatus || existing?.kycStatus || 'verified',
            isActive: !isDel && !isSusp,
            isDeleted: isDel,
            isSuspended: isSusp
          };

          if (existingId) {
            Object.assign(combinedManagersMap.get(existingId), mappedApproved);
          } else if (rawId) {
            combinedManagersMap.set(rawId, mappedApproved);
            if (email) emailToIdMap.set(email, rawId);
          }
        }
      }
    } catch (_) {
      // Atlas request fallback
    }

    const allCandidateManagers = Array.from(combinedManagersMap.values());
    const currentUserId = String(user.id || user._id);
    const rawRole = user.role || '';
    const roleLower = rawRole.toLowerCase().replace(/_/g, ' ');

    let rawPeers = [];
    let rawSubordinates = [];

    if (roleLower.includes('admin')) {
      // Caller is an Administrator: view all managers subordinate to this Admin
      rawSubordinates = allCandidateManagers.filter(u => canAdminManage(user, u));
    } else {
      const allUsers = allUsersList;
      // Caller is a Field Manager
      let peerRoleFilter = user.role;
      let subordinateRoleFilter = [];
      let peerLocationFilter = {};
      let subordinateLocationFilter = {};

      if (user.role === 'state_manager') {
        peerLocationFilter = { stateId: user.stateId };
        subordinateRoleFilter = ['district_manager', 'division_manager', 'pincode_manager'];
        subordinateLocationFilter = { stateId: user.stateId };
      } else if (user.role === 'district_manager') {
        peerLocationFilter = { districtId: user.districtId };
        subordinateRoleFilter = ['division_manager', 'pincode_manager'];
        subordinateLocationFilter = { districtId: user.districtId };
      } else if (user.role === 'division_manager') {
        peerLocationFilter = { divisionId: user.divisionId };
        subordinateRoleFilter = ['pincode_manager'];
        subordinateLocationFilter = { divisionId: user.divisionId };
      } else if (user.role === 'pincode_manager') {
        peerLocationFilter = { pincodeId: user.pincodeId };
        subordinateRoleFilter = [];
        subordinateLocationFilter = {};
      }

      // Filter peers
      rawPeers = allUsers.filter(u => {
        if (String(u._id || u.id) === currentUserId) return false;
        if (u.role !== peerRoleFilter) return false;
        if (peerLocationFilter.stateId && u.stateId !== peerLocationFilter.stateId) return false;
        if (peerLocationFilter.districtId && u.districtId !== peerLocationFilter.districtId) return false;
        if (peerLocationFilter.divisionId && u.divisionId !== peerLocationFilter.divisionId) return false;
        if (peerLocationFilter.pincodeId && u.pincodeId !== peerLocationFilter.pincodeId) return false;
        return true;
      });

      // Filter subordinates
      rawSubordinates = subordinateRoleFilter.length > 0 ? allUsers.filter(u => {
        if (String(u._id || u.id) === currentUserId) return false;
        if (!subordinateRoleFilter.includes(u.role)) return false;
        if (subordinateLocationFilter.stateId && u.stateId !== subordinateLocationFilter.stateId) return false;
        if (subordinateLocationFilter.districtId && u.districtId !== subordinateLocationFilter.districtId) return false;
        if (subordinateLocationFilter.divisionId && u.divisionId !== subordinateLocationFilter.divisionId) return false;
        return true;
      }) : [];
    }

    // Optional query parameter filtering: level
    const { level, status, search, state, district, division, pincode, stateId, districtId, divisionId, pincodeId } = req.query;
    if (level) {
      const levelMap = {
        'state': 'state_manager',
        'district': 'district_manager',
        'division': 'division_manager',
        'divisional': 'division_manager',
        'pincode': 'pincode_manager',
        '1': 'state_manager',
        '2': 'district_manager',
        '3': 'division_manager',
        '4': 'pincode_manager'
      };
      const targetRole = levelMap[level.toLowerCase()] || level;
      rawSubordinates = rawSubordinates.filter(m => m.role === targetRole || String(m.level) === String(level));
      rawPeers = rawPeers.filter(m => m.role === targetRole || String(m.level) === String(level));
    }

    // Optional query parameter filtering: state
    if (state || stateId) {
      const matchStateFilter = (m) => {
        if (stateId && String(m.stateId || m.assignedStateId || '').toLowerCase() === String(stateId).toLowerCase()) return true;
        if (state && (
          (m.state && m.state.trim().toLowerCase() === state.trim().toLowerCase()) ||
          (m.assignedState && m.assignedState.trim().toLowerCase() === state.trim().toLowerCase())
        )) return true;
        return false;
      };
      rawSubordinates = rawSubordinates.filter(matchStateFilter);
      rawPeers = rawPeers.filter(matchStateFilter);
    }

    // Optional query parameter filtering: district
    if (district || districtId) {
      const matchDistFilter = (m) => {
        if (districtId && String(m.districtId || m.assignedDistrictId || '').toLowerCase() === String(districtId).toLowerCase()) return true;
        if (district && (
          (m.district && m.district.trim().toLowerCase() === district.trim().toLowerCase()) ||
          (m.assignedDistrict && m.assignedDistrict.trim().toLowerCase() === district.trim().toLowerCase())
        )) return true;
        return false;
      };
      rawSubordinates = rawSubordinates.filter(matchDistFilter);
      rawPeers = rawPeers.filter(matchDistFilter);
    }

    // Optional query parameter filtering: division
    if (division || divisionId) {
      const matchDivFilter = (m) => {
        if (divisionId && String(m.divisionId || m.assignedDivisionId || '').toLowerCase() === String(divisionId).toLowerCase()) return true;
        if (division && (
          (m.division && m.division.trim().toLowerCase() === division.trim().toLowerCase()) ||
          (m.assignedDivision && m.assignedDivision.trim().toLowerCase() === division.trim().toLowerCase())
        )) return true;
        return false;
      };
      rawSubordinates = rawSubordinates.filter(matchDivFilter);
      rawPeers = rawPeers.filter(matchDivFilter);
    }

    // Optional query parameter filtering: pincode
    if (pincode || pincodeId) {
      const matchPinFilter = (m) => {
        if (pincodeId && String(m.pincodeId || m.assignedPincodeId || '').toLowerCase() === String(pincodeId).toLowerCase()) return true;
        if (pincode && (
          String(m.pincode || '').trim() === String(pincode).trim() ||
          String(m.assignedPincode || '').trim() === String(pincode).trim()
        )) return true;
        return false;
      };
      rawSubordinates = rawSubordinates.filter(matchPinFilter);
      rawPeers = rawPeers.filter(matchPinFilter);
    }

    // Never display unassigned manager records or dummy records
    const isAssignedManager = (m) => {
      if (m.role === 'state_manager') {
        return Boolean(m.state || m.assignedState || m.stateId || m.assignedStateId);
      }
      if (m.role === 'district_manager') {
        return Boolean(m.district || m.assignedDistrict || m.districtId || m.assignedDistrictId);
      }
      if (m.role === 'division_manager') {
        return Boolean(m.division || m.assignedDivision || m.divisionId || m.assignedDivisionId);
      }
      if (m.role === 'pincode_manager') {
        return Boolean(m.pincode || m.assignedPincode || m.pincodeId || m.assignedPincodeId);
      }
      return false;
    };

    rawSubordinates = rawSubordinates.filter(isAssignedManager);
    rawPeers = rawPeers.filter(isAssignedManager);

    // Manager Directory: Strictly displays ONLY approved and activated managers.
    // Applications that are pending, under-review, awaiting KYC, or rejected belong exclusively in Manager Requests.
    const requestedStatus = (status || 'active').toLowerCase().trim();
    const isApprovedAndActive = (m) => {
      const s = (m.status || '').toLowerCase().trim();
      const admApp = (m.adminApprovalStatus || '').toLowerCase().trim();
      const kycStat = (m.kycStatus || '').toLowerCase().trim();
      // Drop pending, under_review, awaiting KYC, or rejected records
      if (
        s === 'pending' ||
        s === 'under_review' ||
        s === 'pending_admin_approval' ||
        s === 'pending_sub_admin_approval' ||
        s === 'pending_kyc' ||
        s === 'pending_kyc_approval' ||
        s === 'rejected' ||
        admApp === 'rejected' ||
        (admApp && admApp !== 'approved') ||
        kycStat === 'rejected'
      ) {
        return false;
      }
      if (requestedStatus === 'all') {
        return s === 'active' || s === 'approved' || s === 'suspended' || s === 'deleted' || m.isDeleted === true;
      }
      if (requestedStatus === 'suspended') return s === 'suspended';
      if (requestedStatus === 'deleted') return s === 'deleted' || m.isDeleted === true;
      if (requestedStatus === 'inactive') return s === 'inactive';
      return (s === 'active' || s === 'approved') && s !== 'suspended' && s !== 'deleted' && !m.isDeleted && m.isActive !== false;
    };

    rawSubordinates = rawSubordinates.filter(isApprovedAndActive);
    rawPeers = rawPeers.filter(isApprovedAndActive);

    // Optional search filter
    if (search) {
      const term = search.toLowerCase();
      const filterMatch = (m) => (
        (m.name && m.name.toLowerCase().includes(term)) ||
        (m.email && m.email.toLowerCase().includes(term)) ||
        (m.phone && m.phone.includes(term)) ||
        (m.mobile && m.mobile.includes(term)) ||
        (m.state && m.state.toLowerCase().includes(term)) ||
        (m.district && m.district.toLowerCase().includes(term)) ||
        (m.division && m.division.toLowerCase().includes(term)) ||
        (m.pincode && String(m.pincode).includes(term))
      );
      rawSubordinates = rawSubordinates.filter(filterMatch);
      rawPeers = rawPeers.filter(filterMatch);
    }

    const peers = await Promise.all(rawPeers.map(m => populateManager(m, 'peer', user)));
    const subordinates = await Promise.all(rawSubordinates.map(m => populateManager(m, 'subordinate', user)));
    const all = roleLower.includes('admin') ? subordinates : [...peers, ...subordinates];

    const activeCount = subordinates.filter(m => (m.status || '').toLowerCase() === 'active').length;

    res.json({
      success: true,
      count: all.length,
      data: subordinates,
      subordinates,
      peers,
      all,
      stats: {
        total: all.length,
        pendingApprovals: 0, // Directory excludes pending requests from counts
        activeManagers: activeCount,
        peersCount: peers.length,
        subordinatesCount: subordinates.length,
        currentUserRole: user.role
      }
    });
  } catch (err) {
    console.error('Get manager directory error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve manager directory', error: err.message });
  }
};

// GET /api/managers/requests - Centralized manager onboarding requests across all levels
const getManagerRequests = async (req, res) => {
  try {
    const user = req.user;
    const allUsersList = Array.from(db.users || []);
    const allManagersList = Array.from(db.managers || []);

    const combinedManagersMap = new Map();
    allUsersList.filter(u => (u.role || '').toLowerCase().includes('manager')).forEach(u => {
      const idKey = String(u._id || u.id || u.email || '').trim().toLowerCase();
      if (idKey) combinedManagersMap.set(idKey, u);
    });
    allManagersList.forEach(m => {
      const idKey = String(m._id || m.id || m.email || '').trim().toLowerCase();
      if (idKey && !combinedManagersMap.has(idKey)) {
        combinedManagersMap.set(idKey, {
          ...m,
          role: m.role || 'pincode_manager',
          status: m.status || 'pending'
        });
      }
    });

    // Load from MongoDB Atlas managerrequests collection (public manager portal registrations)
    try {
      const mongoDb = await getMongoDb();
      if (mongoDb) {
        const atlasRequests = await mongoDb.collection('managerrequests').find({}).toArray();
        for (const reqDoc of atlasRequests) {
          const levelMap = {
            'state': 'state_manager',
            'district': 'district_manager',
            'division': 'division_manager',
            'divisional': 'division_manager',
            'pincode': 'pincode_manager',
            '1': 'state_manager',
            '2': 'district_manager',
            '3': 'division_manager',
            '4': 'pincode_manager'
          };
          const derivedRole = levelMap[String(reqDoc.level || '').toLowerCase()] || reqDoc.role || 'pincode_manager';
          const idKey = String(reqDoc._id || reqDoc.userId || reqDoc.id || reqDoc.email || '').trim().toLowerCase();
          const emailKey = reqDoc.email ? String(reqDoc.email).trim().toLowerCase() : null;
          const userKey = reqDoc.userId ? String(reqDoc.userId).trim().toLowerCase() : null;

          const existing = combinedManagersMap.get(idKey) || (emailKey ? combinedManagersMap.get(emailKey) : null) || (userKey ? combinedManagersMap.get(userKey) : null);
          const normStatus = (reqDoc.status || 'Pending').toLowerCase();

          const mappedRequest = {
            ...(existing || {}),
            _id: reqDoc._id,
            id: reqDoc.userId || String(reqDoc._id),
            userId: reqDoc.userId || String(reqDoc._id),
            requestId: reqDoc.requestId || `REQ-${String(reqDoc._id).slice(-6).toUpperCase()}`,
            name: reqDoc.name || existing?.name || 'Manager Applicant',
            email: reqDoc.email || existing?.email || '',
            phone: reqDoc.phone || reqDoc.altPhone || existing?.phone || '',
            mobile: reqDoc.phone || reqDoc.altPhone || existing?.mobile || '',
            role: derivedRole,
            level: reqDoc.level || existing?.level || derivedRole.replace('_manager', ''),
            state: reqDoc.assignedState || reqDoc.state || existing?.state || '',
            district: reqDoc.assignedDistrict || reqDoc.district || existing?.district || '',
            division: reqDoc.assignedDivision || reqDoc.division || existing?.division || '',
            pincode: reqDoc.assignedPincode || reqDoc.pincode || existing?.pincode || '',
            assignedState: reqDoc.assignedState || reqDoc.state || existing?.assignedState || '',
            assignedDistrict: reqDoc.assignedDistrict || reqDoc.district || existing?.assignedDistrict || '',
            assignedDivision: reqDoc.assignedDivision || reqDoc.division || existing?.assignedDivision || '',
            assignedPincode: reqDoc.assignedPincode || reqDoc.pincode || existing?.assignedPincode || '',
            address: reqDoc.address || existing?.address || '',
            status: normStatus,
            approvalStage: reqDoc.approvalStage || existing?.approvalStage || 'subadmin_review',
            subAdminApprovalStatus: reqDoc.subAdminApprovalStatus || existing?.subAdminApprovalStatus || 'pending',
            mainAdminApprovalStatus: reqDoc.mainAdminApprovalStatus || existing?.mainAdminApprovalStatus || 'waiting_subadmin',
            kycVerificationStatus: reqDoc.kycVerificationStatus || existing?.kycVerificationStatus || 'not_started',
            adminApprovalStatus: reqDoc.adminApprovalStatus || (reqDoc.subAdminApprovalStatus === 'approved' ? 'approved' : (normStatus === 'approved' ? 'approved' : (existing?.adminApprovalStatus || 'pending'))),
            subadminApprovedByName: reqDoc.subadminApprovedByName || existing?.subadminApprovedByName || null,
            subadminApprovedAt: reqDoc.subadminApprovedAt || existing?.subadminApprovedAt || null,
            mainadminApprovedByName: reqDoc.mainadminApprovedByName || existing?.mainadminApprovedByName || null,
            mainadminApprovedAt: reqDoc.mainadminApprovedAt || existing?.mainadminApprovedAt || null,
            pendingReason: reqDoc.pendingReason || reqDoc.adminPendingReason || existing?.pendingReason || null,
            rejectionReason: reqDoc.rejectionReason || existing?.rejectionReason || null,
            reviewerReason: reqDoc.pendingReason || reqDoc.adminPendingReason || reqDoc.rejectionReason || existing?.reviewerReason || null,
            reviewHistory: Array.isArray(reqDoc.reviewHistory) ? reqDoc.reviewHistory : (existing?.reviewHistory || []),
            documents: reqDoc.documents || existing?.documents || {},
            createdAt: reqDoc.createdAt || existing?.createdAt,
            updatedAt: reqDoc.updatedAt || existing?.updatedAt
          };

          if (idKey) combinedManagersMap.set(idKey, mappedRequest);
          if (emailKey) combinedManagersMap.set(emailKey, mappedRequest);
          if (userKey) combinedManagersMap.set(userKey, mappedRequest);
        }
      }
    } catch (mAtlasErr) {
      console.warn('[Sub-Admin] Error loading managerrequests from Atlas:', mAtlasErr.message);
    }

    const allCandidateManagers = Array.from(new Set(combinedManagersMap.values()));
    const rawRole = user.role || '';
    const roleLower = rawRole.toLowerCase().replace(/_/g, ' ');

    let scopedRequests = allCandidateManagers;
    if (roleLower.includes('admin')) {
      // Allow Admin to view all managers within their territorial oversight:
      scopedRequests = scopedRequests.filter(u => canAdminManage(user, u));
    } else {
      scopedRequests = [];
    }

    const { level, status, search, state, district, division, pincode, stateId, districtId, divisionId, pincodeId } = req.query;

    if (level && level.toLowerCase() !== 'all') {
      const levelMap = {
        'state': 'state_manager',
        'district': 'district_manager',
        'division': 'division_manager',
        'divisional': 'division_manager',
        'pincode': 'pincode_manager',
        '1': 'state_manager',
        '2': 'district_manager',
        '3': 'division_manager',
        '4': 'pincode_manager'
      };
      const targetRole = levelMap[level.toLowerCase()] || level;
      scopedRequests = scopedRequests.filter(m => m.role === targetRole || String(m.level) === String(level));
    }

    // Strict Role-Level Boundary Enforcement:
    if (roleLower.includes('pincode')) {
      scopedRequests = scopedRequests.filter(m => {
        const r = String(m.role || '').toLowerCase();
        const l = String(m.level || '').toLowerCase();
        return r === 'pincode_manager' || l === 'pincode' || l === '4';
      });
    } else if (roleLower.includes('division') || roleLower.includes('divisional')) {
      scopedRequests = scopedRequests.filter(m => {
        const r = String(m.role || '').toLowerCase();
        const l = String(m.level || '').toLowerCase();
        return r === 'division_manager' || r === 'pincode_manager' || ['division', 'divisional', 'pincode', '3', '4'].includes(l);
      });
    } else if (roleLower.includes('district')) {
      scopedRequests = scopedRequests.filter(m => {
        const r = String(m.role || '').toLowerCase();
        const l = String(m.level || '').toLowerCase();
        return !r.includes('state') && l !== 'state' && l !== '1';
      });
    }

    if (state || stateId) {
      scopedRequests = scopedRequests.filter(m => {
        if (stateId && String(m.stateId || m.assignedStateId || '').toLowerCase() === String(stateId).toLowerCase()) return true;
        if (state && (
          (m.state && m.state.trim().toLowerCase() === state.trim().toLowerCase()) ||
          (m.assignedState && m.assignedState.trim().toLowerCase() === state.trim().toLowerCase())
        )) return true;
        return false;
      });
    }

    if (district || districtId) {
      scopedRequests = scopedRequests.filter(m => {
        if (districtId && String(m.districtId || m.assignedDistrictId || '').toLowerCase() === String(districtId).toLowerCase()) return true;
        if (district && (
          (m.district && m.district.trim().toLowerCase() === district.trim().toLowerCase()) ||
          (m.assignedDistrict && m.assignedDistrict.trim().toLowerCase() === district.trim().toLowerCase())
        )) return true;
        return false;
      });
    }

    if (division || divisionId) {
      scopedRequests = scopedRequests.filter(m => {
        if (divisionId && String(m.divisionId || m.assignedDivisionId || '').toLowerCase() === String(divisionId).toLowerCase()) return true;
        if (division && (
          (m.division && m.division.trim().toLowerCase() === division.trim().toLowerCase()) ||
          (m.assignedDivision && m.assignedDivision.trim().toLowerCase() === division.trim().toLowerCase())
        )) return true;
        return false;
      });
    }

    if (pincode || pincodeId) {
      scopedRequests = scopedRequests.filter(m => {
        if (pincodeId && String(m.pincodeId || m.assignedPincodeId || '').toLowerCase() === String(pincodeId).toLowerCase()) return true;
        if (pincode && (
          String(m.pincode || '').trim() === String(pincode).trim() ||
          String(m.assignedPincode || '').trim() === String(pincode).trim()
        )) return true;
        return false;
      });
    }

    // Status filtering for requests: All, Pending, Approved, Rejected
    if (status && status.toLowerCase() !== 'all') {
      const statusLower = status.toLowerCase();
      scopedRequests = scopedRequests.filter(m => {
        const s = (m.status || 'pending').toLowerCase();
        const admApp = (m.adminApprovalStatus || '').toLowerCase();
        const subAdmApp = (m.subAdminApprovalStatus || '').toLowerCase();
        const mainAdmApp = (m.mainAdminApprovalStatus || '').toLowerCase();
        if (statusLower === 'pending' || statusLower === 'under_review') {
          return s.includes('pending') || s.includes('review') || !s || s === 'submitted' || admApp.includes('pending') || subAdmApp.includes('pending') || mainAdmApp.includes('pending');
        }
        if (statusLower === 'approved') {
          return s === 'pending_kyc' || s === 'pending_kyc_approval' || s === 'approved' || s === 'active' || admApp === 'approved' || subAdmApp === 'approved' || s === 'pending_main_admin_approval';
        }
        if (statusLower === 'rejected') {
          return s === 'rejected' || s === 'rejected_by_sub_admin' || s === 'kyc_rejected' || admApp === 'rejected' || subAdmApp === 'rejected';
        }
        return s === statusLower;
      });
    }

    if (search) {
      const term = search.toLowerCase();
      scopedRequests = scopedRequests.filter(m => (
        (m.name && m.name.toLowerCase().includes(term)) ||
        (m.email && m.email.toLowerCase().includes(term)) ||
        (m.phone && m.phone.includes(term)) ||
        (m.mobile && m.mobile.includes(term)) ||
        (m.state && m.state.toLowerCase().includes(term)) ||
        (m.district && m.district.toLowerCase().includes(term)) ||
        (m.division && m.division.toLowerCase().includes(term)) ||
        (m.pincode && String(m.pincode).includes(term))
      ));
    }

    const populated = await Promise.all(scopedRequests.map(m => populateManager(m, 'subordinate', user)));

    return res.json({
      success: true,
      count: populated.length,
      requests: populated,
      managers: populated,
      all: populated
    });
  } catch (err) {
    console.error('Get manager requests error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve manager requests', error: err.message });
  }
};

// GET /api/managers/:id - Retrieve specific manager details
const getManagerById = async (req, res) => {
  try {
    const { id } = req.params;
    const manager = await findManagerRecord(id);

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    // Check jurisdiction if caller is admin
    const callerRole = (req.user.role || '').toLowerCase();
    if (callerRole.includes('admin') && !canAdminManage(req.user, manager)) {
      return res.status(403).json({ success: false, message: 'You do not have jurisdiction to view this manager.' });
    }

    const populated = await populateManager(manager, 'subordinate', req.user);
    res.json({ success: true, manager: populated });
  } catch (err) {
    console.error('Get manager by ID error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve manager details', error: err.message });
  }
};

// POST /api/managers/:id/approve - Approve manager registration and activate their account
const approveManager = async (req, res) => {
  try {
    const { id } = req.params;
    const manager = await findManagerRecord(id);

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    // Verify admin jurisdiction - approval rights reserved exclusively for the authorized territory authority
    if (!isRelatedAdminForManager(req.user, manager)) {
      const targetRole = getRelatedAdminRole(manager.role);
      const targetPlace = manager.pincode ? `Pincode ${manager.pincode}` : manager.division ? `${manager.division} Division` : manager.district ? `${manager.district} District` : `${manager.state || 'State'} Jurisdiction`;
      return res.status(403).json({
        success: false,
        message: `You do not have administrative authority to approve ${manager.name} (${formatRoleTitle(manager.role)}). Initial approval for this jurisdiction must be performed by the designated ${targetRole} for ${targetPlace}.`
      });
    }

    const adminRoleLower = (req.user.role || '').toLowerCase().replace(/_/g, ' ');
    const isGlobalSuper = adminRoleLower === 'super admin' || adminRoleLower === 'main admin' || (adminRoleLower === 'admin' && (!req.user.state || req.user.state.toLowerCase() === 'all india'));

    const now = new Date().toISOString();
    let approveUpdates;
    if (isGlobalSuper) {
      // Main Admin final approval -> activates manager account
      approveUpdates = {
        status: 'active',
        overallRegistrationStatus: 'active',
        subAdminApprovalStatus: manager.subAdminApprovalStatus || 'approved',
        mainAdminApprovalStatus: 'approved',
        adminApprovalStatus: 'approved',
        isActive: true,
        requiresApproval: false,
        isFullyApproved: true,
        mainadminApprovedBy: req.user.id || req.user._id,
        mainadminApprovedByName: req.user.name || req.user.email,
        mainadminApprovedAt: now,
        adminApprovedBy: req.user.name || req.user.email,
        adminApprovedById: req.user.id || req.user._id,
        adminApprovedByRole: req.user.role,
        adminApprovedAt: now,
        rejectionReason: null,
        updatedAt: now
      };
    } else {
      // Sub Admin territory approval -> forwards to Main Admin review
      approveUpdates = {
        status: 'PENDING_MAIN_ADMIN_APPROVAL',
        overallRegistrationStatus: 'PENDING_MAIN_ADMIN_APPROVAL',
        subAdminApprovalStatus: 'approved',
        mainAdminApprovalStatus: manager.mainAdminApprovalStatus || 'pending',
        kycVerificationStatus: manager.kycVerificationStatus || 'not_started',
        adminApprovalStatus: 'approved',
        isActive: false,
        requiresApproval: true,
        isFullyApproved: false,
        subAdminApprovedBy: req.user.name || req.user.email,
        subAdminApprovedById: req.user.id || req.user._id,
        subAdminApprovedByRole: req.user.role,
        subAdminApprovedAt: now,
        adminApprovedBy: req.user.name || req.user.email,
        adminApprovedById: req.user.id || req.user._id,
        adminApprovedByRole: req.user.role,
        adminApprovedAt: now,
        rejectionReason: null,
        updatedAt: now
      };
    }
    Object.assign(manager, approveUpdates);

    await db.users.findByIdAndUpdate(manager._id || manager.id, approveUpdates);
    if (db.managers) {
      await db.managers.findByIdAndUpdate(manager._id || manager.id, approveUpdates).catch(() => {});
    }

    // Sync Sub-Admin approval to MongoDB Atlas managerrequests so Main Admin can review
    try {
      const mongoDb = await getMongoDb();
      if (mongoDb) {
        const { ObjectId } = require('mongodb');
        const mgrIdStr = String(manager._id || manager.id || manager.userId || '');
        const orClauses = [
          { userId: mgrIdStr },
          { email: (manager.email || '').toLowerCase().trim() }
        ];
        if (manager.requestId) orClauses.push({ requestId: manager.requestId });
        if (ObjectId.isValid(mgrIdStr)) orClauses.push({ _id: new ObjectId(mgrIdStr) });
        if (manager._id && typeof manager._id === 'object') orClauses.push({ _id: manager._id });

        await mongoDb.collection('users').updateMany({ $or: orClauses }, { $set: approveUpdates }).catch(() => {});
        const updateResult = await mongoDb.collection('managerrequests').updateMany(
          { $or: orClauses },
          {
            $set: {
              status: isGlobalSuper ? 'Approved' : 'Pending',
              approvalStage: isGlobalSuper ? 'approved' : 'mainadmin_review',
              overallRegistrationStatus: isGlobalSuper ? 'active' : 'PENDING_MAIN_ADMIN_APPROVAL',
              subAdminApprovalStatus: 'approved',
              mainAdminApprovalStatus: isGlobalSuper ? 'approved' : 'pending',
              subadminApprovedBy: isGlobalSuper ? (manager.subadminApprovedBy || req.user.id || req.user._id) : (req.user.id || req.user._id),
              subadminApprovedByName: isGlobalSuper ? (manager.subadminApprovedByName || req.user.name || req.user.email) : (req.user.name || req.user.email),
              subadminApprovedAt: isGlobalSuper ? (manager.subadminApprovedAt || new Date()) : new Date(),
              mainadminApprovedBy: isGlobalSuper ? (req.user.id || req.user._id) : null,
              mainadminApprovedByName: isGlobalSuper ? (req.user.name || req.user.email) : null,
              mainadminApprovedAt: isGlobalSuper ? new Date() : null,
              subAdminApproval: {
                status: 'approved',
                reviewerId: req.user.id || req.user._id,
                reviewerName: req.user.name || req.user.email,
                reviewerRole: req.user.role,
                reviewedAt: now
              },
              updatedAt: now
            }
          }
        );

        if (updateResult.matchedCount === 0) {
          await mongoDb.collection('managerrequests').insertOne({
            requestId: manager.requestId || `REQ-MGR-${(manager.role||'pincode').substring(0,3).toUpperCase()}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(1000 + Math.random() * 9000))}`,
            name: manager.name,
            email: manager.email,
            phone: manager.mobile || manager.phone,
            altPhone: manager.altPhone || '',
            level: manager.level ? String(manager.level).replace('_manager', '') : (manager.role ? manager.role.replace('_manager', '') : 'pincode'),
            role: manager.role || 'pincode_manager',
            assignedState: manager.state || manager.assignedState || '',
            assignedDistrict: manager.district || manager.assignedDistrict || '',
            assignedDivision: manager.division || manager.assignedDivision || '',
            assignedPincode: manager.pincode || manager.assignedPincode || '',
            address: typeof manager.address === 'string' ? manager.address : (manager.address?.fullAddress || ''),
            userId: mgrIdStr,
            status: isGlobalSuper ? 'Approved' : 'Pending',
            approvalStage: isGlobalSuper ? 'approved' : 'mainadmin_review',
            overallRegistrationStatus: isGlobalSuper ? 'active' : 'PENDING_MAIN_ADMIN_APPROVAL',
            subAdminApprovalStatus: 'approved',
            mainAdminApprovalStatus: isGlobalSuper ? 'approved' : 'pending',
            subadminApprovedBy: req.user.id || req.user._id,
            subadminApprovedByName: req.user.name || req.user.email,
            subadminApprovedAt: new Date(),
            subAdminApproval: {
              status: 'approved',
              reviewerId: req.user.id || req.user._id,
              reviewerName: req.user.name || req.user.email,
              reviewerRole: req.user.role,
              reviewedAt: now
            },
            documents: manager.documents || {},
            createdAt: manager.createdAt || now,
            updatedAt: now
          });
        }
      }
    } catch (mReqErr) {
      console.error('[Sub-Admin] Error syncing managerrequests on approve:', mReqErr.message);
    }

    // Automatically ensure record is in db.kycRecords for the KYC verification queue
    if (db.kycRecords) {
      const mgrIdStr = String(manager._id || manager.id);
      const kycId = `KYC-MGR-${mgrIdStr}`;
      const existingKyc = await db.kycRecords.findOne({ $or: [{ _id: kycId }, { id: kycId }, { managerId: mgrIdStr }] });
      if (!existingKyc) {
        await db.kycRecords.insertOne({
          _id: kycId,
          id: kycId,
          type: 'Manager',
          managerId: mgrIdStr,
          name: manager.name,
          category: 'Operations Management',
          role: manager.role,
          phone: manager.mobile || manager.phone,
          email: manager.email,
          state: manager.state,
          district: manager.district,
          division: manager.division,
          pincode: manager.pincode,
          stateId: manager.stateId,
          districtId: manager.districtId,
          divisionId: manager.divisionId,
          pincodeId: manager.pincodeId,
          status: 'Pending',
          kycStatus: 'Pending Verification',
          submittedDate: formatSubmittedDate(manager.createdAt, now),
          documents: manager.documents || {},
          notes: `Territory approved by ${req.user.role} "${req.user.name}". Forwarded to KYC Team for verification.`,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // Audit log entry
    if (db.auditLogs) {
      await db.auditLogs.insertOne({
        action: 'MANAGER_TERRITORY_APPROVED_FORWARDED_TO_KYC',
        adminId: req.user.id || req.user._id,
        adminName: req.user.name,
        adminRole: req.user.role,
        targetUserId: manager._id || manager.id,
        targetUserName: manager.name,
        targetUserRole: manager.role,
        details: `${manager.role.replace('_', ' ')} "${manager.name}" territory registration approved by ${req.user.role} "${req.user.name}". Forwarded to KYC Team queue. Account restricted pending KYC verification.`,
        ip: req.ip || '127.0.0.1',
        timestamp: now
      }).catch(() => {});
    }

    const populated = await populateManager(manager, 'subordinate', req.user);

    return res.json({
      success: true,
      message: `Registration for ${manager.name} (${formatRoleTitle(manager.role)}) approved by ${req.user.role}. Forwarded to KYC Review queue.`,
      manager: populated
    });
  } catch (err) {
    console.error('Approve manager error:', err);
    res.status(500).json({ success: false, message: 'Failed to approve manager', error: err.message });
  }
};

// POST /api/managers/:id/reject - Reject manager registration
const rejectManager = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const manager = await findManagerRecord(id);

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    // Verify admin jurisdiction - only authorized territory authority can reject
    if (!isRelatedAdminForManager(req.user, manager)) {
      const targetRole = getRelatedAdminRole(manager.role);
      const targetPlace = manager.pincode ? `Pincode ${manager.pincode}` : manager.division ? `${manager.division} Division` : manager.district ? `${manager.district} District` : `${manager.state || 'State'} Jurisdiction`;
      return res.status(403).json({
        success: false,
        message: `You do not have administrative authority to reject ${manager.name} (${formatRoleTitle(manager.role)}). Rejection for this jurisdiction must be handled by the designated ${targetRole} for ${targetPlace}.`
      });
    }

    const rejectionReason = (reason || '').trim();
    if (!rejectionReason) {
      return res.status(400).json({ success: false, message: 'A rejection reason is strictly required.' });
    }
    const now = new Date().toISOString();

    // Update status to rejected
    const rejectUpdates = {
      status: 'REJECTED_BY_SUB_ADMIN',
      overallRegistrationStatus: 'REJECTED_BY_SUB_ADMIN',
      subAdminApprovalStatus: 'rejected',
      adminApprovalStatus: 'rejected',
      adminRejectionReason: rejectionReason,
      kycStatus: 'Rejected',
      rejectionReason,
      subAdminRejectedBy: req.user.name || req.user.email,
      subAdminRejectedById: req.user.id || req.user._id,
      subAdminRejectedByRole: req.user.role,
      subAdminRejectedAt: now,
      adminRejectedBy: req.user.name || req.user.email,
      adminRejectedById: req.user.id || req.user._id,
      adminRejectedByRole: req.user.role,
      adminRejectedAt: now,
      updatedAt: now
    };
    Object.assign(manager, rejectUpdates);

    await db.users.findByIdAndUpdate(manager._id || manager.id, rejectUpdates);
    if (db.managers) {
      await db.managers.findByIdAndUpdate(manager._id || manager.id, rejectUpdates).catch(() => {});
    }

    // Sync rejection to MongoDB Atlas managerrequests
    try {
      const mongoDb = await getMongoDb();
      if (mongoDb) {
        const { ObjectId } = require('mongodb');
        const mgrIdStr = String(manager._id || manager.id || manager.userId || '');
        const orClauses = [
          { userId: mgrIdStr },
          { email: (manager.email || '').toLowerCase().trim() }
        ];
        if (manager.requestId) orClauses.push({ requestId: manager.requestId });
        if (ObjectId.isValid(mgrIdStr)) orClauses.push({ _id: new ObjectId(mgrIdStr) });
        if (manager._id && typeof manager._id === 'object') orClauses.push({ _id: manager._id });

        await mongoDb.collection('users').updateMany({ $or: orClauses }, { $set: rejectUpdates }).catch(() => {});
        const updateResult = await mongoDb.collection('managerrequests').updateMany(
          { $or: orClauses },
          {
            $set: {
              status: 'Rejected',
              approvalStage: 'rejected',
              overallRegistrationStatus: 'REJECTED_BY_SUB_ADMIN',
              subAdminApprovalStatus: 'rejected',
              adminApprovalStatus: 'rejected',
              rejectionReason,
              adminRejectedBy: req.user.name || req.user.email,
              adminRejectedById: req.user.id || req.user._id,
              adminRejectedByRole: req.user.role,
              adminRejectedAt: now,
              updatedAt: now
            }
          }
        );

        if (updateResult.matchedCount === 0) {
          await mongoDb.collection('managerrequests').insertOne({
            requestId: manager.requestId || `REQ-MGR-${(manager.role||'pincode').substring(0,3).toUpperCase()}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(1000 + Math.random() * 9000))}`,
            name: manager.name,
            email: manager.email,
            phone: manager.mobile || manager.phone,
            altPhone: manager.altPhone || '',
            level: manager.level ? String(manager.level).replace('_manager', '') : (manager.role ? manager.role.replace('_manager', '') : 'pincode'),
            role: manager.role || 'pincode_manager',
            assignedState: manager.state || manager.assignedState || '',
            assignedDistrict: manager.district || manager.assignedDistrict || '',
            assignedDivision: manager.division || manager.assignedDivision || '',
            assignedPincode: manager.pincode || manager.assignedPincode || '',
            address: typeof manager.address === 'string' ? manager.address : (manager.address?.fullAddress || ''),
            userId: mgrIdStr,
            status: 'Rejected',
            approvalStage: 'rejected',
            overallRegistrationStatus: 'REJECTED_BY_SUB_ADMIN',
            subAdminApprovalStatus: 'rejected',
            rejectionReason,
            documents: manager.documents || {},
            createdAt: manager.createdAt || now,
            updatedAt: now
          });
        }
      }
    } catch (mReqErr) {
      console.error('[Sub-Admin] Error syncing managerrequests on reject:', mReqErr.message);
    }

    // Forward rejection details to KYC queue for review and closure
    if (db.kycRecords) {
      const mgrIdStr = String(manager._id || manager.id);
      const kycId = `KYC-MGR-${mgrIdStr}`;
      const existingKyc = await db.kycRecords.findOne({ $or: [{ _id: kycId }, { id: kycId }, { managerId: mgrIdStr }] });
      if (existingKyc) {
        await db.kycRecords.findByIdAndUpdate(existingKyc._id || existingKyc.id, {
          status: 'Pending',
          kycStatus: 'Pending Verification',
          notes: `Territory-rejected by ${req.user.role} "${req.user.name}". Reason: ${rejectionReason}`,
          updatedAt: now
        });
      } else {
        await db.kycRecords.insertOne({
          _id: kycId,
          id: kycId,
          type: 'Manager',
          managerId: mgrIdStr,
          name: manager.name,
          category: 'Operations Management',
          role: manager.role,
          phone: manager.mobile || manager.phone,
          email: manager.email,
          state: manager.state,
          district: manager.district,
          division: manager.division,
          pincode: manager.pincode,
          stateId: manager.stateId,
          districtId: manager.districtId,
          divisionId: manager.divisionId,
          pincodeId: manager.pincodeId,
          status: 'Pending',
          kycStatus: 'Pending Verification',
          submittedDate: formatSubmittedDate(manager.createdAt, now),
          documents: manager.documents || {},
          notes: `Territory-rejected by ${req.user.role} "${req.user.name}". Reason: ${rejectionReason}`,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // Audit log entry
    if (db.auditLogs) {
      await db.auditLogs.insertOne({
        action: 'MANAGER_REGISTRATION_REJECTED',
        adminId: req.user.id || req.user._id,
        adminName: req.user.name,
        adminRole: req.user.role,
        targetUserId: manager._id || manager.id,
        targetUserName: manager.name,
        targetUserRole: manager.role,
        details: `${manager.role.replace('_', ' ')} "${manager.name}" registration rejected by ${req.user.role} "${req.user.name}". Reason: ${rejectionReason}`,
        ip: req.ip || '127.0.0.1',
        timestamp: new Date().toISOString()
      }).catch(() => {});
    }

    const populated = await populateManager(manager, 'subordinate', req.user);

    return res.json({
      success: true,
      message: `Registration for ${manager.name} (${formatRoleTitle(manager.role)}) has been rejected.`,
      manager: populated
    });
  } catch (err) {
    console.error('Reject manager error:', err);
    res.status(500).json({ success: false, message: 'Failed to reject manager', error: err.message });
  }
};

// POST /api/managers/:id/pending - Keep manager registration pending with mandatory reason
const keepPendingManager = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const manager = await findManagerRecord(id);

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    if (!isRelatedAdminForManager(req.user, manager)) {
      const targetRole = getRelatedAdminRole(manager.role);
      const targetPlace = manager.pincode ? `Pincode ${manager.pincode}` : manager.division ? `${manager.division} Division` : manager.district ? `${manager.district} District` : `${manager.state || 'State'} Jurisdiction`;
      return res.status(403).json({
        success: false,
        message: `You do not have administrative authority to manage ${manager.name} (${formatRoleTitle(manager.role)}). Must be handled by designated ${targetRole} for ${targetPlace}.`
      });
    }

    const pendingReason = (reason || '').trim();
    if (!pendingReason) {
      return res.status(400).json({ success: false, message: 'A meaningful pending reason or administrative note is required.' });
    }

    const now = new Date().toISOString();
    const existingHistory = Array.isArray(manager.reviewHistory) ? manager.reviewHistory : [];
    const reviewEntry = {
      action: 'PENDING',
      status: 'pending',
      reason: pendingReason,
      reviewerId: req.user.id || req.user._id,
      reviewerName: req.user.name || req.user.email,
      reviewerRole: req.user.role,
      reviewedAt: now,
      timestamp: now
    };
    const updatedHistory = [...existingHistory, reviewEntry];

    const pendingUpdates = {
      status: 'PENDING_SUB_ADMIN_APPROVAL',
      adminApprovalStatus: 'pending',
      adminPendingReason: pendingReason,
      pendingReason,
      reviewerReason: pendingReason,
      adminNotes: pendingReason,
      adminPendingBy: req.user.name || req.user.email,
      adminPendingById: req.user.id || req.user._id,
      adminPendingByRole: req.user.role,
      adminPendingAt: now,
      reviewHistory: updatedHistory,
      updatedAt: now
    };
    Object.assign(manager, pendingUpdates);

    await db.users.findByIdAndUpdate(manager._id || manager.id, pendingUpdates);
    if (db.managers) {
      await db.managers.findByIdAndUpdate(manager._id || manager.id, pendingUpdates).catch(() => {});
    }

    // Sync pending reason & review history to MongoDB Atlas managerrequests for Main Admin
    try {
      const mongoDb = await getMongoDb();
      if (mongoDb) {
        const { ObjectId } = require('mongodb');
        const mgrIdStr = String(manager._id || manager.id || manager.userId || '');
        const orClauses = [
          { userId: mgrIdStr },
          { email: (manager.email || '').toLowerCase().trim() }
        ];
        if (manager.requestId) orClauses.push({ requestId: manager.requestId });
        if (ObjectId.isValid(mgrIdStr)) orClauses.push({ _id: new ObjectId(mgrIdStr) });
        if (manager._id && typeof manager._id === 'object') orClauses.push({ _id: manager._id });

        await mongoDb.collection('users').updateMany({ $or: orClauses }, { $set: pendingUpdates }).catch(() => {});
        const updateResult = await mongoDb.collection('managerrequests').updateMany(
          { $or: orClauses },
          {
            $set: {
              status: 'Pending',
              approvalStage: 'subadmin_pending',
              overallRegistrationStatus: 'PENDING_SUB_ADMIN_APPROVAL',
              subAdminApprovalStatus: 'pending',
              pendingReason,
              adminNotes: pendingReason,
              reviewerReason: pendingReason,
              reviewedBy: req.user.id || req.user._id,
              requestingAdminName: req.user.name || req.user.email,
              requestingAdminRole: req.user.role,
              reviewedAt: new Date(),
              updatedAt: now
            },
            $push: {
              reviewHistory: reviewEntry
            }
          }
        );

        if (updateResult.matchedCount === 0) {
          await mongoDb.collection('managerrequests').insertOne({
            requestId: manager.requestId || `REQ-MGR-${(manager.role||'pincode').substring(0,3).toUpperCase()}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(1000 + Math.random() * 9000))}`,
            name: manager.name,
            email: manager.email,
            phone: manager.mobile || manager.phone,
            altPhone: manager.altPhone || '',
            level: manager.level ? String(manager.level).replace('_manager', '') : (manager.role ? manager.role.replace('_manager', '') : 'pincode'),
            role: manager.role || 'pincode_manager',
            assignedState: manager.state || manager.assignedState || '',
            assignedDistrict: manager.district || manager.assignedDistrict || '',
            assignedDivision: manager.division || manager.assignedDivision || '',
            assignedPincode: manager.pincode || manager.assignedPincode || '',
            address: typeof manager.address === 'string' ? manager.address : (manager.address?.fullAddress || ''),
            userId: mgrIdStr,
            status: 'Pending',
            approvalStage: 'subadmin_pending',
            overallRegistrationStatus: 'PENDING_SUB_ADMIN_APPROVAL',
            subAdminApprovalStatus: 'pending',
            pendingReason,
            adminNotes: pendingReason,
            reviewerReason: pendingReason,
            reviewedBy: req.user.id || req.user._id,
            requestingAdminName: req.user.name || req.user.email,
            requestingAdminRole: req.user.role,
            reviewedAt: new Date(),
            reviewHistory: [reviewEntry],
            documents: manager.documents || {},
            createdAt: manager.createdAt || now,
            updatedAt: now
          });
        }
      }
    } catch (mReqErr) {
      console.error('[Sub-Admin] Error syncing managerrequests on keepPending:', mReqErr.message);
    }

    if (db.kycRecords) {
      const mgrIdStr = String(manager._id || manager.id);
      const kycId = `KYC-MGR-${mgrIdStr}`;
      const existingKyc = await db.kycRecords.findOne({ $or: [{ _id: kycId }, { id: kycId }, { managerId: mgrIdStr }] });
      if (existingKyc) {
        await db.kycRecords.findByIdAndUpdate(existingKyc._id || existingKyc.id, {
          notes: `Kept pending by ${req.user.role} "${req.user.name}". Reason: ${pendingReason}`,
          updatedAt: now
        });
      }
    }

    if (db.auditLogs) {
      await db.auditLogs.insertOne({
        action: 'MANAGER_REGISTRATION_KEPT_PENDING',
        adminId: req.user.id || req.user._id,
        adminName: req.user.name,
        adminRole: req.user.role,
        targetUserId: manager._id || manager.id,
        targetUserName: manager.name,
        targetUserRole: manager.role,
        details: `${manager.role.replace('_', ' ')} "${manager.name}" registration kept pending by ${req.user.role} "${req.user.name}". Reason: ${pendingReason}`,
        ip: req.ip || '127.0.0.1',
        timestamp: now
      }).catch(() => {});
    }

    const populated = await populateManager(manager, 'subordinate', req.user);

    return res.json({
      success: true,
      message: `Registration for ${manager.name} (${formatRoleTitle(manager.role)}) kept pending. Note saved.`,
      manager: populated
    });
  } catch (err) {
    console.error('Keep pending manager error:', err);
    res.status(500).json({ success: false, message: 'Failed to update manager pending status', error: err.message });
  }
};

const addManager = async (req, res) => {
  try {
    const {
      name,
      fullName,
      email,
      mobile,
      phone,
      password,
      role, // 'state_manager' | 'district_manager' | 'division_manager' | 'pincode_manager'
      dob,
      gender,
      address,
      doorStreet,
      area,
      city,
      district: homeDistrict,
      state: homeState,
      pincode: homePincode,
      aadharNumber,
      panNumber,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      assignedState,
      assignedDistrict,
      assignedDivision,
      assignedPincode,
      status, // 'active' | 'under_review'
      loginId
    } = req.body;

    const mgrName = formatCapitalizedName(name || fullName || '');
    const mgrEmail = (email || '').trim().toLowerCase();
    const mgrMobile = (mobile || phone || '').trim();
    const adminRoleLower = (req.user.role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
    const isSuperAdmin = adminRoleLower === 'super admin' || adminRoleLower.includes('super') || adminRoleLower === 'main admin' || adminRoleLower === 'admin';
    const isStateAdmin = !isSuperAdmin && adminRoleLower.includes('state') && !adminRoleLower.includes('manager');
    const isDistrictAdmin = !isSuperAdmin && adminRoleLower.includes('district') && !adminRoleLower.includes('manager');
    const isDivisionalAdmin = !isSuperAdmin && (adminRoleLower.includes('division') || adminRoleLower.includes('divisional')) && !adminRoleLower.includes('manager');
    const isPincodeAdmin = !isSuperAdmin && adminRoleLower.includes('pincode') && !adminRoleLower.includes('manager');

    // Strict Hierarchy-Based Manager Creation Permissions:
    // - State Admin can create State Managers ONLY.
    // - District Admin can create District Managers ONLY.
    // - Division Admin can create Divisional Managers ONLY.
    // - Pincode Admin can create Pincode Managers ONLY.
    // - Super Admin can create any manager role.
    const validRoles = ['state_manager', 'district_manager', 'division_manager', 'pincode_manager'];
    let mgrRole = (role || '').trim().toLowerCase().replace(/-/g, '_');
    if (mgrRole === 'divisional_manager') mgrRole = 'division_manager';
    if (!validRoles.includes(mgrRole)) {
      mgrRole = 'state_manager';
    }

    if (isStateAdmin) {
      if (mgrRole !== 'state_manager') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: State Admin can create State Managers only. District, Divisional, and Pincode Managers cannot be created by State Admin.'
        });
      }
    } else if (isDistrictAdmin) {
      if (mgrRole !== 'district_manager') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: District Admin can create District Managers only. State, Divisional, and Pincode Managers cannot be created by District Admin.'
        });
      }
    } else if (isDivisionalAdmin) {
      if (mgrRole !== 'division_manager') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Division Admin can create Divisional Managers only. State, District, and Pincode Managers cannot be created by Division Admin.'
        });
      }
    } else if (isPincodeAdmin) {
      if (mgrRole !== 'pincode_manager') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Pincode Admin can create Pincode Managers only. State, District, and Divisional Managers cannot be created by Pincode Admin.'
        });
      }
    } else if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only authorized administrators can add managers.'
      });
    }

    // Derive caller's authoritative territory from trusted database/token session data
    const trustedAdmin = (req.user.id || req.user._id)
      ? (Array.from(db.users || []).find(u => String(u._id || u.id) === String(req.user.id || req.user._id)) ||
         Array.from(db.admins || []).find(u => String(u._id || u.id) === String(req.user.id || req.user._id)) || req.user)
      : req.user;

    const adminState = trustedAdmin.state || req.user.state;
    const adminDistrict = trustedAdmin.district || req.user.district;
    const adminDivision = trustedAdmin.division || req.user.division;
    const adminPincode = trustedAdmin.pincode || req.user.pincode;

    // Validate territory hierarchy against administrator's authority
    if (isStateAdmin) {
      if (adminState && adminState.toLowerCase() !== 'all india') {
        if (assignedState && assignedState.trim().toLowerCase() !== adminState.trim().toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: `Forbidden: State Admin cannot create managers outside their authorized state (${adminState}).`
          });
        }
      }
    } else if (isDistrictAdmin) {
      if (adminState && assignedState && assignedState.trim().toLowerCase() !== adminState.trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: District Admin cannot create managers outside their authorized state (${adminState}).`
        });
      }
      if (adminDistrict && assignedDistrict && assignedDistrict.trim().toLowerCase() !== adminDistrict.trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: District Admin cannot create managers outside their authorized district (${adminDistrict}).`
        });
      }
    } else if (isDivisionalAdmin) {
      if (adminState && assignedState && assignedState.trim().toLowerCase() !== adminState.trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Division Admin cannot create managers outside their authorized state (${adminState}).`
        });
      }
      if (adminDistrict && assignedDistrict && assignedDistrict.trim().toLowerCase() !== adminDistrict.trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Division Admin cannot create managers outside their authorized district (${adminDistrict}).`
        });
      }
      if (adminDivision && assignedDivision && assignedDivision.trim().toLowerCase() !== adminDivision.trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Division Admin cannot create managers outside their authorized division (${adminDivision}).`
        });
      }
    } else if (isPincodeAdmin) {
      if (adminState && assignedState && assignedState.trim().toLowerCase() !== adminState.trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Pincode Admin cannot create managers outside their authorized state (${adminState}).`
        });
      }
      if (adminDistrict && assignedDistrict && assignedDistrict.trim().toLowerCase() !== adminDistrict.trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Pincode Admin cannot create managers outside their authorized district (${adminDistrict}).`
        });
      }
      if (adminDivision && assignedDivision && assignedDivision.trim().toLowerCase() !== adminDivision.trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Pincode Admin cannot create managers outside their authorized division (${adminDivision}).`
        });
      }
      if (adminPincode && assignedPincode && String(assignedPincode).trim() !== String(adminPincode).trim()) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Pincode Admin cannot create managers outside their authorized pincode (${adminPincode}).`
        });
      }
    }

    if (!mgrName) return res.status(400).json({ success: false, message: 'Manager name is required.' });
    if (!mgrEmail) return res.status(400).json({ success: false, message: 'Email address is required.' });
    if (!mgrMobile) return res.status(400).json({ success: false, message: 'Mobile number is required.' });

    const valErr = validateBankAndAddress(req.body, {
      requiresDistrict: ['district_manager', 'division_manager', 'pincode_manager'].includes(mgrRole),
      requiresDivision: ['division_manager', 'pincode_manager'].includes(mgrRole)
    });
    if (valErr) {
      return res.status(400).json({ success: false, message: valErr });
    }

    const kycErr = validateKycDocuments(req.body);
    if (kycErr) {
      return res.status(400).json({ success: false, message: kycErr });
    }

    // Check duplicate in users
    const allUsers = Array.from(db.users);
    const existing = allUsers.find(u => 
      (u.email && u.email.toLowerCase() === mgrEmail) ||
      (u.mobile && String(u.mobile).trim() === String(mgrMobile).trim()) ||
      (u.phone && String(u.phone).trim() === String(mgrMobile).trim()) ||
      (loginId && u.loginId && u.loginId.toLowerCase() === loginId.trim().toLowerCase())
    );
    if (existing) {
      return res.status(400).json({ success: false, message: 'A user with this email or mobile number already exists.' });
    }

    // Auto-align location to administrator jurisdiction and role requirements
    let state = (assignedState || homeState || adminState || 'Tamil Nadu').trim();
    let stateId = req.body.assignedStateId || req.body.stateId || null;
    let district = (assignedDistrict || homeDistrict || '').trim() || null;
    let districtId = req.body.assignedDistrictId || req.body.districtId || null;
    let division = (assignedDivision || '').trim() || null;
    let divisionId = req.body.assignedDivisionId || req.body.divisionId || null;
    let pincode = (assignedPincode || homePincode || '').trim() || null;
    let pincodeId = req.body.assignedPincodeId || req.body.pincodeId || null;

    if (isStateAdmin && adminState && adminState.toLowerCase() !== 'all india') {
      state = adminState;
      stateId = trustedAdmin.stateId || req.user.stateId || stateId;
    } else if (isDistrictAdmin) {
      state = adminState || state;
      stateId = trustedAdmin.stateId || req.user.stateId || stateId;
      district = adminDistrict || district;
      districtId = trustedAdmin.districtId || req.user.districtId || districtId;
    } else if (isDivisionalAdmin) {
      state = adminState || state;
      stateId = trustedAdmin.stateId || req.user.stateId || stateId;
      district = adminDistrict || district;
      districtId = trustedAdmin.districtId || req.user.districtId || districtId;
      division = adminDivision || division;
      divisionId = trustedAdmin.divisionId || req.user.divisionId || divisionId;
    } else if (isPincodeAdmin) {
      state = adminState || state;
      stateId = trustedAdmin.stateId || req.user.stateId || stateId;
      district = adminDistrict || district;
      districtId = trustedAdmin.districtId || req.user.districtId || districtId;
      division = adminDivision || division;
      divisionId = trustedAdmin.divisionId || req.user.divisionId || divisionId;
      pincode = adminPincode || pincode;
      pincodeId = trustedAdmin.pincodeId || req.user.pincodeId || pincodeId;
    }

    // Role-specific territory validation (compatible parent-child relationships)
    if (mgrRole === 'state_manager') {
      if (!state) return res.status(400).json({ success: false, message: 'State is required for State Manager.' });
      district = null;
      districtId = null;
      division = null;
      divisionId = null;
      pincode = null;
      pincodeId = null;
    } else if (mgrRole === 'district_manager') {
      if (!state) return res.status(400).json({ success: false, message: 'State is required.' });
      if (!district) return res.status(400).json({ success: false, message: 'District is required for District Manager.' });
      division = null;
      divisionId = null;
      pincode = null;
      pincodeId = null;
    } else if (mgrRole === 'division_manager') {
      if (!state) return res.status(400).json({ success: false, message: 'State is required.' });
      if (!district) return res.status(400).json({ success: false, message: 'District is required.' });
      if (!division) return res.status(400).json({ success: false, message: 'Division is required for Divisional Manager.' });
      pincode = null;
      pincodeId = null;
    } else if (mgrRole === 'pincode_manager') {
      if (!state) return res.status(400).json({ success: false, message: 'State is required.' });
      if (!district) return res.status(400).json({ success: false, message: 'District is required.' });
      if (!division) return res.status(400).json({ success: false, message: 'Division is required.' });
      if (!pincode) return res.status(400).json({ success: false, message: 'Pincode is required for Pincode Manager.' });
    }

    // Resolve territory objects and IDs from database
    let stateDoc = null;
    if (stateId) {
      stateDoc = Array.from(db.states || []).find(s => String(s._id || s.id || s.stateId) === String(stateId));
      if (stateDoc) state = stateDoc.name;
    }
    if (!stateDoc && state) {
      stateDoc = Array.from(db.states || []).find(s => s.name?.toLowerCase() === state.toLowerCase());
      if (stateDoc) stateId = String(stateDoc._id || stateDoc.id || stateDoc.stateId);
    }
    if (!stateId && state) {
      stateId = `state_${state.toLowerCase().replace(/\s+/g, '_')}`;
    }

    let distDoc = null;
    if (districtId) {
      distDoc = Array.from(db.districts || []).find(d => String(d._id || d.id || d.districtId) === String(districtId));
      if (distDoc) district = distDoc.name;
    }
    if (!distDoc && district) {
      distDoc = Array.from(db.districts || []).find(d => 
        d.name?.toLowerCase() === district.toLowerCase() &&
        (!stateId || !d.stateId || String(d.stateId) === String(stateId))
      );
      if (distDoc) districtId = String(distDoc._id || distDoc.id || distDoc.districtId);
    }
    if (!districtId && district) {
      districtId = `dist_${district.toLowerCase().replace(/\s+/g, '_')}`;
    }

    // Role + Territory parent-child compatibility validation
    if (mgrRole === 'district_manager' || mgrRole === 'division_manager' || mgrRole === 'pincode_manager') {
      if (distDoc && stateId && distDoc.stateId && String(distDoc.stateId) !== String(stateId)) {
        return res.status(400).json({ success: false, message: `District "${district}" does not belong to the selected State.` });
      }
    }

    let divDoc = null;
    if (divisionId) {
      divDoc = Array.from(db.divisions || []).find(v => String(v._id || v.id || v.divisionId) === String(divisionId));
      if (divDoc) division = divDoc.name;
    }
    if (!divDoc && division) {
      divDoc = Array.from(db.divisions || []).find(v => 
        v.name?.toLowerCase() === division.toLowerCase() &&
        (!districtId || !v.districtId || String(v.districtId) === String(districtId))
      );
      if (divDoc) divisionId = String(divDoc._id || divDoc.id || divDoc.divisionId);
    }
    if (!divisionId && division) {
      divisionId = `div_${division.toLowerCase().replace(/\s+/g, '_')}`;
    }

    if (mgrRole === 'division_manager' || mgrRole === 'pincode_manager') {
      if (divDoc && districtId && divDoc.districtId && String(divDoc.districtId) !== String(districtId)) {
        return res.status(400).json({ success: false, message: `Division "${division}" does not belong to the selected District.` });
      }
    }

    let pinDoc = null;
    if (pincodeId) {
      pinDoc = Array.from(db.pincodes || []).find(p => String(p._id || p.id || p.pincodeId) === String(pincodeId));
      if (pinDoc) pincode = String(pinDoc.code || pinDoc.pincode);
    }
    if (!pinDoc && pincode) {
      pinDoc = Array.from(db.pincodes || []).find(p => 
        String(p.code || p.pincode).trim() === String(pincode).trim() &&
        (!divisionId || !p.divisionId || String(p.divisionId) === String(divisionId))
      );
      if (pinDoc) pincodeId = String(pinDoc._id || pinDoc.id || pinDoc.pincodeId);
    }
    if (!pincodeId && pincode) {
      pincodeId = `pin_${pincode}`;
    }

    if (mgrRole === 'pincode_manager') {
      if (pinDoc && divisionId && pinDoc.divisionId && String(pinDoc.divisionId) !== String(divisionId)) {
        return res.status(400).json({ success: false, message: `Pincode "${pincode}" does not belong to the selected Division.` });
      }
    }

    const mgrPassword = password || req.body.password || 'Password@123';
    const passwordHash = await bcrypt.hash(mgrPassword, 10);
    const now = new Date().toISOString();
    const level = mgrRole === 'state_manager' ? 1 
                : mgrRole === 'district_manager' ? 2 
                : mgrRole === 'division_manager' ? 3 
                : 4;

    const newId = `usr_mgr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const targetJurisdiction = pincode ? `PIN: ${pincode}` 
      : division ? `${division} Division` 
      : district ? `${district} District` 
      : `${state} Jurisdiction`;

    const rolePrefix = mgrRole === 'state_manager' ? 'STM' : mgrRole === 'district_manager' ? 'DTM' : mgrRole === 'division_manager' ? 'DIV' : 'PIN';
    const managerId = req.body.managerId || (`MGR-${rolePrefix}-${Date.now().toString().slice(-6)}`);

    const aadharDocUrl = req.body.aadharUrl || req.body.aadharPhoto || req.body.documents?.aadharUrl || req.body.documents?.aadhaarUrl || null;
    const aadharFileName = req.body.aadharFileName || (aadharDocUrl ? 'Aadhaar_Document' : null);

    const panDocUrl = req.body.panUrl || req.body.panPhoto || req.body.documents?.panUrl || null;
    const panFileName = req.body.panFileName || (panDocUrl ? 'PAN_Document' : null);

    const bankDocUrl = req.body.bankPassbookUrl || req.body.bankUrl || req.body.bankPhoto || req.body.documents?.bankPassbookUrl || req.body.documents?.bankUrl || null;
    const bankFileName = req.body.bankPassbookFileName || req.body.bankFileName || (bankDocUrl ? 'Bank_Passbook' : null);

    const cancelledChequeDocUrl = req.body.cancelledChequeUrl || req.body.cancelledCheque || req.body.cancelledChequePhoto || req.body.documents?.cancelledChequeUrl || null;
    const cancelledChequeFileName = req.body.cancelledChequeFileName || (cancelledChequeDocUrl ? 'Cancelled_Cheque' : null);

    const signatureDocUrl = req.body.signatureUrl || req.body.signaturePhoto || req.body.documents?.signatureUrl || null;
    const signatureFileName = req.body.signatureFileName || (signatureDocUrl ? 'Digital_Signature' : null);

    const passportDocUrl = req.body.passportUrl || req.body.passportPhoto || req.body.documents?.passportUrl || null;
    const aadharClean = (aadharNumber || req.body.aadharNumber || '').toString().trim().replace(/\s+/g, '');
    const panClean = (panNumber || req.body.panNumber || '').toString().trim().toUpperCase();

    // Strict mandatory validation for Manager Onboarding (all 7 identity & official documents required)
    if (!aadharClean) return res.status(400).json({ success: false, message: 'Aadhaar Card Number is required.' });
    if (!/^\d{12}$/.test(aadharClean)) return res.status(400).json({ success: false, message: 'Aadhaar Card Number must be exactly 12 numeric digits.' });
    if (!aadharDocUrl) return res.status(400).json({ success: false, message: 'Aadhaar Card Document upload is mandatory.' });

    if (!panClean) return res.status(400).json({ success: false, message: 'PAN Card Number is required.' });
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panClean)) return res.status(400).json({ success: false, message: 'PAN Card Number must be valid format (e.g. ABCDE1234F).' });
    if (!panDocUrl) return res.status(400).json({ success: false, message: 'PAN Card Document upload is mandatory.' });

    if (!bankDocUrl) return res.status(400).json({ success: false, message: 'Bank Passbook / Bank Account Document upload is mandatory.' });
    if (!cancelledChequeDocUrl) return res.status(400).json({ success: false, message: 'Cancelled Cheque document upload is mandatory.' });
    if (!signatureDocUrl) return res.status(400).json({ success: false, message: 'Digital Signature upload is mandatory.' });

    const newManager = {
      _id: newId,
      id: newId,
      managerId,
      name: mgrName,
      email: mgrEmail,
      mobile: mgrMobile,
      phone: mgrMobile,
      loginId: loginId || mgrEmail,
      passwordHash,
      role: mgrRole,
      level,
      status: 'PENDING_KYC_APPROVAL',
      isActive: false,
      requiresApproval: true,
      isFullyApproved: false,
      registrationType: 'admin',
      adminApprovalStatus: 'approved',
      adminApprovedBy: req.user.name || req.user.email,
      adminApprovedById: req.user.id || req.user._id,
      adminApprovedByRole: req.user.role,
      adminApprovedAt: now,
      kycStatus: 'pending_verification',
      state,
      stateId: stateId || null,
      assignedState: state,
      assignedStateId: stateId || null,
      district: district || null,
      districtId: districtId || null,
      assignedDistrict: district || null,
      assignedDistrictId: districtId || null,
      division: division || null,
      divisionId: divisionId || null,
      assignedDivision: division || null,
      assignedDivisionId: divisionId || null,
      pincode: pincode || null,
      pincodeId: pincodeId || null,
      assignedPincode: pincode || null,
      assignedPincodeId: pincodeId || null,
      targetJurisdiction,
      targetAdminRole: req.user.role,
      targetAdminId: req.user.id || req.user._id,
      targetAdminName: req.user.name,
      dob: dob || null,
      gender: gender || null,
      address: address || doorStreet || `${area || ''} ${city || ''}`.trim() || null,
      aadharNumber: aadharClean || null,
      panNumber: panClean || null,
      aadharPhoto: aadharDocUrl,
      panPhoto: panDocUrl,
      bankPassbookPhoto: bankDocUrl,
      cancelledChequePhoto: cancelledChequeDocUrl,
      signaturePhoto: signatureDocUrl,
      bankDetails: {
        accountHolderName: accountHolderName || mgrName,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        ifscCode: ifscCode || null,
        branchName: branchName || null
      },
      documents: {
        aadharNumber: aadharClean || null,
        panNumber: panClean || null,
        aadharUrl: aadharDocUrl,
        aadharFileName,
        panUrl: panDocUrl,
        panFileName,
        bankUrl: bankDocUrl,
        bankPassbookUrl: bankDocUrl,
        bankFileName,
        bankPassbookFileName: bankFileName,
        cancelledChequeUrl: cancelledChequeDocUrl,
        cancelledChequeFileName,
        signatureUrl: signatureDocUrl,
        signatureFileName,
        passportUrl: passportDocUrl,
        passportFileName: req.body.passportFileName || (passportDocUrl ? 'Passport_Document' : null)
      },
      kycDocs: {
        aadhaarFront: { url: aadharDocUrl, name: aadharFileName },
        panCard: { url: panDocUrl, name: panFileName },
        bankPassbook: { url: bankDocUrl, name: bankFileName },
        cancelledCheque: { url: cancelledChequeDocUrl, name: cancelledChequeFileName },
        signature: { url: signatureDocUrl, name: signatureFileName },
        passport: { url: passportDocUrl, name: req.body.passportFileName || 'Passport_Document' }
      },
      createdByAdmin: req.user.name || req.user.email,
      createdById: req.user.id || req.user._id,
      createdByRole: req.user.role,
      createdAt: now,
      updatedAt: now
    };

    await db.users.insertOne(newManager);
    if (db.managers) {
      await db.managers.insertOne(newManager).catch(() => {});
    }

    // Queue in db.kycRecords for KYC team verification
    if (db.kycRecords) {
      const mgrIdStr = String(newManager._id || newManager.id);
      const kycId = `KYC-MGR-${mgrIdStr}`;
      await db.kycRecords.insertOne({
        _id: kycId,
        id: kycId,
        type: 'Manager',
        managerId: mgrIdStr,
        name: newManager.name,
        category: 'Operations Management',
        role: newManager.role,
        phone: newManager.mobile || newManager.phone,
        email: newManager.email,
        state: newManager.state,
        district: newManager.district,
        division: newManager.division,
        pincode: newManager.pincode,
        stateId: newManager.stateId,
        districtId: newManager.districtId,
        divisionId: newManager.divisionId,
        pincodeId: newManager.pincodeId,
        status: 'Pending',
        kycStatus: 'Pending Verification',
        submittedDate: formatSubmittedDate(now),
        documents: newManager.documents || {},
        notes: `Registered and territory-approved by ${req.user.role} "${req.user.name}". Forwarded to KYC Team for verification.`,
        createdAt: now,
        updatedAt: now
      }).catch(() => {});
    }

    // Audit log
    await db.auditLogs.insertOne({
      action: 'MANAGER_CREATED',
      adminId: req.user.id || req.user._id,
      adminName: req.user.name,
      adminRole: req.user.role,
      targetUserId: newManager._id,
      targetUserName: newManager.name,
      targetUserRole: newManager.role,
      details: `${formatRoleTitle(newManager.role)} "${newManager.name}" registered and territory-approved by ${req.user.role} "${req.user.name}". Forwarded to KYC Team review.`,
      ip: req.ip || '127.0.0.1',
      timestamp: now
    });

    const populated = await populateManager(newManager, 'subordinate', req.user);

    return res.json({
      success: true,
      message: `${formatRoleTitle(newManager.role)} "${newManager.name}" registered successfully. Territory approved and forwarded to KYC review.`,
      manager: populated
    });
  } catch (err) {
    console.error('Add manager error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add manager', error: err.message });
  }
};

// PATCH /api/managers/:id/documents - Update/replace manager identity & official documents
const updateManagerDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const allUsers = Array.from(db.users);
    const manager = allUsers.find(u => String(u._id || u.id) === String(id));

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    if (!canAdminManage(req.user, manager)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this manager.' });
    }

    const {
      aadharNumber,
      aadharUrl,
      aadharFileName,
      panNumber,
      panUrl,
      panFileName,
      bankUrl,
      bankPassbookUrl,
      bankFileName,
      bankPassbookFileName,
      cancelledChequeUrl,
      cancelledChequeFileName,
      signatureUrl,
      signatureFileName
    } = req.body;

    const updatedFields = {};
    const updatedDocKeys = [];

    // Aadhaar number / doc
    if (aadharNumber !== undefined) {
      const cleanAadhaar = String(aadharNumber).trim().replace(/\s+/g, '');
      if (cleanAadhaar && !/^\d{12}$/.test(cleanAadhaar)) {
        return res.status(400).json({ success: false, message: 'Aadhaar Number must be exactly 12 digits.' });
      }
      updatedFields.aadharNumber = cleanAadhaar;
      updatedDocKeys.push('Aadhaar Number');
    }
    const finalAadharUrl = aadharUrl || req.body.aadharPhoto;
    if (finalAadharUrl !== undefined) {
      updatedFields.aadharPhoto = finalAadharUrl;
      updatedDocKeys.push('Aadhaar Document');
    }

    // PAN number / doc
    if (panNumber !== undefined) {
      const cleanPan = String(panNumber).trim().toUpperCase();
      if (cleanPan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        return res.status(400).json({ success: false, message: 'PAN Number must be valid format (e.g. ABCDE1234F).' });
      }
      updatedFields.panNumber = cleanPan;
      updatedDocKeys.push('PAN Number');
    }
    const finalPanUrl = panUrl || req.body.panPhoto;
    if (finalPanUrl !== undefined) {
      updatedFields.panPhoto = finalPanUrl;
      updatedDocKeys.push('PAN Document');
    }

    // Bank passbook doc
    const finalBankUrl = bankPassbookUrl || bankUrl || req.body.bankPassbookPhoto;
    if (finalBankUrl !== undefined) {
      updatedFields.bankPassbookPhoto = finalBankUrl;
      updatedDocKeys.push('Bank Passbook');
    }

    // Cancelled Cheque doc
    const finalChequeUrl = cancelledChequeUrl || req.body.cancelledChequePhoto;
    if (finalChequeUrl !== undefined) {
      updatedFields.cancelledChequePhoto = finalChequeUrl;
      updatedDocKeys.push('Cancelled Cheque');
    }

    // Digital signature doc
    const finalSigUrl = signatureUrl || req.body.signaturePhoto;
    if (finalSigUrl !== undefined) {
      updatedFields.signaturePhoto = finalSigUrl;
      updatedDocKeys.push('Digital Signature');
    }

    // Merge into documents and kycDocs sub-objects so existing data is preserved
    const currentDocs = manager.documents || {};
    const currentKycDocs = manager.kycDocs || {};

    const newDocuments = {
      ...currentDocs,
      ...(updatedFields.aadharNumber !== undefined ? { aadharNumber: updatedFields.aadharNumber } : {}),
      ...(updatedFields.panNumber !== undefined ? { panNumber: updatedFields.panNumber } : {}),
      ...(finalAadharUrl !== undefined ? { aadharUrl: finalAadharUrl, aadharFileName: aadharFileName || currentDocs.aadharFileName || 'Aadhaar_Document' } : {}),
      ...(finalPanUrl !== undefined ? { panUrl: finalPanUrl, panFileName: panFileName || currentDocs.panFileName || 'PAN_Document' } : {}),
      ...(finalBankUrl !== undefined ? { bankUrl: finalBankUrl, bankPassbookUrl: finalBankUrl, bankFileName: bankPassbookFileName || bankFileName || currentDocs.bankPassbookFileName || currentDocs.bankFileName || 'Bank_Passbook' } : {}),
      ...(finalChequeUrl !== undefined ? { cancelledChequeUrl: finalChequeUrl, cancelledChequeFileName: cancelledChequeFileName || currentDocs.cancelledChequeFileName || 'Cancelled_Cheque' } : {}),
      ...(finalSigUrl !== undefined ? { signatureUrl: finalSigUrl, signatureFileName: signatureFileName || currentDocs.signatureFileName || 'Digital_Signature' } : {})
    };

    const newKycDocs = {
      ...currentKycDocs,
      ...(finalAadharUrl !== undefined ? { aadhaarFront: { url: finalAadharUrl, name: aadharFileName || currentKycDocs.aadhaarFront?.name || 'Aadhaar_Document' } } : {}),
      ...(finalPanUrl !== undefined ? { panCard: { url: finalPanUrl, name: panFileName || currentKycDocs.panCard?.name || 'PAN_Document' } } : {}),
      ...(finalBankUrl !== undefined ? { bankPassbook: { url: finalBankUrl, name: bankPassbookFileName || bankFileName || currentKycDocs.bankPassbook?.name || 'Bank_Passbook' } } : {}),
      ...(finalChequeUrl !== undefined ? { cancelledCheque: { url: finalChequeUrl, name: cancelledChequeFileName || currentKycDocs.cancelledCheque?.name || 'Cancelled_Cheque' } } : {}),
      ...(finalSigUrl !== undefined ? { signature: { url: finalSigUrl, name: signatureFileName || currentKycDocs.signature?.name || 'Digital_Signature' } } : {})
    };

    const now = new Date().toISOString();
    const updatePayload = {
      ...updatedFields,
      documents: newDocuments,
      kycDocs: newKycDocs,
      updatedAt: now
    };

    Object.assign(manager, updatePayload);

    await db.users.findByIdAndUpdate(manager._id || manager.id, updatePayload);
    if (db.managers) {
      await db.managers.findByIdAndUpdate(manager._id || manager.id, updatePayload).catch(() => {});
    }

    // Audit log
    await db.auditLogs.insertOne({
      action: 'MANAGER_DOCUMENT_UPDATED',
      adminId: req.user.id || req.user._id,
      adminName: req.user.name,
      adminRole: req.user.role,
      targetUserId: manager._id || manager.id,
      targetUserName: manager.name,
      targetUserRole: manager.role,
      details: `Document(s) updated for manager "${manager.name}": ${updatedDocKeys.join(', ')} by ${req.user.role} "${req.user.name}".`,
      ip: req.ip || '127.0.0.1',
      timestamp: now
    });

    const populated = await populateManager(manager, 'subordinate', req.user);

    return res.json({
      success: true,
      message: 'Manager document(s) updated successfully.',
      manager: populated
    });
  } catch (err) {
    console.error('Update manager documents error:', err);
    res.status(500).json({ success: false, message: 'Failed to update manager documents', error: err.message });
  }
};

// PATCH /api/managers/:id/status - Suspend, activate, or soft-delete a manager account
const updateManagerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, status, reason } = req.body;

    const manager = await findManagerRecord(id);
    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager record not found' });
    }

    // Territorial authorization check
    if (!canAdminManage(req.user, manager)) {
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_TERRITORY',
        message: 'Forbidden: You do not have territory authorization to manage this manager account.'
      });
    }

    let targetStatus = '';
    const norm = String(action || status || '').toLowerCase().trim();
    if (norm === 'suspend' || norm === 'suspended') {
      targetStatus = 'Suspended';
    } else if (norm === 'activate' || norm === 'active') {
      targetStatus = 'Active';
    } else if (norm === 'delete' || norm === 'deleted') {
      targetStatus = 'Deleted';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be suspend, activate, or delete.' });
    }

    // For activate: Ensure manager was approved/active previously and not bypassing unapproved KYC or registration
    if (targetStatus === 'Active') {
      const currentAdm = String(manager.adminApprovalStatus || '').toLowerCase();
      if (currentAdm === 'rejected') {
        return res.status(400).json({ success: false, message: 'Cannot activate an account that has been rejected during registration.' });
      }
    }

    const now = new Date().toISOString();
    const oldStatus = manager.status || 'Active';
    const isDeleted = targetStatus === 'Deleted';
    const isActive = targetStatus === 'Active';

    const updates = {
      status: targetStatus,
      isActive,
      updatedAt: now
    };

    if (isDeleted) {
      updates.isDeleted = true;
      updates.deletedAt = now;
      updates.deletedBy = req.user.name || req.user.email;
      updates.deletedById = req.user.id || req.user._id;
      updates.deletedByRole = req.user.role;
      if (reason) updates.deleteReason = reason;
    } else if (targetStatus === 'Suspended') {
      updates.isSuspended = true;
      updates.suspendedAt = now;
      updates.suspendedBy = req.user.name || req.user.email;
      updates.suspendedById = req.user.id || req.user._id;
      updates.suspendedByRole = req.user.role;
      if (reason) updates.suspendReason = reason;
    } else if (targetStatus === 'Active') {
      updates.isSuspended = false;
      updates.isDeleted = false;
      updates.activatedAt = now;
      updates.activatedBy = req.user.name || req.user.email;
      updates.activatedById = req.user.id || req.user._id;
      updates.activatedByRole = req.user.role;
    }

    // Update in-memory db.users and db.managers
    const mgrIdStr = String(manager._id || manager.id || manager.userId || '');
    if (db.users) {
      const u = Array.from(db.users).find(x => String(x._id || x.id) === mgrIdStr || (manager.email && x.email && x.email.toLowerCase() === manager.email.toLowerCase()));
      if (u) Object.assign(u, updates);
    }
    if (db.managers) {
      const m = Array.from(db.managers).find(x => String(x._id || x.id) === mgrIdStr || (manager.email && x.email && x.email.toLowerCase() === manager.email.toLowerCase()));
      if (m) Object.assign(m, updates);
    }

    // Update MongoDB Atlas users & managerrequests collections
    try {
      const mongoDb = await getMongoDb();
      if (mongoDb) {
        const { ObjectId } = require('mongodb');
        const filter = {
          $or: [
            { userId: mgrIdStr },
            { id: mgrIdStr },
            { email: (manager.email || '').toLowerCase() }
          ]
        };
        if (ObjectId.isValid(mgrIdStr)) {
          filter.$or.unshift({ _id: new ObjectId(mgrIdStr) });
        }
        await mongoDb.collection('users').updateMany(filter, { $set: updates });
        await mongoDb.collection('managerrequests').updateMany(filter, { $set: updates });
      }
    } catch (mErr) {
      console.warn('MongoDB Atlas update in updateManagerStatus warning:', mErr.message);
    }

    // Audit log
    if (db.auditLogs) {
      await db.auditLogs.insertOne({
        id: `AUD-${Date.now()}`,
        userId: req.user.id || req.user._id,
        userName: req.user.name || req.user.email,
        userRole: req.user.role,
        action: `MANAGER_${targetStatus.toUpperCase()}`,
        module: 'Managers',
        details: `${req.user.role} "${req.user.name || req.user.email}" transitioned manager "${manager.name}" status from "${oldStatus}" to "${targetStatus}". Reason: ${reason || 'N/A'}.`,
        ip: req.ip || '127.0.0.1',
        timestamp: now
      }).catch(() => {});
    }

    return res.json({
      success: true,
      message: `Manager account successfully updated to ${targetStatus}.`,
      manager: { ...manager, ...updates }
    });
  } catch (error) {
    console.error('Failed to update manager status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update manager status', error: error.message });
  }
};

module.exports = {
  getLowerLevelManagers,
  getManagerRequests,
  getManagerById,
  approveManager,
  rejectManager,
  keepPendingManager,
  addManager,
  updateManagerDocuments,
  updateManagerStatus,
  isRelatedAdminForManager,
  canAdminManage
};
