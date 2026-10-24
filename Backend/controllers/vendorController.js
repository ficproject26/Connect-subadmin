const { db, filterByLocation, resolveStateFromDistrict } = require('../config/db');
const { resolvePincodeHierarchy } = require('../utils/pincodeMapping');
const { resolveResponsibleAdmin, isUserAuthorizedForVendor } = require('../utils/adminResolver');
const { getScopeFilter, isVendorInScope } = require('../middleware/scopeMiddleware');
const notificationService = require('../services/notificationService');
const bcrypt = require('bcryptjs');
const { getMongoDb } = require('../config/mongo');
const { isFullyOnboardedVendor } = require('../utils/vendorOnboardingHelper');

// Mask sensitive identifiers for public / lower view
const maskPan = (pan) => {
  if (!pan || pan.length < 5) return pan;
  return 'XXXXX' + pan.slice(5);
};

const maskAccount = (acc) => {
  if (!acc || acc.length < 4) return acc;
  const visible = acc.slice(-4);
  return '••••'.repeat(Math.max(0, Math.floor((acc.length - 4) / 4))) + visible;
};

const maskGst = (gst) => {
  if (!gst || gst.length < 6) return gst;
  const stateCode = gst.slice(0, 2);
  const endCode = gst.slice(-3);
  return `${stateCode}••••••••••${endCode}`;
};

// Helper to format role titles cleanly and normalize legacy values
function formatActorRole(role, fallbackType = 'Manager') {
  if (!role) {
    if (fallbackType === 'Agent') return 'Pincode Agent';
    if (fallbackType === 'Admin') return 'Pincode Admin';
    return 'Pincode Manager';
  }
  const r = String(role).toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();

  // Explicit Manager roles
  if (r.includes('pincode') && r.includes('manager')) return 'Pincode Manager';
  if ((r.includes('divis') || r.includes('division')) && r.includes('manager')) return 'Divisional Manager';
  if ((r.includes('dist') || r.includes('district')) && r.includes('manager')) return 'District Manager';
  if (r.includes('state') && r.includes('manager')) return 'State Manager';
  if (r === 'manager' || r === 'field manager') return 'Field Manager';

  // Explicit Agent roles
  if (r.includes('pincode') && r.includes('agent')) return 'Pincode Agent';
  if ((r.includes('divis') || r.includes('division')) && r.includes('agent')) return 'Divisional Agent';
  if ((r.includes('dist') || r.includes('district')) && r.includes('agent')) return 'District Agent';
  if (r.includes('state') && r.includes('agent')) return 'State Agent';

  // Explicit Admin roles
  if (r.includes('pincode') && r.includes('admin')) return 'Pincode Admin';
  if ((r.includes('divis') || r.includes('division')) && r.includes('admin')) return 'Divisional Admin';
  if ((r.includes('dist') || r.includes('district')) && r.includes('admin')) return 'District Admin';
  if (r.includes('state') && r.includes('admin')) return 'State Admin';
  if (r.includes('super') && r.includes('admin')) return 'Super Admin';

  // Shorthand / tier-only normalization (e.g. "pincode", "pin code", "PincodeAgent", "district", "division", "state")
  if (r.includes('pincode') || r === 'pin' || r === 'pin code' || r.includes('pincodeagent')) {
    if (fallbackType === 'Manager' || r.includes('mgr')) return 'Pincode Manager';
    if (fallbackType === 'Admin') return 'Pincode Admin';
    return 'Pincode Agent';
  }
  if (r.includes('divis') || r.includes('division') || r.includes('divisionalagent')) {
    if (fallbackType === 'Manager' || r.includes('mgr')) return 'Divisional Manager';
    if (fallbackType === 'Admin') return 'Divisional Admin';
    return 'Divisional Agent';
  }
  if (r.includes('dist') || r.includes('district') || r.includes('districtagent')) {
    if (fallbackType === 'Manager' || r.includes('mgr')) return 'District Manager';
    if (fallbackType === 'Admin') return 'District Admin';
    return 'District Agent';
  }
  if (r.includes('state') || r.includes('stateagent')) {
    if (fallbackType === 'Manager' || r.includes('mgr')) return 'State Manager';
    if (fallbackType === 'Admin') return 'State Admin';
    return 'State Agent';
  }

  if (r.includes('agent')) return 'Pincode Agent';
  if (r.includes('admin')) return 'Sub Admin';
  if (r.includes('manager')) return 'Field Manager';

  return fallbackType === 'Agent' ? 'Pincode Agent' : 'Field Manager';
}

// Pre-index collections for ultra-fast O(1) enrichment of vendors
function buildVendorLookupContext() {
  const stateIdMap = new Map();
  const stateNameMap = new Map();
  for (const s of (db.states || [])) {
    if (s._id) stateIdMap.set(String(s._id), s);
    if (s.id) stateIdMap.set(String(s.id), s);
    if (s.name) stateNameMap.set(String(s.name).trim().toLowerCase(), s);
  }

  const districtIdMap = new Map();
  const districtNameMap = new Map();
  for (const d of (db.districts || [])) {
    if (d._id) districtIdMap.set(String(d._id), d);
    if (d.id) districtIdMap.set(String(d.id), d);
    if (d.name) districtNameMap.set(String(d.name).trim().toLowerCase(), d);
  }

  const divisionIdMap = new Map();
  const divisionNameMap = new Map();
  for (const dv of (db.divisions || [])) {
    if (dv._id) divisionIdMap.set(String(dv._id), dv);
    if (dv.id) divisionIdMap.set(String(dv.id), dv);
    if (dv.name) divisionNameMap.set(String(dv.name).trim().toLowerCase(), dv);
  }

  const pincodeIdMap = new Map();
  const pincodeCodeMap = new Map();
  for (const p of (db.pincodes || [])) {
    if (p._id) pincodeIdMap.set(String(p._id), p);
    if (p.id) pincodeIdMap.set(String(p.id), p);
    if (p.code) pincodeCodeMap.set(String(p.code).trim(), p);
  }

  const userMap = new Map();
  for (const u of (db.users || [])) {
    if (u._id) userMap.set(String(u._id).toLowerCase(), u);
    if (u.id) userMap.set(String(u.id).toLowerCase(), u);
    if (u.loginId) userMap.set(String(u.loginId).toLowerCase(), u);
    if (u.email) userMap.set(String(u.email).toLowerCase(), u);
  }
  for (const m of (db.managers || [])) {
    if (m._id) userMap.set(String(m._id).toLowerCase(), m);
    if (m.id) userMap.set(String(m.id).toLowerCase(), m);
    if (m.employeeCode) userMap.set(String(m.employeeCode).toLowerCase(), m);
  }

  const agentMap = new Map();
  for (const a of (db.agents || [])) {
    if (a._id) agentMap.set(String(a._id).toLowerCase(), a);
    if (a.id) agentMap.set(String(a.id).toLowerCase(), a);
    if (a.registrationId) agentMap.set(String(a.registrationId).toLowerCase(), a);
    if (a.agentCode) agentMap.set(String(a.agentCode).toLowerCase(), a);
    if (a.name) agentMap.set(String(a.name).toLowerCase(), a);
  }

  const kycMap = new Map();
  for (const k of (db.kycRecords || [])) {
    if (k.id) kycMap.set(String(k.id), k);
    if (k.vendorId) kycMap.set(String(k.vendorId), k);
  }

  return {
    stateIdMap, stateNameMap,
    districtIdMap, districtNameMap,
    divisionIdMap, divisionNameMap,
    pincodeIdMap, pincodeCodeMap,
    userMap, agentMap, kycMap
  };
}

