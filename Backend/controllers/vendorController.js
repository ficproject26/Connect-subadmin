const { db, filterByLocation } = require('../config/db');
const { resolvePincodeHierarchy } = require('../utils/pincodeMapping');
const { getScopeFilter, isVendorInScope } = require('../middleware/scopeMiddleware');
const notificationService = require('../services/notificationService');
const bcrypt = require('bcryptjs');

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

// Helper to format role titles cleanly
function formatActorRole(role, fallbackType = 'Manager') {
  if (!role) return fallbackType === 'Agent' ? 'Pincode Agent' : 'Pincode Manager';
  const r = String(role).toLowerCase().replace(/_/g, ' ').trim();
  if (r.includes('pincode') && r.includes('manager')) return 'Pincode Manager';
  if (r.includes('divis') && r.includes('manager')) return 'Divisional Manager';
  if (r.includes('dist') && r.includes('manager')) return 'District Manager';
  if (r.includes('state') && r.includes('manager')) return 'State Manager';
  if (r === 'manager') return 'Field Manager';
  if (r.includes('pincode') && r.includes('agent')) return 'Pincode Agent';
  if (r.includes('divis') && r.includes('agent')) return 'Divisional Agent';
  if (r.includes('dist') && r.includes('agent')) return 'District Agent';
  if (r.includes('state') && r.includes('agent')) return 'State Agent';
  if (r.includes('agent')) return 'Pincode Agent';
  if (r.includes('pincode') && r.includes('admin')) return 'Pincode Admin';
  if (r.includes('divis') && r.includes('admin')) return 'Divisional Admin';
  if (r.includes('dist') && r.includes('admin')) return 'District Admin';
  if (r.includes('state') && r.includes('admin')) return 'State Admin';
  if (r.includes('super') && r.includes('admin')) return 'Super Admin';
  return role;
}