// Helper: Resolve who onboarded this vendor (Actor / Creator)
function resolveOnboardedBy(vendor, ctx) {
  if (!vendor) {
    return {
      role: 'Not Available',
      type: 'Not Available',
      name: 'Not Available',
      id: '-',
      phone: 'Not Available',
      email: 'Not Available',
      addedAt: '-'
    };
  }

  const actorKey = String(
    vendor.createdById ||
    vendor.createdBy ||
    vendor.onboardedById ||
    vendor.onboardedBy ||
    vendor.managerId ||
    vendor.agentId ||
    vendor.addedBy?.id ||
    ''
  ).trim().toLowerCase();

  // 1. Cross-reference actor in users/managers
  if (actorKey) {
    let matchedUser = null;
    if (ctx && ctx.userMap) {
      matchedUser = ctx.userMap.get(actorKey);
    } else {
      const allUsers = Array.from(db.users || []);
      const allManagers = Array.from(db.managers || []);
      matchedUser = allUsers.find(u => {
        const uId = String(u._id || u.id || '').trim().toLowerCase();
        const uLogin = String(u.loginId || u.email || '').trim().toLowerCase();
        return uId === actorKey || uLogin === actorKey;
      }) || allManagers.find(m => {
        const mId = String(m._id || m.id || '').trim().toLowerCase();
        const mCode = String(m.employeeCode || '').trim().toLowerCase();
        return mId === actorKey || mCode === actorKey;
      });
    }

    if (matchedUser) {
      const roleTitle = matchedUser.roleTitle || formatActorRole(matchedUser.role, 'Manager');
      const isMgr = roleTitle.toLowerCase().includes('manager');
      const isAdmin = roleTitle.toLowerCase().includes('admin');
      const isAgent = roleTitle.toLowerCase().includes('agent');

      return {
        id: matchedUser.employeeCode || matchedUser.id || String(matchedUser._id || '-'),
        name: matchedUser.name || vendor.createdByName || vendor.onboardedByName || vendor.addedBy?.name || 'Not Available',
        role: roleTitle,
        type: isMgr ? 'Manager' : isAdmin ? 'Admin' : isAgent ? 'Agent' : 'User',
        phone: matchedUser.phone || matchedUser.mobile || vendor.addedBy?.phone || 'Not Available',
        email: matchedUser.email || vendor.addedBy?.email || 'Not Available',
        addedAt: vendor.addedBy?.addedAt || (vendor.createdAt ? new Date(vendor.createdAt).toISOString().split('T')[0] : '-')
      };
    }

    // 2. Check in agents
    let matchedAgent = null;
    if (ctx && ctx.agentMap) {
      matchedAgent = ctx.agentMap.get(actorKey);
    } else {
      const allAgents = Array.from(db.agents || []);
      matchedAgent = allAgents.find(a => {
        const aId = String(a._id || a.id || '').trim().toLowerCase();
        const aReg = String(a.registrationId || a.agentCode || '').trim().toLowerCase();
        const aName = String(a.name || '').trim().toLowerCase();
        return aId === actorKey || aReg === actorKey || aName === actorKey;
      });
    }

    if (matchedAgent) {
      const roleTitle = formatActorRole(matchedAgent.role, 'Agent');
      return {
        id: matchedAgent.registrationId || matchedAgent.agentCode || String(matchedAgent._id || matchedAgent.id),
        name: matchedAgent.name,
        role: roleTitle,
        type: 'Agent',
        phone: matchedAgent.phone || matchedAgent.mobile || 'Not Available',
        email: matchedAgent.email || 'Not Available',
        addedAt: vendor.addedBy?.addedAt || (vendor.createdAt ? new Date(vendor.createdAt).toISOString().split('T')[0] : '-')
      };
    }
  }

  // 3. Direct creator fields on vendor object
  if (vendor.createdByRole || vendor.onboardedByRole) {
    const rawRole = vendor.createdByRole || vendor.onboardedByRole;
    const isMgr = String(rawRole).toLowerCase().includes('manager') || String(vendor.createdById || vendor.onboardedById || '').startsWith('usr_mgr');
    const isAdmin = String(rawRole).toLowerCase().includes('admin');
    const roleTitle = formatActorRole(rawRole, isMgr ? 'Manager' : isAdmin ? 'Admin' : 'Agent');
    const name = vendor.createdByName || vendor.onboardedByName || vendor.addedBy?.name;
    if (name && name !== 'Unassigned') {
      return {
        id: vendor.createdById || vendor.onboardedById || vendor.addedBy?.id || '-',
        name,
        role: roleTitle,
        type: roleTitle.includes('Manager') ? 'Manager' : roleTitle.includes('Admin') ? 'Admin' : 'Agent',
        phone: vendor.addedBy?.phone || 'Not Available',
        email: vendor.addedBy?.email || 'Not Available',
        addedAt: vendor.addedBy?.addedAt || (vendor.createdAt ? new Date(vendor.createdAt).toISOString().split('T')[0] : '-')
      };
    }
  }

  // 4. Direct addedBy property on vendor object
  if (vendor.addedBy && vendor.addedBy.name && vendor.addedBy.name !== 'Unassigned') {
    let cleanRole = formatActorRole(vendor.addedBy.role);
    if (cleanRole.includes('Admin') && String(vendor.addedBy.id || '').startsWith('usr_mgr')) {
      cleanRole = 'Pincode Manager';
    }
    return {
      id: vendor.addedBy.id || '-',
      name: vendor.addedBy.name,
      role: cleanRole,
      type: cleanRole.includes('Manager') ? 'Manager' : cleanRole.includes('Admin') ? 'Admin' : 'Agent',
      phone: vendor.addedBy.phone || 'Not Available',
      email: vendor.addedBy.email || 'Not Available',
      addedAt: vendor.addedBy.addedAt || (vendor.createdAt ? new Date(vendor.createdAt).toISOString().split('T')[0] : '-')
    };
  }

  // 5. Direct agent info on vendor object
  if (vendor.agentName) {
    return {
      id: vendor.agentRegistrationId || vendor.agentId || '-',
      name: vendor.agentName,
      role: 'Pincode Agent',
      type: 'Agent',
      phone: vendor.agentPhone || 'Not Available',
      email: 'Not Available',
      addedAt: vendor.createdAt ? new Date(vendor.createdAt).toISOString().split('T')[0] : '-'
    };
  }

  // 6. Check KYC notes
  const vIdStr = String(vendor._id || vendor.id || '');
  const kycRec = (ctx && ctx.kycMap) ? (ctx.kycMap.get(`KYC-${vIdStr}`) || ctx.kycMap.get(vIdStr)) : (db.kycRecords || []).find(k => k.id === `KYC-${vIdStr}` || String(k.vendorId) === vIdStr);
  if (kycRec && kycRec.notes && kycRec.notes.toLowerCase().includes('onboarded by')) {
    const match = kycRec.notes.match(/onboarded\s+by\s+([A-Za-z\s]+)/i);
    if (match && match[1]) {
      const name = match[1].replace(/\..*$/, '').trim();
      return {
        role: 'Pincode Agent',
        type: 'Agent',
        name: name,
        id: '-',
        phone: 'Not Available',
        email: 'Not Available',
        addedAt: vendor.createdAt ? new Date(vendor.createdAt).toISOString().split('T')[0] : '-'
      };
    }
  }

  // Fallback: Real empty state, NEVER fake Admin or logged-in viewer
  return {
    role: 'Not Available',
    type: 'Not Available',
    name: 'Not Available',
    id: '-',
    phone: 'Not Available',
    email: 'Not Available',
    addedAt: '-'
  };
}

// Helper: Resolve dynamic KYC status from vendor document & db.kycRecords
function resolveVendorKycStatus(vendor, ctx) {
  const vIdStr = String(vendor._id || vendor.id || '');
  const kycRec = (ctx && ctx.kycMap) ? (ctx.kycMap.get(`KYC-${vIdStr}`) || ctx.kycMap.get(vIdStr)) : (db.kycRecords || []).find(k => k.id === `KYC-${vIdStr}` || String(k.vendorId) === vIdStr);

  const rawStatus = (kycRec && kycRec.status) ? kycRec.status : (vendor.kycStatus || vendor.status || 'Pending');
  const clean = String(rawStatus).trim().toLowerCase();

  if (['approved', 'verified', 'completed', 'kyc approved', 'kyc verified'].includes(clean)) {
    return 'Verified';
  }
  if (['rejected', 'kyc rejected'].includes(clean)) {
    return 'Rejected';
  }
  if (['under review', 'kyc under review', 'pending verification'].includes(clean)) {
    return 'Pending Verification';
  }
  if (clean === 'pending pincode admin approval') {
    return 'Pending Pincode Admin Approval';
  }
  if (['pending', 'kyc pending'].includes(clean)) {
    return 'Pending';
  }
  return rawStatus;
}

// Populate location names, IDs, onboarding attribution, and dynamic KYC status
const populateVendorLocations = (vendor, ctx = null) => {
  const context = ctx || buildVendorLookupContext();

  const state = vendor.stateId ? context.stateIdMap.get(String(vendor.stateId)) : (vendor.state ? context.stateNameMap.get(String(vendor.state).trim().toLowerCase()) : null);
  const district = vendor.districtId ? context.districtIdMap.get(String(vendor.districtId)) : (vendor.district ? context.districtNameMap.get(String(vendor.district).trim().toLowerCase()) : null);
  const division = vendor.divisionId ? context.divisionIdMap.get(String(vendor.divisionId)) : (vendor.division ? context.divisionNameMap.get(String(vendor.division).trim().toLowerCase()) : null);
  const pincode = vendor.pincodeId ? context.pincodeIdMap.get(String(vendor.pincodeId)) : (vendor.pincode ? context.pincodeCodeMap.get(String(vendor.pincode).trim()) : null);

  let districtName = vendor.district || district?.name || pincode?.district || '';
  let divisionName = vendor.division || division?.name || pincode?.division || '';
  let pincodeCode = vendor.pincode || pincode?.code || '';
  let stateName = vendor.state || state?.name || pincode?.state || '';

  if (!stateName && districtName) {
    const derived = resolveStateFromDistrict(districtName);
    if (derived) {
      stateName = derived.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  const pincodeArea = pincode?.areaName || vendor.address || '';

  const addedBy = resolveOnboardedBy(vendor, context);
  const kycStatus = resolveVendorKycStatus(vendor, context);
  const approvalStatus = vendor.approvalStatus || ((vendor.status === 'Active' || vendor.status === 'Approved') ? 'Approved' : 'Pending');

  const responsibleAdminInfo = resolveResponsibleAdmin({
    pincode: pincodeCode,
    division: divisionName,
    district: districtName,
    state: stateName
  });

  const onboardingAgent = vendor.onboardingAgent || {
    id: addedBy.id,
    name: addedBy.name,
    phone: addedBy.phone,
    mobile: addedBy.phone,
    email: addedBy.email,
    role: addedBy.role,
    tier: addedBy.role,
    addedAt: addedBy.addedAt || vendor.createdAt || '-'
  };

  const responsibleAdmin = vendor.responsibleAdmin || responsibleAdminInfo.admin;

  const normalized = {
    ...vendor,
    id: vendor._id || vendor.id,
    _id: vendor._id || vendor.id,
    name: vendor.businessName || vendor.name,
    businessName: vendor.businessName || vendor.name,
    contactPerson: vendor.contactPerson || vendor.name,
    phone: vendor.phone || vendor.mobile,
    mobile: vendor.mobile || vendor.phone,
    email: vendor.email || '',
    category: vendor.category || 'Services',
    subCategory: vendor.subCategory || 'General',
    state: stateName,
    stateName,
    district: districtName,
    districtName,
    division: divisionName,
    divisionName,
    pincode: pincodeCode,
    pincodeCode,
    pincodeArea,
    stateId: vendor.stateId || (state ? state._id : null),
    districtId: vendor.districtId || (district ? district._id : null),
    divisionId: vendor.divisionId || (division ? division._id : null),
    pincodeId: vendor.pincodeId || (pincode ? pincode._id : null),
    status: vendor.status || 'Active',
    kycStatus,
    approvalStatus,
    addedBy,
    onboardingAgent,
    responsibleAdmin,
    responsibleAdminAssignment: responsibleAdminInfo,
    onboardedBy: addedBy.id,
    onboardedByInfo: onboardingAgent,
    onboardedById: addedBy.id,
    onboardedByName: addedBy.name,
    onboardedByRole: addedBy.role,
    createdById: vendor.createdById || vendor.createdBy || addedBy.id,
    createdByName: vendor.createdByName || addedBy.name,
    createdByRole: vendor.createdByRole || addedBy.role,
    approvedById: vendor.approvedById || null,
    approvedByName: vendor.approvedByName || null,
    approvedByRole: vendor.approvedByRole || null,
    approvedAt: vendor.approvedAt || null
  };

  return normalized;
};

// GET /api/vendors - Paginated, filtered, strictly scope-enforced
const getVendors = async (req, res) => {
  try {
    const user = req.user || {};
    // Merge active vendors from db.vendors and db.users (single source of truth with strict deduplication)
    const vendorMap = new Map();
    const vendorEmailMap = new Map();
    const vendorPhoneMap = new Map();

    const cleanEmail = (em) => String(em || '').trim().toLowerCase();
    const cleanPhone = (ph) => String(ph || '').replace(/\D/g, '').slice(-10);

    for (const v of (db.vendors || [])) {
      const vId = String(v._id || v.id || '').trim();
      const em = cleanEmail(v.email);
      const ph = cleanPhone(v.phone || v.mobile);

      if (vId) vendorMap.set(vId, v);
      if (em) vendorEmailMap.set(em, v);
      if (ph) vendorPhoneMap.set(ph, v);
    }

    for (const u of (db.users || [])) {
      const uRole = String(u.role || '').toLowerCase();
      if (uRole.includes('vendor') || uRole.includes('seller') || uRole.includes('merchant')) {
        const uId = String(u._id || u.id || '').trim();
        const em = cleanEmail(u.email);
        const ph = cleanPhone(u.mobile || u.phone);

        // Check if vendor already exists by ID, email, or phone
        const existing = (uId && vendorMap.get(uId)) ||
                         (em && vendorEmailMap.get(em)) ||
                         (ph && vendorPhoneMap.get(ph));

        if (!existing) {
          const newV = {
            _id: u._id,
            id: u._id || u.id,
            userId: u._id,
            name: u.name,
            businessName: u.businessName || u.name,
            contactPerson: u.name,
            phone: u.mobile || u.phone,
            mobile: u.mobile || u.phone,
            email: u.email,
            category: u.category || 'Services',
            subCategory: u.subCategory || 'General',
            address: u.address || `${u.district || ''}, ${u.state || ''} - ${u.pincode || ''}`.trim(),
            state: u.state || u.assignedState,
            district: u.district || u.assignedDistrict,
            division: u.division || u.assignedDivision,
            pincode: u.pincode || u.assignedPincode,
            stateId: u.stateId || null,
            districtId: u.districtId || null,
            divisionId: u.divisionId || null,
            pincodeId: u.pincodeId || null,
            status: u.status || 'Active',
            kycStatus: u.kycStatus || 'Verified',
            approvalStatus: 'Approved',
            createdAt: u.createdAt,
            updatedAt: u.updatedAt
          };
          if (uId) vendorMap.set(uId, newV);
          if (em) vendorEmailMap.set(em, newV);
          if (ph) vendorPhoneMap.set(ph, newV);
        }
      }
    }
    const allVendors = Array.from(new Set(vendorMap.values()));

    // PRE-POPULATE geo/location fields BEFORE filtering so filterByLocation
    // and territory query params can match against resolved district/division/state/pincode.
    // Without this step, vendors whose location comes from pincodeId or divisionId
    // have blank string fields and are dropped by location filtering (the "0 vendors" bug).
    const lookupCtx = buildVendorLookupContext();
    const enrichedVendors = allVendors.map(v => populateVendorLocations(v, lookupCtx));

    // Apply location filtering matching caller's scope (now works on enriched data)
    let scoped = filterByLocation(enrichedVendors, user);

    // Extract query parameters
    const {
      search,
      category,
      subCategory,
      status,
      kycStatus,
      state,
      district,
      division,
      pincode,
      districtId,
      divisionId,
      pincodeId,
      page,
      limit,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      onboardedOnly,
      includeIncomplete
    } = req.query;

    const callerRole = String(user.role || '').toLowerCase();
    const isSubAdmin = callerRole.includes('state') || callerRole.includes('district') || callerRole.includes('division') || callerRole.includes('divis') || callerRole.includes('pincode');

    // Sub-Admin vendors listings must strictly show only fully onboarded vendors.
    // Backward-compatible for internal/admin tools via explicit includeIncomplete=true or onboardedOnly=false.
    const shouldFilterOnboardedOnly = onboardedOnly === 'true' || (includeIncomplete !== 'true' && (isSubAdmin || onboardedOnly !== 'false'));

    if (shouldFilterOnboardedOnly) {
      scoped = scoped.filter(v => isFullyOnboardedVendor(v, { allowSuspended: true, allowDeleted: true }));
    }

    let filtered = scoped.filter(v => {
      // 1. Search filter
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = (v.name || '').toLowerCase().includes(q);
        const matchesBiz = (v.businessName || '').toLowerCase().includes(q);
        const matchesContact = (v.contactPerson || '').toLowerCase().includes(q);
        const matchesMobile = (v.mobile || v.phone || '').includes(q);
        const matchesPin = (v.pincode || '').includes(q);
        const matchesCat = (v.category || '').toLowerCase().includes(q);
        const matchesDist = (v.district || v.districtName || '').toLowerCase().includes(q);
        const matchesDiv = (v.division || v.divisionName || '').toLowerCase().includes(q);

        if (!matchesName && !matchesBiz && !matchesContact && !matchesMobile && !matchesPin && !matchesCat && !matchesDist && !matchesDiv) {
          return false;
        }
      }

      // 2. Category & Subcategory
      if (category && category.trim().toLowerCase() !== 'all') {
        const cat = (v.category || '').toLowerCase();
        const cats = Array.isArray(v.categories) ? v.categories.map(c => c.toLowerCase()) : [];
        if (cat !== category.toLowerCase() && !cats.includes(category.toLowerCase())) return false;
      }
      if (subCategory && subCategory.trim().toLowerCase() !== 'all' && (v.subCategory || '').toLowerCase() !== subCategory.toLowerCase()) return false;

      // 3. Status filter
      if (status && status.trim().toLowerCase() !== 'all') {
        const sTarget = status.trim().toLowerCase();
        const vStat = (v.status || '').toLowerCase();
        if (sTarget === 'active') {
          if (vStat !== 'active' && vStat !== 'approved') return false;
          if (v.isDeleted === true || vStat === 'deleted' || vStat === 'suspended') return false;
        } else if (sTarget === 'suspended') {
          if (vStat !== 'suspended') return false;
        } else if (sTarget === 'deleted') {
          if (vStat !== 'deleted' && !v.isDeleted) return false;
        } else if (vStat !== sTarget) {
          return false;
        }
      } else {
        // Exclude deleted accounts from general listing unless explicitly selected
        if (v.status === 'Deleted' || v.isDeleted === true) {
          return false;
        }
      }
      if (kycStatus && kycStatus.trim().toLowerCase() !== 'all' && (v.kycStatus || '').toLowerCase() !== kycStatus.toLowerCase()) return false;

      // 4. Sub-location territory filters (strictly within authorized caller scope)
      // Case-insensitive + whitespace-normalized matching on resolved geo fields
      if (state && state.trim().toLowerCase() !== 'all') {
        const sNorm = state.trim().toLowerCase();
        const vState = (v.state || v.stateName || '').trim().toLowerCase();
        if (vState && vState !== sNorm) return false;
      }
      if (district && district.trim().toLowerCase() !== 'all') {
        const dNorm = district.trim().toLowerCase();
        const vDist = (v.district || v.districtName || '').trim().toLowerCase();
        if (vDist && vDist !== dNorm) return false;
      }
      if (division && division.trim().toLowerCase() !== 'all') {
        const divNorm = division.trim().toLowerCase().replace(/\s+division$/i, '');
        const vDiv = (v.division || v.divisionName || '').trim().toLowerCase().replace(/\s+division$/i, '');
        if (vDiv && vDiv !== divNorm) return false;
      }
      if (pincode && String(pincode).trim().toLowerCase() !== 'all') {
        const pinNorm = String(pincode).trim();
        const vPin = String(v.pincode || v.pincodeCode || '').trim();
        if (vPin && vPin !== pinNorm) return false;
      }
      if (districtId && String(v.districtId || '') !== String(districtId)) return false;
      if (divisionId && String(v.divisionId || '') !== String(divisionId)) return false;
      if (pincodeId && String(v.pincodeId || '') !== String(pincodeId)) return false;

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const fieldA = a[sortBy] || '';
      const fieldB = b[sortBy] || '';
      if (sortOrder === 'asc') return fieldA > fieldB ? 1 : -1;
      return fieldA < fieldB ? 1 : -1;
    });

    const totalVendors = filtered.length;
    let pagedVendors = filtered;
    let currentPage = 1;
    let pageSize = totalVendors;

    // Apply pagination if explicitly provided by Manager portal
    if (page || limit) {
      currentPage = parseInt(page, 10) || 1;
      pageSize = parseInt(limit, 10) || 10;
      const startIndex = (currentPage - 1) * pageSize;
      pagedVendors = filtered.slice(startIndex, startIndex + pageSize);
    }

    const totalPages = Math.ceil(totalVendors / (pageSize || 1)) || 1;

    // Vendors are already pre-populated (enrichedVendors above) — no second pass needed
    return res.json({
      success: true,
      count: totalVendors,
      total: totalVendors,
      vendors: pagedVendors,   // Sub_Admin_Management portal expects `vendors`
      data: pagedVendors,      // Manager portal expects `data`
      pagination: {
        total: totalVendors,
        page: currentPage,
        limit: pageSize,
        totalPages
      }
    });
  } catch (error) {
    console.error('Failed to fetch vendors:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch vendors', error: error.message });
  }
};