// Helper: Resolve who onboarded this vendor (Actor / Creator)
function resolveOnboardedBy(vendor) {
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

  const allAgents = Array.from(db.agents || []);
  const allUsers = Array.from(db.users || []);
  const allManagers = Array.from(db.managers || []);

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

  // 1. Cross-reference actor in db.users or db.managers (highest priority for real credentials/role)
  if (actorKey) {
    const matchedUser = allUsers.find(u => {
      const uId = String(u._id || u.id || '').trim().toLowerCase();
      const uLogin = String(u.loginId || u.email || '').trim().toLowerCase();
      return uId === actorKey || uLogin === actorKey;
    }) || allManagers.find(m => {
      const mId = String(m._id || m.id || '').trim().toLowerCase();
      const mCode = String(m.employeeCode || '').trim().toLowerCase();
      return mId === actorKey || mCode === actorKey;
    });

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

    // 2. Check in db.agents
    const matchedAgent = allAgents.find(a => {
      const aId = String(a._id || a.id || '').trim().toLowerCase();
      const aReg = String(a.registrationId || a.agentCode || '').trim().toLowerCase();
      const aName = String(a.name || '').trim().toLowerCase();
      return aId === actorKey || aReg === actorKey || aName === actorKey;
    });

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
    const roleTitle = formatActorRole(rawRole);
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
    // If erroneously tagged as Admin but ID is a manager ID
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
  const kycRec = (db.kycRecords || []).find(k => k.id === `KYC-${vIdStr}` || String(k.vendorId) === vIdStr);
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
function resolveVendorKycStatus(vendor) {
  const vIdStr = String(vendor._id || vendor.id || '');
  const kycRec = (db.kycRecords || []).find(k => k.id === `KYC-${vIdStr}` || String(k.vendorId) === vIdStr);

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
const populateVendorLocations = async (vendor) => {
  const [state, district, division, pincode] = await Promise.all([
    vendor.stateId ? db.states.findById(vendor.stateId) : (vendor.state ? db.states.findOne({ name: vendor.state }) : null),
    vendor.districtId ? db.districts.findById(vendor.districtId) : (vendor.district ? db.districts.findOne({ name: vendor.district }) : null),
    vendor.divisionId ? db.divisions.findById(vendor.divisionId) : (vendor.division ? db.divisions.findOne({ name: vendor.division }) : null),
    vendor.pincodeId ? db.pincodes.findById(vendor.pincodeId) : (vendor.pincode ? db.pincodes.findOne({ code: vendor.pincode }) : null)
  ]);

  const stateName = vendor.state || state?.name || '';
  const districtName = vendor.district || district?.name || '';
  const divisionName = vendor.division || division?.name || '';
  const pincodeCode = vendor.pincode || pincode?.code || '';
  const pincodeArea = pincode?.areaName || vendor.address || '';

  const addedBy = resolveOnboardedBy(vendor);
  const kycStatus = resolveVendorKycStatus(vendor);
  const approvalStatus = vendor.approvalStatus || ((vendor.status === 'Active' || vendor.status === 'Approved') ? 'Approved' : 'Pending');

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
    onboardedBy: addedBy.id,
    onboardedByInfo: addedBy,
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
    const user = req.user;
    const allVendors = Array.from(db.vendors);

    // Apply location filtering matching caller's scope
    let scoped = filterByLocation(allVendors, user);

    // Extract query parameters
    const {
      search,
      category,
      subCategory,
      status,
      kycStatus,
      districtId,
      divisionId,
      pincodeId,
      page,
      limit,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

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
        const matchesDist = (v.district || '').toLowerCase().includes(q);
        const matchesDiv = (v.division || '').toLowerCase().includes(q);

        if (!matchesName && !matchesBiz && !matchesContact && !matchesMobile && !matchesPin && !matchesCat && !matchesDist && !matchesDiv) {
          return false;
        }
      }

      // 2. Category & Subcategory
      if (category && category !== 'All' && (v.category || '').toLowerCase() !== category.toLowerCase()) return false;
      if (subCategory && subCategory !== 'All' && (v.subCategory || '').toLowerCase() !== subCategory.toLowerCase()) return false;

      // 3. Status filter
      if (status && status !== 'All' && (v.status || '').toLowerCase() !== status.toLowerCase()) return false;
      if (kycStatus && kycStatus !== 'All' && (v.kycStatus || '').toLowerCase() !== kycStatus.toLowerCase()) return false;

      // 4. Sub-location filters
      if (districtId && v.districtId !== districtId) return false;
      if (divisionId && v.divisionId !== divisionId) return false;
      if (pincodeId && v.pincodeId !== pincodeId) return false;

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

    // Populate vendors
    const populated = await Promise.all(pagedVendors.map(populateVendorLocations));

    return res.json({
      success: true,
      count: totalVendors,
      total: totalVendors,
      vendors: populated,   // Sub_Admin_Management portal expects `vendors`
      data: populated,      // Manager portal expects `data`
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
    const { status, statusNotes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const vendor = await db.vendors.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const updated = await db.vendors.findByIdAndUpdate(id, {
      status,
      statusNotes: statusNotes || vendor.statusNotes
    });

    await db.auditLogs.insertOne({
      action: 'VENDOR_STATUS_UPDATED',
      recordId: id,
      userId: req.user?.id || req.user?._id,
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'Manager',
      details: `Vendor status transitioned from '${vendor.status}' to '${status}'. Notes: ${statusNotes || 'None'}`,
      ip: req.ip || '127.0.0.1'
    });

    const populated = await populateVendorLocations(updated);

    // Dispatch real-time notification
    try {
      notificationService.notifyVendorStatusChange({
        vendor: populated,
        oldStatus: vendor.status,
        newStatus: status,
        user: req.user,
        notes: statusNotes
      });
    } catch (notifErr) {
      console.error('Failed to trigger vendor status notification:', notifErr.message);
    }

    return res.json({
      success: true,
      message: `Vendor status updated to ${status}`,
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

    const vendor = await db.vendors.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (!['Accept', 'Reject', 'accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be Accept or Reject' });
    }

    const isReject = action.toLowerCase() === 'reject';
    if (isReject && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({ success: false, message: 'Rejection reason is mandatory when rejecting vendor' });
    }

    const decidedBy = `${req.user.name} (${req.user.role || 'Pincode Admin'})`;
    const decidedAt = new Date().toISOString();

    const updates = isReject
      ? {
          status: 'Rejected',
          approvalStatus: 'Pincode Admin Rejected',
          kycStatus: 'Pincode Admin Rejected',
          approvedById: req.user.id || req.user._id,
          approvedByName: req.user.name,
          approvedByRole: req.user.role || 'Pincode Admin',
          approvedAt: decidedAt,
          pincodeAdminApproval: { status: 'Rejected', decidedBy, decidedAt, rejectionReason: rejectionReason.trim() }
        }
      : {
          status: 'Pending KYC Review',
          approvalStatus: 'Pincode Admin Approved',
          kycStatus: 'KYC Pending',
          approvedById: req.user.id || req.user._id,
          approvedByName: req.user.name,
          approvedByRole: req.user.role || 'Pincode Admin',
          approvedAt: decidedAt,
          pincodeAdminApproval: { status: 'Approved', decidedBy, decidedAt, rejectionReason: null }
        };

    const updated = await db.vendors.findByIdAndUpdate(id, updates);

    // Sync KYC records
    const kycRecord = (db.kycRecords || []).find(k => k.id === `KYC-${id}` || k.vendorId === id);
    if (kycRecord) {
      await db.kycRecords.findByIdAndUpdate(kycRecord._id || kycRecord.id, {
        status: updates.kycStatus,
        verifiedBy: decidedBy,
        verifiedDate: decidedAt.split('T')[0],
        notes: isReject ? `Rejected by Pincode Admin: ${rejectionReason.trim()}` : 'Approved by Pincode Admin. Forwarded to KYC Team.'
      });
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

    const populated = await populateVendorLocations(updated);

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
    const { action, rejectionReason } = req.body;

    const vendor = await db.vendors.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (!['Approve', 'Reject', 'approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be Approve or Reject' });
    }

    const isReject = action.toLowerCase() === 'reject';
    if (isReject && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({ success: false, message: 'Rejection reason is mandatory when rejecting KYC' });
    }

    const decidedBy = `${req.user.name} (${req.user.role || 'KYC Team'})`;
    const decidedAt = new Date().toISOString();

    const updates = isReject
      ? {
          status: 'KYC Rejected',
          approvalStatus: 'KYC Rejected',
          kycStatus: 'KYC Rejected',
          kycVerifiedById: req.user.id || req.user._id,
          kycVerifiedByName: req.user.name,
          kycVerifiedByRole: req.user.role || 'KYC Team',
          kycVerifiedAt: decidedAt,
          kycTeamApproval: { status: 'Rejected', decidedBy, decidedAt, rejectionReason: rejectionReason.trim() }
        }
      : {
          status: 'Active',
          approvalStatus: 'KYC Approved',
          kycStatus: 'KYC Approved',
          kycVerifiedById: req.user.id || req.user._id,
          kycVerifiedByName: req.user.name,
          kycVerifiedByRole: req.user.role || 'KYC Team',
          kycVerifiedAt: decidedAt,
          kycTeamApproval: { status: 'Approved', decidedBy, decidedAt, rejectionReason: null }
        };

    const updated = await db.vendors.findByIdAndUpdate(id, updates);

    // Sync KYC records
    const kycRecord = (db.kycRecords || []).find(k => k.id === `KYC-${id}` || k.vendorId === id);
    if (kycRecord) {
      await db.kycRecords.findByIdAndUpdate(kycRecord._id || kycRecord.id, {
        status: updates.kycStatus,
        verifiedBy: decidedBy,
        verifiedDate: decidedAt.split('T')[0],
        notes: isReject ? `KYC Rejected: ${rejectionReason.trim()}` : 'KYC Clearance Completed. Merchant certified.'
      });
    }

    // Audit log
    await db.auditLogs.insertOne({
      action: isReject ? 'VENDOR_KYC_REJECTED' : 'VENDOR_KYC_APPROVED',
      recordId: id,
      userId: req.user?.id || req.user?._id,
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'Admin',
      details: isReject ? `KYC rejected: ${rejectionReason.trim()}` : `Vendor KYC approved. Status is now Active.`,
      ip: req.ip || '127.0.0.1'
    });

    const populated = await populateVendorLocations(updated);

    // Dispatch real-time notification
    try {
      notificationService.notifyVendorStatusChange({
        vendor: populated,
        oldStatus: vendor.kycStatus || vendor.status,
        newStatus: updates.status,
        user: req.user,
        notes: isReject ? `KYC Rejected: ${rejectionReason.trim()}` : 'KYC Approved & Vendor Activated'
      });
    } catch (notifErr) {
      console.error('Failed to trigger KYC notification:', notifErr.message);
    }

    return res.json({
      success: true,
      message: isReject ? 'Vendor KYC rejected' : 'Vendor KYC approved successfully',
      vendor: populated,
      data: populated
    });
  } catch (error) {
    console.error('Failed to verify KYC:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify KYC', error: error.message });
  }
};

module.exports = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  updateVendorStatus,
  lookupPincode,
  pincodeAdminVerifyVendor,
  kycVerifyVendor
};