const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    // Defensive check: if request to /vendors/subscriptions was captured by /:id param
    if (id === 'subscriptions') {
      const vendorSubscriptionController = require('./vendorSubscriptionController');
      return vendorSubscriptionController.getVendorSubscriptions(req, res);
    }

    const vendor = await db.vendors.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (!isVendorInScope(vendor, req.user)) {
      return res.status(403).json({ success: false, message: 'Vendor outside your jurisdiction' });
    }

    const populated = await populateVendorLocations(vendor);

    return res.json({
      success: true,
      vendor: populated,
      data: populated
    });
  } catch (error) {
    console.error('Failed to fetch vendor:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch vendor', error: error.message });
  }
};

const lookupPincode = (req, res) => {
  try {
    const { pincode } = req.params;
    const hierarchy = resolvePincodeHierarchy(pincode);
    return res.json({ success: true, data: hierarchy });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to lookup pincode', error: error.message });
  }
};

const createVendor = async (req, res) => {
  try {
    const data = req.body;
    const name = data.businessName || data.name;
    const phone = data.mobile || data.phone;
    const pincode = data.pincode || data.pincodeCode;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Business Name and Phone number are required' });
    }

    // Resolve hierarchy either from pincode lookup or given IDs
    let state = data.state;
    let district = data.district;
    let division = data.division;
    let resolvedPincode = pincode;
    let stateId = data.stateId;
    let districtId = data.districtId;
    let divisionId = data.divisionId;
    let pincodeId = data.pincodeId;

    if (pincodeId && !pincode) {
      const pinObj = await db.pincodes.findById(pincodeId);
      if (pinObj) {
        resolvedPincode = pinObj.code;
        stateId = pinObj.stateId || stateId;
        districtId = pinObj.districtId || districtId;
        divisionId = pinObj.divisionId || divisionId;
      }
    }

    if (resolvedPincode && (!state || !district || !division)) {
      const resolved = resolvePincodeHierarchy(resolvedPincode);
      state = state || resolved.state;
      district = district || resolved.district;
      division = division || resolved.division;
      if (state === 'Tamil Nadu') stateId = stateId || 'state_tn';
      if (district === 'Salem') districtId = districtId || 'dist_salem';
      if (division === 'Salem North') divisionId = divisionId || 'div_dist_salem_urban';
    }

    const newId = `ven_${Date.now().toString().slice(-6)}`;

    const newVendor = {
      _id: newId,
      id: newId,
      name,
      businessName: name,
      contactPerson: data.contactPerson || name,
      phone,
      mobile: phone,
      email: data.email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@vendor.com`,
      category: data.category || 'Services',
      subCategory: data.subCategory || 'General',
      description: data.description || data.address || '',
      address: data.address || `${district}, ${state} - ${resolvedPincode}`,
      state,
      district,
      division,
      pincode: resolvedPincode,
      stateId: stateId || null,
      districtId: districtId || null,
      divisionId: divisionId || null,
      pincodeId: pincodeId || null,
      regionId: stateId || null,
      // Extended Business Info
      logo: data.logo || null,
      website: data.website || '',
      operatingHours: data.operatingHours || '09:00 AM - 09:00 PM',
      businessImages: data.businessImages || [],
      // Owner Info
      ownerName: data.ownerName || data.contactPerson || name,
      alternatePhone: data.alternatePhone || '',
      agentName: data.agentName || '',
      coPartnerName: data.coPartnerName || '',
      passwordHash: data.password ? bcrypt.hashSync(data.password, 10) : undefined,
      // Documents
      panNumber: data.panNumber || 'ABCDE1234F',
      aadhaarNumber: data.aadhaarNumber || '',
      companyRegNumber: data.companyRegNumber || '',
      gstStatus: data.gstStatus || 'Registered',
      msmeStatus: data.msmeStatus || 'Not Registered',
      businessLicense: data.businessLicense || null,
      gstNumber: data.gstNumber || '33ABCDE1234F1Z5',
      // Bank Details
      accountHolderName: data.accountHolderName || name,
      bankName: data.bankName || 'HDFC Bank',
      bankBranch: data.bankBranch || '',
      bankStreet: data.bankStreet || '',
      bankCity: data.bankCity || '',
      accountNumber: data.accountNumber || '50200012345678',
      ifsc: data.ifsc || 'HDFC0001234',
      status: 'Under Review',
      approvalStatus: 'Pending Pincode Admin Approval',
      kycStatus: 'Pending Verification',
      rating: 5.0,
      totalOrdersDelivered: 0,
      pendingPayout: 0,
      createdBy: req.user?.id || req.user?._id || 'USR-001',
      createdById: req.user?.id || req.user?._id || 'USR-001',
      createdByName: req.user?.name || req.user?.username || 'Field Manager',
      createdByRole: formatActorRole(req.user?.role || 'Pincode Manager'),
      onboardedById: req.user?.id || req.user?._id || 'USR-001',
      onboardedByName: req.user?.name || req.user?.username || 'Field Manager',
      onboardedByRole: formatActorRole(req.user?.role || 'Pincode Manager'),
      addedBy: {
        id: req.user?.id || req.user?._id || 'USR-001',
        name: req.user?.name || req.user?.username || 'Field Manager',
        role: formatActorRole(req.user?.role || 'Pincode Manager'),
        phone: req.user?.phone || req.user?.mobile || '',
        email: req.user?.email || '',
        addedAt: new Date().toISOString().split('T')[0]
      },
      documents: data.documents || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await db.vendors.insertOne(newVendor);

    // Sync corresponding vendor user record into db.users for unified account & auth resolution
    if (db.users && saved) {
      const existingUser = await db.users.findOne({ email: saved.email });
      if (!existingUser) {
        await db.users.insertOne({
          _id: saved._id,
          id: saved._id,
          name: saved.contactPerson || saved.name,
          email: saved.email,
          phone: saved.phone || saved.mobile,
          mobile: saved.phone || saved.mobile,
          role: 'vendor',
          level: 4,
          status: saved.status || 'Under Review',
          adminApprovalStatus: 'pending',
          kycStatus: 'pending_verification',
          isActive: false,
          requiresApproval: true,
          isFullyApproved: false,
          state: saved.state,
          district: saved.district,
          division: saved.division,
          pincode: saved.pincode,
          stateId: saved.stateId || null,
          districtId: saved.districtId || null,
          divisionId: saved.divisionId || null,
          pincodeId: saved.pincodeId || null,
          address: saved.address,
          registrationSource: saved.createdByRole?.toLowerCase().includes('agent') ? 'Agent Onboarding' : 'Manager Onboarding',
          source: saved.createdByRole?.toLowerCase().includes('agent') ? 'Agent Onboarding' : 'Manager Onboarding',
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt
        }).catch(() => {});
      }
    }

    // Audit log
    await db.auditLogs.insertOne({
      action: 'VENDOR_CREATED',
      recordId: saved._id,
      userId: req.user?.id || req.user?._id,
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'Manager',
      details: `Vendor '${newVendor.businessName}' onboarded. Category: ${newVendor.category}. Assigned Pincode: ${newVendor.pincode}.`,
      ip: req.ip || '127.0.0.1'
    });

    // Add to KYC records for Sub-Admin compliance queue
    if (db.kycRecords) {
      db.kycRecords.unshift({
        id: `KYC-${saved._id}`,
        vendorId: saved._id,
        businessName: saved.name,
        name: saved.name,
        vendorName: saved.contactPerson,
        phone: saved.phone,
        email: saved.email,
        category: saved.category,
        address: saved.address,
        state: saved.state,
        district: saved.district,
        division: saved.division,
        pincode: saved.pincode,
        status: 'Pending Pincode Admin Approval',
        type: 'Vendor',
        submittedDocuments: [
          'GST Registration Certificate',
          'Business PAN Card',
          'Cancelled Cheque / Bank Passbook'
        ],
        submittedDate: new Date().toISOString().split('T')[0],
        verifiedBy: null,
        notes: `Onboarded by ${req.user?.name || 'Field Manager'}. Awaiting Pincode Admin clearance.`
      });
    }

    const populated = await populateVendorLocations(saved);

    // Dispatch real-time notification
    try {
      notificationService.notifyVendorOnboarding({
        vendor: populated,
        creator: req.user
      });
    } catch (notifErr) {
      console.error('Failed to trigger onboarding notification:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      vendor: populated,
      data: populated
    });
  } catch (error) {
    console.error('Failed to create vendor:', error);
    return res.status(500).json({ success: false, message: 'Failed to create vendor', error: error.message });
  }
};

const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await db.vendors.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.id;

    const updated = await db.vendors.findByIdAndUpdate(id, updateData);

    await db.auditLogs.insertOne({
      action: 'VENDOR_UPDATED',
      recordId: id,
      userId: req.user?.id || req.user?._id,
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'Manager',
      details: `Vendor '${vendor.businessName || vendor.name}' profile details updated.`,
      ip: req.ip || '127.0.0.1'
    });

    const populated = await populateVendorLocations(updated);

    return res.json({
      success: true,
      message: 'Vendor updated successfully',
      vendor: populated,
      data: populated
    });
  } catch (error) {
    console.error('Failed to update vendor:', error);
    return res.status(500).json({ success: false, message: 'Failed to update vendor', error: error.message });
  }
};

const updateVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, action, reason, statusNotes } = req.body;

    const vendor = (await db.vendors.findById(id)) || Array.from(db.vendors).find(v => String(v._id || v.id) === String(id));
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Territorial authorization check
    if (!isUserAuthorizedForVendor(req.user, vendor)) {
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_TERRITORY',
        message: `Forbidden: You are not authorized to manage vendor accounts for ${vendor.pincode || vendor.district || 'this territory'}.`
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
    } else if (status) {
      targetStatus = status;
    } else {
      return res.status(400).json({ success: false, message: 'Valid action (suspend, activate, delete) or status is required' });
    }

    // For activate: Must not bypass KYC or unapproved state
    if (targetStatus === 'Active') {
      const kyc = String(vendor.kycStatus || '').toLowerCase();
      if (kyc.includes('reject')) {
        return res.status(400).json({ success: false, message: 'Cannot activate a vendor whose KYC was rejected.' });
      }
    }

    const now = new Date().toISOString();
    const oldStatus = vendor.status || 'Active';
    const isDeleted = targetStatus === 'Deleted';
    const isActive = targetStatus === 'Active';

    const updates = {
      status: targetStatus,
      isActive,
      statusNotes: statusNotes || reason || vendor.statusNotes,
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

    // Update vendor in db.vendors
    const updated = await db.vendors.findByIdAndUpdate(vendor._id || vendor.id, updates);

    // Sync to MongoDB Atlas users collection if vendor has login credentials
    try {
      const mongoDb = await getMongoDb();
      if (mongoDb) {
        const email = (vendor.email || '').toLowerCase().trim();
        const phone = (vendor.phone || vendor.mobile || '').replace(/[^0-9]/g, '');
        const query = [];
        if (email) query.push({ email });
        if (phone) {
          query.push({ phone });
          query.push({ mobile: phone });
          if (phone.length >= 10) {
            query.push({ phone: phone.slice(-10) });
            query.push({ mobile: phone.slice(-10) });
          }
        }
        if (query.length > 0) {
          await mongoDb.collection('users').updateMany({ $or: query }, {
            $set: {
              status: targetStatus,
              isActive,
              ...(isDeleted ? { isDeleted: true, deletedAt: now } : {})
            }
          });
        }
      }
    } catch (mErr) {
      console.warn('MongoDB Atlas sync in updateVendorStatus warning:', mErr.message);
    }

    // Also sync local db.users if present
    if (db.users) {
      const vIdStr = String(vendor._id || vendor.id || '');
      const email = (vendor.email || '').toLowerCase().trim();
      const phone = (vendor.phone || vendor.mobile || '').replace(/[^0-9]/g, '');
      const localUsers = Array.from(db.users).filter(u =>
        (vIdStr && String(u._id || u.id) === vIdStr) ||
        (email && u.email && u.email.toLowerCase() === email) ||
        (phone && u.phone && u.phone.replace(/[^0-9]/g, '').slice(-10) === phone.slice(-10))
      );
      localUsers.forEach(u => {
        u.status = targetStatus;
        u.isActive = isActive;
        if (targetStatus === 'Suspended') {
          u.isSuspended = true;
          u.suspendedAt = now;
        } else if (targetStatus === 'Active') {
          u.isSuspended = false;
          u.isDeleted = false;
          u.activatedAt = now;
        } else if (isDeleted) {
          u.isDeleted = true;
          u.deletedAt = now;
        }
      });
    }

    // Audit log
    await db.auditLogs.insertOne({
      id: `AUD-${Date.now()}`,
      action: `VENDOR_${targetStatus.toUpperCase()}`,
      recordId: vendor._id || vendor.id,
      userId: req.user?.id || req.user?._id,
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'Admin',
      details: `${req.user?.role || 'Admin'} "${req.user?.name || req.user?.email}" transitioned vendor "${vendor.businessName || vendor.name}" status from '${oldStatus}' to '${targetStatus}'. Reason/Notes: ${reason || statusNotes || 'None'}`,
      ip: req.ip || '127.0.0.1',
      timestamp: now
    }).catch(() => {});

    const populated = await populateVendorLocations(updated || { ...vendor, ...updates });

    // Dispatch real-time notification
    try {
      notificationService.notifyVendorStatusChange({
        vendor: populated,
        oldStatus: oldStatus,
        newStatus: targetStatus,
        user: req.user,
        notes: statusNotes || reason
      });
    } catch (notifErr) {
      console.error('Failed to trigger vendor status notification:', notifErr.message);
    }

    return res.json({
      success: true,
      message: `Vendor status updated to ${targetStatus}`,
      vendor: populated,
      data: populated
    });
  } catch (error) {
    console.error('Failed to update vendor status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update vendor status', error: error.message });
  }
};

const pincodeAdminVerifyVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    let vendor = await db.vendors.findById(id);
    let bDoc = null;

    if (!vendor) {
      // 1. Try finding in MongoDB businessrequests
      try {
        const { getMongoDb } = require('../config/mongo');
        const mongoDb = await getMongoDb();
        if (mongoDb) {
          const { ObjectId } = require('mongodb');
          let q = { _id: id };
          if (ObjectId.isValid(id)) {
            q = { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
          }
          bDoc = await mongoDb.collection('businessrequests').findOne(q);
          if (bDoc) {
            vendor = {
              _id: String(bDoc._id),
              id: String(bDoc._id),
              vendorId: bDoc.vendorId || String(bDoc._id),
              name: bDoc.vendorName || bDoc.businessName,
              businessName: bDoc.businessName || bDoc.vendorName,
              contactPerson: bDoc.vendorName,
              phone: bDoc.vendorPhone || bDoc.phone,
              mobile: bDoc.vendorPhone || bDoc.phone,
              email: bDoc.vendorEmail,
              category: bDoc.businessCategory || bDoc.vendorType || bDoc.subcategory || 'Services',
              address: bDoc.address,
              state: bDoc.state,
              district: bDoc.district,
              division: bDoc.division || '',
              pincode: bDoc.pincode,
              status: bDoc.status || 'Pending Pincode Admin Review',
              approvalStatus: bDoc.status || 'Pending Pincode Admin Review',
              registrationSource: 'Direct Registration',
              source: 'Direct Registration',
              createdAt: bDoc.submittedDate || bDoc.createdAt,
              updatedAt: bDoc.updatedAt
            };
            await db.vendors.insertOne(vendor);
          }
        }
      } catch (bErr) {
        console.warn('Error checking businessrequests for verification:', bErr.message);
      }
    }

    if (!vendor) {
      // 2. Try finding in db.users
      const u = (db.users || []).find(x => String(x._id || x.id) === String(id) || String(x.email || '').toLowerCase() === String(id).toLowerCase());
      if (u) {
        vendor = {
          _id: u._id,
          id: u._id || u.id,
          userId: u._id,
          name: u.name,
          businessName: u.businessName || u.name,
          contactPerson: u.name,
          phone: u.mobile || u.phone,
          mobile: u.mobile || u.phone,
          email: u.email,
          category: u.category || 'Services',
          address: u.address || `${u.district || ''}, ${u.state || ''} - ${u.pincode || ''}`.trim(),
          state: u.state,
          district: u.district,
          division: u.division,
          pincode: u.pincode,
          stateId: u.stateId || null,
          districtId: u.districtId || null,
          divisionId: u.divisionId || null,
          pincodeId: u.pincodeId || null,
          status: u.status || 'Pending Pincode Admin Review',
          approvalStatus: u.approvalStatus || 'Pending Pincode Admin Review',
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
        };
        await db.vendors.insertOne(vendor);
      }
    }

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Server-side permission check: Only authorized admin responsible for this PIN code / jurisdiction can approve/reject
    if (!isUserAuthorizedForVendor(req.user, vendor)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You are not authorized to verify vendors for pincode ${vendor.pincode || 'this jurisdiction'}. Only the assigned administrator responsible for this PIN code can approve or reject.`
      });
    }

    const normAction = String(action || '').toLowerCase().trim();
    if (!['accept', 'approve', 'reject', 'pending'].includes(normAction)) {
      return res.status(400).json({ success: false, message: 'Action must be Approve/Accept, Reject, or Pending' });
    }

    const isReject = normAction === 'reject';
    const isPending = normAction === 'pending';
    const isApprove = normAction === 'accept' || normAction === 'approve';

    const effectiveReason = (rejectionReason || req.body.pendingReason || req.body.reason || '').trim();

    if (isReject && !effectiveReason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is mandatory when rejecting vendor' });
    }
    if (isPending && !effectiveReason) {
      return res.status(400).json({ success: false, message: 'Mandatory reason is required when keeping vendor request pending' });
    }

    // Prevent duplicate approvals
    if (isApprove && (vendor.approvalStatus === 'PINCODE_APPROVED' || vendor.pincodeAdminApproval?.status === 'Approved')) {
      return res.status(400).json({
        success: false,
        message: 'Vendor has already been approved by Pincode Admin and forwarded to the KYC Team.'
      });
    }

    const decidedBy = `${req.user.name} (${req.user.role || 'Pincode Admin'})`;
    const decidedAt = new Date().toISOString();

    let updates = {};
    if (isReject) {
      updates = {
        status: 'Rejected',
        approvalStatus: 'PINCODE_REJECTED',
        kycStatus: 'Pincode Admin Rejected',
        rejectionReason: effectiveReason,
        reviewerReason: effectiveReason,
        approvedById: req.user.id || req.user._id,
        approvedByName: req.user.name,
        approvedByRole: req.user.role || 'Pincode Admin',
        approvedAt: decidedAt,
        pincodeAdminApproval: {
          status: 'Rejected',
          decidedBy,
          decidedAt,
          rejectionReason: effectiveReason,
          adminId: req.user.id || req.user._id,
          adminName: req.user.name,
          adminRole: req.user.role || 'Pincode Admin',
          adminPhone: req.user.mobile || req.user.phone || ''
        }
      };
    } else if (isPending) {
      updates = {
        status: 'Pending Territory Approval',
        approvalStatus: 'PINCODE_PENDING',
        kycStatus: 'Pending Territory Review',
        pendingReason: effectiveReason,
        reviewerReason: effectiveReason,
        adminPendingBy: req.user.name,
        adminPendingById: req.user.id || req.user._id,
        adminPendingByRole: req.user.role || 'Pincode Admin',
        adminPendingAt: decidedAt,
        pincodeAdminApproval: {
          status: 'Pending',
          decidedBy,
          decidedAt,
          rejectionReason: null,
          pendingReason: effectiveReason,
          adminId: req.user.id || req.user._id,
          adminName: req.user.name,
          adminRole: req.user.role || 'Pincode Admin',
          adminPhone: req.user.mobile || req.user.phone || ''
        }
      };
    } else {
      updates = {
        status: 'Pending KYC Review',
        approvalStatus: 'PINCODE_APPROVED',
        kycStatus: 'KYC Pending',
        rejectionReason: null,
        pendingReason: null,
        reviewerReason: null,
        approvedById: req.user.id || req.user._id,
        approvedByName: req.user.name,
        approvedByRole: req.user.role || 'Pincode Admin',
        approvedAt: decidedAt,
        pincodeAdminApproval: {
          status: 'Approved',
          decidedBy,
          decidedAt,
          rejectionReason: null,
          adminId: req.user.id || req.user._id,
          adminName: req.user.name,
          adminRole: req.user.role || 'Pincode Admin',
          adminPhone: req.user.mobile || req.user.phone || ''
        }
      };
    }

    // Preserve and append reviewHistory
    const reviewHistory = Array.isArray(vendor.reviewHistory) ? [...vendor.reviewHistory] : [];
    reviewHistory.push({
      action: isReject ? 'REJECTED' : isPending ? 'PENDING' : 'APPROVED',
      reason: effectiveReason || (isApprove ? 'Approved by Pincode Admin' : ''),
      reviewedBy: req.user.name,
      reviewedById: req.user.id || req.user._id,
      reviewerRole: req.user.role || 'Pincode Admin',
      timestamp: decidedAt
    });
    updates.reviewHistory = reviewHistory;

    const updated = await db.vendors.findByIdAndUpdate(id, updates);
    const populated = await populateVendorLocations(updated);

    // Atomically create or update KYC task entry to prevent duplicate queue submissions
    const kycRecord = (db.kycRecords || []).find(k => k.id === `KYC-${id}` || String(k.vendorId) === String(id));
    if (kycRecord) {
      await db.kycRecords.findByIdAndUpdate(kycRecord._id || kycRecord.id, {
        status: isReject ? 'Rejected' : 'Pending',
        kycStatus: isReject ? 'Pincode Admin Rejected' : 'KYC Pending',
        approvalStatus: updates.approvalStatus,
        verifiedBy: decidedBy,
        verifiedDate: decidedAt.split('T')[0],
        rejectionReason: isReject ? rejectionReason.trim() : null,
        pincodeAdminApproval: updates.pincodeAdminApproval,
        notes: isReject ? `Rejected by Pincode Admin: ${rejectionReason.trim()}` : 'Approved by Pincode Admin. Forwarded to KYC Team.'
      });
    } else if (!isReject) {
      await db.kycRecords.insertOne({
        _id: `KYC-${id}`,
        id: `KYC-${id}`,
        type: 'Vendor',
        vendorId: id,
        name: populated.name || populated.businessName,
        businessName: populated.businessName || populated.name,
        vendorName: populated.contactPerson || populated.ownerName || 'Vendor Owner',
        category: populated.category || 'Services',
        phone: populated.phone || populated.mobile,
        email: populated.email,
        state: populated.state,
        district: populated.district,
        division: populated.division,
        pincode: populated.pincode,
        stateId: populated.stateId,
        districtId: populated.districtId,
        divisionId: populated.divisionId,
        pincodeId: populated.pincodeId,
        status: 'Pending',
        kycStatus: 'KYC Pending',
        approvalStatus: 'PINCODE_APPROVED',
        submittedDate: (vendor.createdAt || decidedAt).split('T')[0],
        pincodeAdminApproval: updates.pincodeAdminApproval,
        onboardingAgent: populated.onboardingAgent || populated.addedBy,
        responsibleAdmin: populated.responsibleAdmin,
        documents: vendor.documents || {},
        notes: `Approved by Pincode Admin (${decidedBy}). Forwarded to KYC Team.`,
        createdAt: decidedAt,
        updatedAt: decidedAt
      });
    }

    // Sync to MongoDB users collection for Vendor Portal login state
    try {
      const { getMongoDb } = require('../config/mongo');
      const mongoDb = await getMongoDb();
      if (mongoDb && vendor.email) {
        await mongoDb.collection('users').updateOne(
          { email: String(vendor.email).toLowerCase().trim() },
          {
            $set: {
              status: updates.status,
              approvalStatus: updates.approvalStatus,
              kycStatus: updates.kycStatus,
              pincodeAdminApproval: updates.pincodeAdminApproval,
              rejectionReason: isReject ? rejectionReason.trim() : null,
              updatedAt: new Date()
            }
          }
        );
      }
      if (mongoDb && bDoc) {
        await mongoDb.collection('businessrequests').updateOne(
          { _id: bDoc._id },
          {
            $set: {
              status: isReject ? 'Rejected' : isPending ? 'Pending' : 'Approved',
              approvalStatus: updates.approvalStatus,
              pincodeAdminApproval: updates.pincodeAdminApproval,
              rejectionReason: isReject ? effectiveReason : null,
              pendingReason: isPending ? effectiveReason : null,
              updatedAt: new Date()
            }
          }
        );
      }
    } catch (syncErr) {
      console.warn('Sync vendor status to users/businessrequests collection warning:', syncErr.message);
    }

    // Audit log
    await db.auditLogs.insertOne({
      action: isReject ? 'VENDOR_PINCODE_REJECTED' : 'VENDOR_PINCODE_ACCEPTED',
      recordId: id,
      userId: req.user?.id || req.user?._id,
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'Pincode Admin',
      details: isReject ? `Pincode Admin rejected vendor: ${rejectionReason.trim()}` : `Pincode Admin approved vendor. Forwarded for KYC audit.`,
      ip: req.ip || '127.0.0.1'
    });

    // Dispatch real-time notification
    try {
      notificationService.notifyVendorVerification({
        vendor: populated,
        action,
        reason: rejectionReason,
        admin: req.user
      });
    } catch (notifErr) {
      console.error('Failed to trigger verification notification:', notifErr.message);
    }

    return res.json({
      success: true,
      message: isReject ? 'Vendor rejected by Pincode Admin' : 'Vendor accepted by Pincode Admin and forwarded to KYC Team',
      vendor: populated,
      data: populated
    });
  } catch (error) {
    console.error('Failed to verify vendor:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify vendor', error: error.message });
  }
};

const kycVerifyVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason, reason } = req.body;

    const vendor = await db.vendors.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const normAction = String(action || '').toLowerCase().trim();
    if (!['approve', 'reject', 'additional_info', 'additional_information_required'].includes(normAction)) {
      return res.status(400).json({ success: false, message: 'Action must be Approve, Reject, or Additional_Info' });
    }

    const isReject = normAction === 'reject';
    const isAdditionalInfo = normAction === 'additional_info' || normAction === 'additional_information_required';
    const isApprove = normAction === 'approve';

    if (isReject && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({ success: false, message: 'Rejection reason is mandatory when rejecting KYC' });
    }
    if (isAdditionalInfo && (!reason && !rejectionReason)) {
      return res.status(400).json({ success: false, message: 'A reason or note explaining requested corrections is mandatory' });
    }

    // Critical rule: Vendor MUST have Pincode Admin approval before KYC stage can be approved
    const hasPincodeApproval = vendor.approvalStatus === 'PINCODE_APPROVED' ||
      vendor.approvalStatus === 'Pincode Admin Approved' ||
      vendor.pincodeAdminApproval?.status === 'Approved' ||
      vendor.status === 'Pending KYC Review';

    if (isApprove && !hasPincodeApproval) {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve KYC: Vendor must first be approved by the responsible Pincode Admin (Stage 1 approval pending).'
      });
    }

    const decidedBy = `${req.user.name} (${req.user.role || 'KYC Team'})`;
    const decidedAt = new Date().toISOString();
    const effectiveReason = (rejectionReason || reason || '').trim();

    const isPaymentRequired = vendor.requiresSubscriptionPayment === true || vendor.requiresPayment === true;

    let updates = {};
    if (isApprove) {
      updates = {
        status: isPaymentRequired ? 'Payment Pending' : 'Active',
        approvalStatus: 'KYC_APPROVED',
        kycStatus: 'KYC Approved',
        isActive: !isPaymentRequired,
        isApproved: !isPaymentRequired,
        rejectionReason: null,
        kycVerifiedById: req.user.id || req.user._id,
        kycVerifiedByName: req.user.name,
        kycVerifiedByRole: req.user.role || 'KYC Team',
        kycVerifiedAt: decidedAt,
        kycTeamApproval: { status: 'Approved', decidedBy, decidedAt, rejectionReason: null }
      };
    } else if (isReject) {
      updates = {
        status: 'Rejected',
        approvalStatus: 'KYC_REJECTED',
        kycStatus: 'KYC Rejected',
        isActive: false,
        isApproved: false,
        rejectionReason: effectiveReason,
        kycVerifiedById: req.user.id || req.user._id,
        kycVerifiedByName: req.user.name,
        kycVerifiedByRole: req.user.role || 'KYC Team',
        kycVerifiedAt: decidedAt,
        kycTeamApproval: { status: 'Rejected', decidedBy, decidedAt, rejectionReason: effectiveReason }
      };
    } else {
      // Additional info required
      updates = {
        status: 'Additional Info Required',
        approvalStatus: 'ADDITIONAL_INFORMATION_REQUIRED',
        kycStatus: 'Additional Information Required',
        isActive: false,
        isApproved: false,
        pendingReason: effectiveReason,
        kycVerifiedById: req.user.id || req.user._id,
        kycVerifiedByName: req.user.name,
        kycVerifiedByRole: req.user.role || 'KYC Team',
        kycVerifiedAt: decidedAt,
        kycTeamApproval: { status: 'Additional Info Required', decidedBy, decidedAt, notes: effectiveReason }
      };
    }

    const updated = await db.vendors.findByIdAndUpdate(id, updates);
    const populated = await populateVendorLocations(updated);

    // Sync KYC records
    const kycRecord = (db.kycRecords || []).find(k => k.id === `KYC-${id}` || String(k.vendorId) === String(id));
    if (kycRecord) {
      await db.kycRecords.findByIdAndUpdate(kycRecord._id || kycRecord.id, {
        status: isApprove ? 'Verified' : isReject ? 'Rejected' : 'Pending',
        kycStatus: updates.kycStatus,
        approvalStatus: updates.approvalStatus,
        verifiedBy: decidedBy,
        verifiedDate: decidedAt.split('T')[0],
        rejectionReason: isReject ? effectiveReason : null,
        pendingReason: isAdditionalInfo ? effectiveReason : null,
        notes: isApprove ? 'KYC Clearance Completed. Merchant certified.' : isReject ? `KYC Rejected: ${effectiveReason}` : `Additional info required: ${effectiveReason}`
      });
    }

    // Sync to MongoDB users collection for Vendor Portal dashboard access
    try {
      const { getMongoDb } = require('../config/mongo');
      const mongoDb = await getMongoDb();
      if (mongoDb && vendor.email) {
        await mongoDb.collection('users').updateOne(
          { email: String(vendor.email).toLowerCase().trim() },
          {
            $set: {
              status: updates.status,
              approvalStatus: updates.approvalStatus,
              kycStatus: isApprove ? 'Verified' : updates.kycStatus,
              isActive: updates.isActive,
              isApproved: updates.isApproved,
              rejectionReason: isReject ? effectiveReason : null,
              kycTeamApproval: updates.kycTeamApproval,
              updatedAt: new Date()
            }
          }
        );
      }
    } catch (syncErr) {
      console.warn('Sync KYC status to users collection warning:', syncErr.message);
    }

    // Audit log
    await db.auditLogs.insertOne({
      action: isApprove ? 'VENDOR_KYC_APPROVED' : isReject ? 'VENDOR_KYC_REJECTED' : 'VENDOR_KYC_ADDITIONAL_INFO',
      recordId: id,
      userId: req.user?.id || req.user?._id,
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'KYC Team',
      details: isApprove
        ? `Vendor KYC approved by ${decidedBy}. Status is now ${updates.status}.`
        : isReject
        ? `KYC rejected: ${effectiveReason}`
        : `KYC additional information requested: ${effectiveReason}`,
      ip: req.ip || '127.0.0.1'
    });

    // Dispatch real-time notification
    try {
      notificationService.notifyVendorStatusChange({
        vendor: populated,
        oldStatus: vendor.kycStatus || vendor.status,
        newStatus: updates.status,
        user: req.user,
        notes: isApprove ? 'KYC Approved & Vendor Certified' : isReject ? `KYC Rejected: ${effectiveReason}` : `Additional Info Requested: ${effectiveReason}`
      });
    } catch (notifErr) {
      console.error('Failed to trigger KYC notification:', notifErr.message);
    }

    return res.json({
      success: true,
      message: isApprove
        ? `Vendor KYC approved successfully${isPaymentRequired ? ' (Payment Pending)' : ' and activated'}`
        : isReject
        ? 'Vendor KYC rejected'
        : 'Additional information requested from vendor',
      vendor: populated,
      data: populated
    });
  } catch (error) {
    console.error('Failed to verify KYC:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify KYC', error: error.message });
  }
};

// Resolve vendor onboarding source
function resolveVendorSource(v) {
  const regSource = String(v.registrationSource || v.source || '').toLowerCase();
  const createdVia = String(v.createdVia || v.onboardingSource || '').toLowerCase();
  const addedByRole = String(v.addedBy?.role || '').toLowerCase();

  // 1. Direct Registration check has first priority
  if (
    regSource.includes('direct') ||
    createdVia.includes('direct') ||
    regSource.includes('website') ||
    regSource.includes('self') ||
    v.onboardingSource === 'Direct'
  ) {
    return {
      type: 'Direct Registration',
      label: 'Direct Registration',
      directSource: v.source || 'Website / Self-Onboarding'
    };
  }

  // 2. Manager Onboarding check
  const hasValidManagerId = (v.managerId && v.managerId !== '-' && v.managerId !== 'Unassigned') ||
                           (v.onboardingManagerId && v.onboardingManagerId !== '-' && v.onboardingManagerId !== 'Unassigned');
  if (regSource === 'manager' || createdVia === 'manager' || hasValidManagerId || addedByRole.includes('manager')) {
    return {
      type: 'Manager',
      label: 'Manager Onboarding',
      managerId: v.managerId || v.onboardingManagerId,
      managerName: v.managerName || v.onboardingManager?.name || 'Field Manager'
    };
  }

  // 3. Agent Referral check
  const hasValidAgentId = (v.agentId && v.agentId !== '-' && v.agentId !== 'Unassigned') ||
                         (v.referredBy && v.referredBy !== '-' && v.referredBy !== 'Unassigned') ||
                         (v.onboardingAgentId && v.onboardingAgentId !== '-' && v.onboardingAgentId !== 'Unassigned');
  if (regSource === 'agent' || createdVia === 'agent' || hasValidAgentId || addedByRole.includes('agent')) {
    return {
      type: 'Agent',
      label: 'Agent Referral',
      agentId: v.agentId || v.referredBy || v.onboardingAgentId,
      agentName: v.agentName || v.referredByName || v.onboardingAgent?.name || 'Field Agent'
    };
  }

  return {
    type: 'Direct Registration',
    label: 'Direct Registration',
    directSource: v.source || 'Website / Self-Onboarding'
  };
}

function checkAdminApprovalAuthority(user, vendor) {
  if (!user || !vendor) return false;
  const role = String(user.role || '').toLowerCase().trim();
  const adminRole = String(user.adminRole || '').toLowerCase().trim();

  // Super Admin can approve
  if (role.includes('super admin') || role === 'admin' || adminRole === 'super-admin' || user.state === 'All India') {
    return true;
  }
  // Pincode Admin is the designated approval authority under current business workflow
  if (role.includes('pincode') || adminRole === 'pincode-admin') {
    const userPin = String(user.pincode || user.assignedPincode || '').trim();
    const vPin = String(vendor.pincode || '').trim();
    return Boolean(userPin && vPin && userPin === vPin);
  }
  return false;
}

// Consolidated Vendor Requests (consolidating Agent, Manager, Direct registrations)
const getVendorRequests = async (req, res) => {
  try {
    const user = req.user;
    const lookupCtx = buildVendorLookupContext();

    const vendorMap = new Map();
    // 1. In-memory db.vendors
    for (const v of (db.vendors || [])) {
      const k = String(v._id || v.id || v.email || '').toLowerCase().trim();
      if (k) vendorMap.set(k, v);
    }

    // 2. Pending vendor users in db.users (only if status is pending / under review)
    for (const u of (db.users || [])) {
      const uRole = String(u.role || '').toLowerCase();
      if (uRole.includes('vendor') || uRole.includes('seller') || uRole.includes('merchant')) {
        const uStatus = String(u.status || '').toLowerCase();
        const uApprStatus = String(u.approvalStatus || u.adminApprovalStatus || '').toLowerCase();
        const isPending = !uStatus || uStatus === 'submitted' || uStatus.includes('pending') || uStatus.includes('review') ||
                          uApprStatus.includes('pending') || uApprStatus.includes('review');
        if (isPending) {
          const k = String(u._id || u.id || u.email || '').toLowerCase().trim();
          if (k && !vendorMap.has(k)) {
            vendorMap.set(k, {
              _id: u._id,
              id: u._id || u.id,
              userId: u._id,
              name: u.name,
              businessName: u.businessName || u.name,
              contactPerson: u.name,
              phone: u.mobile || u.phone,
              mobile: u.mobile || u.phone,
              email: u.email,
              category: u.category || 'Retail & Services',
              address: u.address || `${u.district || ''}, ${u.state || ''} - ${u.pincode || ''}`.trim(),
              state: u.state,
              district: u.district,
              division: u.division,
              pincode: u.pincode,
              stateId: u.stateId || null,
              districtId: u.districtId || null,
              divisionId: u.divisionId || null,
              pincodeId: u.pincodeId || null,
              status: u.status || 'Under Review',
              approvalStatus: u.adminApprovalStatus === 'pending' ? 'Pending Pincode Admin Approval' : (u.status || 'Under Review'),
              registrationSource: u.registrationType === 'direct' ? 'Direct Registration' : (u.registrationSource || 'Direct Registration'),
              source: 'Direct Registration',
              createdAt: u.createdAt,
              updatedAt: u.updatedAt
            });
          }
        }
      }
    }

    // 3. Direct registration submissions from MongoDB Atlas businessrequests collection (uniquely keyed per request)
    try {
      const { getMongoDb } = require('../config/mongo');
      const mongoDb = await getMongoDb();
      if (mongoDb) {
        const bReqs = await mongoDb.collection('businessrequests').find({}).toArray();
        for (const b of bReqs) {
          const reqId = String(b._id);
          const k = `bizreq_${reqId.toLowerCase()}`;
          vendorMap.set(k, {
            _id: reqId,
            id: reqId,
            requestId: reqId,
            vendorId: b.vendorId ? String(b.vendorId) : reqId,
            userId: b.vendorId ? String(b.vendorId) : reqId,
            name: b.vendorName || b.businessName,
            businessName: b.businessName || b.vendorName,
            contactPerson: b.vendorName,
            phone: b.vendorPhone || b.phone,
            mobile: b.vendorPhone || b.phone,
            email: b.vendorEmail,
            category: b.businessCategory || b.vendorType || b.subcategory || 'Services',
            address: b.address,
            state: b.state,
            district: b.district,
            division: b.division || '',
            pincode: b.pincode,
            status: b.status || 'Pending Pincode Admin Review',
            approvalStatus: b.status || 'Pending Pincode Admin Review',
            registrationSource: 'Direct Registration',
            source: 'Direct Registration',
            createdAt: b.submittedDate || b.createdAt,
            updatedAt: b.updatedAt
          });
        }
      }
    } catch (bErr) {
      console.warn('[getVendorRequests] Atlas businessrequests lookup notice:', bErr.message);
    }

    const allVendors = Array.from(vendorMap.values());

    // 1. Enrich location fields before scoping so filterByLocation can match districtId/stateId
    const enrichedVendors = allVendors.map(v => populateVendorLocations(v, lookupCtx));
    const scoped = filterByLocation(enrichedVendors, user);

    // 2. Query filters
    const { status, source, state, district, division, pincode, search } = req.query;
    let filtered = scoped;

    if (status && status.trim().toLowerCase() !== 'all') {
      const sLow = status.trim().toLowerCase();
      filtered = filtered.filter(v => {
        const vSt = (v.approvalStatus || v.status || '').toLowerCase();
        if (sLow === 'pending') {
          return vSt.includes('pending') || vSt.includes('review') || !vSt || vSt === 'submitted';
        }
        if (sLow === 'approved') {
          return vSt.includes('approved') || vSt.includes('verified') || vSt === 'active';
        }
        if (sLow === 'rejected') {
          return vSt.includes('rejected');
        }
        return vSt === sLow;
      });
    }

    if (state && state.trim().toLowerCase() !== 'all') {
      filtered = filtered.filter(v => (v.state || '').toLowerCase() === state.trim().toLowerCase());
    }
    if (district && district.trim().toLowerCase() !== 'all') {
      filtered = filtered.filter(v => (v.district || '').toLowerCase() === district.trim().toLowerCase());
    }
    if (division && division.trim().toLowerCase() !== 'all') {
      const targetDiv = String(division).toLowerCase().replace(/\s+division$/i, '').trim();
      filtered = filtered.filter(v => String(v.division || '').toLowerCase().replace(/\s+division$/i, '').trim() === targetDiv);
    }
    if (pincode && String(pincode).trim().toLowerCase() !== 'all') {
      filtered = filtered.filter(v => String(v.pincode || '').trim() === String(pincode).trim());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(v =>
        (v.businessName && v.businessName.toLowerCase().includes(q)) ||
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.ownerName && v.ownerName.toLowerCase().includes(q)) ||
        (v.contactPerson && v.contactPerson.toLowerCase().includes(q)) ||
        (v.phone && v.phone.includes(q)) ||
        (v.pincode && v.pincode.includes(q)) ||
        (v.district && v.district.toLowerCase().includes(q))
      );
    }

    // 3. Format requests and consolidate sources
    const deduplicated = [];
    const seenIds = new Set();

    filtered.forEach(v => {
      const vId = String(v.id || v._id);
      if (seenIds.has(vId)) return;
      seenIds.add(vId);

      const pop = populateVendorLocations(v, lookupCtx);
      const srcInfo = resolveVendorSource(pop);
      const canApprove = checkAdminApprovalAuthority(user, pop);

      const reqDate = pop.createdAt || pop.registeredAt || pop.date || null;
      const formattedDate = reqDate ? new Date(reqDate).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
      }) : '—';

      const lastReview = pop.approvedAt || pop.adminPendingAt || pop.updatedAt || null;
      const formattedReviewDate = lastReview ? new Date(lastReview).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
      }) : '—';

      const rawBank = pop.bankDetails || {};
      const accountNumberRaw = pop.accountNumber || rawBank.accountNumber || '';
      const maskedAcc = accountNumberRaw ? maskAccount(accountNumberRaw) : '—';
      const bankDetails = {
        accountHolderName: pop.accountHolderName || rawBank.accountHolderName || pop.name || '—',
        bankName: pop.bankName || rawBank.bankName || '—',
        accountNumber: maskedAcc,
        ifscCode: pop.ifscCode || rawBank.ifscCode || pop.ifsc || '—',
        branchName: pop.branchName || rawBank.branchName || '—'
      };

      const rawDocs = pop.documents || pop.kycDocs || {};
      const documents = {
        aadharNumber: pop.aadharNumber || pop.aadhaarNumber ? ('XXXX-XXXX-' + String(pop.aadharNumber || pop.aadhaarNumber).slice(-4)) : null,
        panNumber: pop.panNumber ? maskPan(pop.panNumber) : null,
        gstNumber: pop.gst || pop.gstNumber ? maskGst(pop.gst || pop.gstNumber) : null,
        submittedDocs: Array.isArray(rawDocs) ? rawDocs : (rawDocs.submittedDocs || rawDocs.files || []),
        kycDocs: typeof rawDocs === 'object' ? rawDocs : {}
      };

      const onboardedByName = pop.onboardedByName || pop.addedBy?.name || pop.onboardingAgentName || (pop.agentName) || srcInfo.creatorName || (srcInfo.type === 'Direct' ? 'Direct Application' : 'Not Available');
      const onboardedByRole = pop.onboardedByRole || pop.addedBy?.role || pop.onboardingAgentRole || srcInfo.creatorRole || srcInfo.type;

      deduplicated.push({
        id: vId,
        _id: vId,
        canonicalId: vId,
        createdAt: reqDate,
        requestDateTime: formattedDate,
        registrationDate: formattedDate,
        vendorName: pop.contactPerson || pop.ownerName || pop.name || 'Vendor Owner',
        businessName: pop.businessName || pop.name || 'Store / Enterprise',
        category: pop.category || pop.businessType || 'Retail & Services',
        registrationSource: srcInfo.type,
        sourceLabel: srcInfo.label,
        sourceDetails: srcInfo,
        onboardedByName,
        onboardedByRole,
        address: pop.address || pop.storeAddress || pop.businessAddress || (pop.location ? pop.location : `${pop.division || ''}, ${pop.district || ''} - ${pop.pincode || ''}`.trim()) || '—',
        state: pop.state || 'Tamil Nadu',
        district: pop.district || '—',
        division: pop.division || '—',
        pincode: pop.pincode || '—',
        phone: pop.phone || pop.mobile || '—',
        email: pop.email || '—',
        contactDetails: {
          phone: pop.phone || pop.mobile || '—',
          email: pop.email || '—',
          contactPerson: pop.contactPerson || pop.ownerName || pop.name || '—'
        },
        bankDetails,
        documents,
        panNumber: pop.panNumber ? maskPan(pop.panNumber) : null,
        aadharNumber: pop.aadharNumber || pop.aadhaarNumber ? ('XXXX-XXXX-' + String(pop.aadharNumber || pop.aadhaarNumber).slice(-4)) : null,
        gst: pop.gst || pop.gstNumber ? maskGst(pop.gst || pop.gstNumber) : null,
        approvalStatus: pop.approvalStatus || pop.status || 'Pending Pincode Admin Approval',
        status: pop.status || 'Under Review',
        approvedByAdminName: pop.approvedByName || (pop.pincodeAdminApproval?.adminName) || null,
        approvedByAdminRole: pop.approvedByRole || (pop.pincodeAdminApproval?.adminRole) || null,
        lastReviewDate: formattedReviewDate,
        reviewerReason: pop.reviewerReason || pop.pendingReason || pop.rejectionReason || null,
        reviewHistory: Array.isArray(pop.reviewHistory) ? pop.reviewHistory : [],
        canApprove
      });
    });

    let finalRequests = deduplicated;
    if (source && source !== 'All') {
      finalRequests = finalRequests.filter(r => r.registrationSource.toLowerCase() === source.toLowerCase());
    }

    // Sort newest first
    finalRequests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.json({
      success: true,
      count: finalRequests.length,
      total: finalRequests.length,
      requests: finalRequests,
      data: finalRequests
    });
  } catch (error) {
    console.error('Failed to get vendor requests:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch vendor requests', error: error.message });
  }
};

const keepPendingVendor = async (req, res) => {
  req.body.action = 'pending';
  return pincodeAdminVerifyVendor(req, res);
};

module.exports = {
  getVendors,
  getVendorById,
  getVendorRequests,
  createVendor,
  updateVendor,
  updateVendorStatus,
  lookupPincode,
  pincodeAdminVerifyVendor,
  keepPendingVendor,
  kycVerifyVendor,
  resolveVendorSource,
  checkAdminApprovalAuthority,
  formatActorRole,
  isFullyOnboardedVendor
};
