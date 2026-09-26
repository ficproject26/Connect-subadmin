const { db } = require('../config/db');
const bcrypt = require('bcryptjs');

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

// Check if an admin and a manager share the same state
const matchesState = (admin, manager) => {
  if (!admin || !manager) return false;
  const adminState = (admin.state || '').trim().toLowerCase();
  if (!adminState || adminState === 'all india') return true;
  const mgrState = (manager.state || manager.assignedState || '').trim().toLowerCase();
  if (adminState && mgrState && adminState === mgrState) return true;
  const adminStateId = String(admin.stateId || '').trim().toLowerCase();
  const mgrStateId = String(manager.stateId || manager.assignedStateId || '').trim().toLowerCase();
  if (adminStateId && mgrStateId && adminStateId === mgrStateId) return true;
  return false;
};

// Check if an admin and a manager share the same district
const matchesDistrict = (admin, manager) => {
  if (!admin || !manager) return false;
  if (!matchesState(admin, manager)) return false;

  const adminDist = (admin.district || '').trim().toLowerCase();
  if (!adminDist || adminDist === 'all districts') return true;
  const mgrDist = (manager.district || manager.assignedDistrict || '').trim().toLowerCase();
  if (adminDist && mgrDist && adminDist === mgrDist) return true;
  const adminDistId = String(admin.districtId || '').trim().toLowerCase();
  const mgrDistId = String(manager.districtId || manager.assignedDistrictId || '').trim().toLowerCase();
  if (adminDistId && mgrDistId && adminDistId === mgrDistId) return true;
  return false;
};

// Check if an admin and a manager share the same division
const matchesDivision = (admin, manager) => {
  if (!admin || !manager) return false;
  if (!matchesDistrict(admin, manager)) return false;

  const adminDiv = (admin.division || '').trim().toLowerCase();
  if (!adminDiv || adminDiv === 'all divisions') return true;
  const mgrDiv = (manager.division || manager.assignedDivision || '').trim().toLowerCase();
  if (adminDiv && mgrDiv && adminDiv === mgrDiv) return true;
  const adminDivId = String(admin.divisionId || '').trim().toLowerCase();
  const mgrDivId = String(manager.divisionId || manager.assignedDivisionId || '').trim().toLowerCase();
  if (adminDivId && mgrDivId && adminDivId === mgrDivId) return true;
  return false;
};

// Check if an admin and a manager share the same pincode
const matchesPincode = (admin, manager) => {
  if (!admin || !manager) return false;
  if (!matchesDivision(admin, manager)) return false;

  const adminPin = String(admin.pincode || '').trim();
  if (!adminPin || adminPin === 'all') return true;
  const mgrPin = String(manager.pincode || manager.assignedPincode || '').trim();
  if (adminPin && mgrPin && adminPin === mgrPin) return true;
  const adminPinId = String(admin.pincodeId || '').trim().toLowerCase();
  const mgrPinId = String(manager.pincodeId || manager.assignedPincodeId || '').trim().toLowerCase();
  if (adminPinId && mgrPinId && adminPinId === mgrPinId) return true;
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

// Returns true if admin is the exact related administrator for this manager's role and jurisdiction
const isRelatedAdminForManager = (admin, manager) => {
  if (!admin || !manager) return false;
  const adminRole = (admin.role || '').trim();
  const adminRoleLower = adminRole.toLowerCase().replace(/_/g, ' ');

  if (adminRoleLower === 'super admin' || adminRoleLower === 'admin') return true;

  if (manager.role === 'state_manager') {
    return adminRoleLower.includes('state') && matchesState(admin, manager);
  }
  if (manager.role === 'district_manager') {
    return adminRoleLower.includes('district') && matchesDistrict(admin, manager);
  }
  if (manager.role === 'division_manager') {
    return (adminRoleLower.includes('division') || adminRoleLower.includes('divisional')) && matchesDivision(admin, manager);
  }
  if (manager.role === 'pincode_manager') {
    return adminRoleLower.includes('pincode') && matchesPincode(admin, manager);
  }
  return false;
};

// Check if an Administrator has jurisdiction to view / manage a Field Manager
const canAdminManage = (admin, manager) => {
  const adminRole = (admin.role || '').trim();
  const adminRoleLower = adminRole.toLowerCase().replace(/_/g, ' ');

  // Super Admin can manage anyone
  if (adminRoleLower === 'super admin' || adminRoleLower === 'admin') return true;

  const managerRoles = ['state_manager', 'district_manager', 'division_manager', 'pincode_manager'];
  if (!managerRoles.includes(manager.role)) return false;

  const isPending = manager.status === 'under_review' || manager.status === 'pending' || manager.adminApprovalStatus === 'pending';

  // For pending registration requests:
  // Must go directly to the related administrator for this jurisdiction level
  if (isPending) {
    if (isRelatedAdminForManager(admin, manager)) return true;

    // Check if an exact admin exists in the system for this manager's jurisdiction
    const hasAssignedExactAdmin = Array.from(db.users).some(u => 
      (u.role || '').toLowerCase().includes('admin') && isRelatedAdminForManager(u, manager)
    );

    // If an exact admin exists, only that admin receives the request
    if (hasAssignedExactAdmin) return false;

    // Fallback: If no admin has been created yet at this exact tier, allow parent admin within the same state/district
    if (adminRoleLower.includes('state')) {
      return matchesState(admin, manager);
    }
    if (adminRoleLower.includes('district')) {
      return (manager.role === 'division_manager' || manager.role === 'pincode_manager') && matchesDistrict(admin, manager);
    }
    if (adminRoleLower.includes('division') || adminRoleLower.includes('divisional')) {
      return manager.role === 'pincode_manager' && matchesDivision(admin, manager);
    }
    return false;
  }

  // For active / approved managers: hierarchical territorial oversight
  if (adminRoleLower.includes('state')) {
    return matchesState(admin, manager);
  }

  if (adminRoleLower.includes('district')) {
    if (manager.role === 'state_manager') return false;
    return matchesDistrict(admin, manager);
  }

  if (adminRoleLower.includes('division') || adminRoleLower.includes('divisional')) {
    if (manager.role === 'state_manager' || manager.role === 'district_manager') return false;
    return matchesDivision(admin, manager);
  }

  if (adminRoleLower.includes('pincode')) {
    if (manager.role !== 'pincode_manager') return false;
    return matchesPincode(admin, manager);
  }

  return false;
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

  const resolvedState = state?.name || m.state || null;
  const resolvedDistrict = district?.name || m.district || null;
  const resolvedDivision = division?.name || m.division || null;
  const resolvedPincode = pincode?.code || m.pincode || null;

  const targetAdminRole = getRelatedAdminRole(m.role);
  let resolvedTargetAdminName = m.targetAdminName || null;
  if (!resolvedTargetAdminName && targetAdminRole) {
    const matchedAdmin = Array.from(db.users).find(u => isRelatedAdminForManager(u, m));
    if (matchedAdmin) resolvedTargetAdminName = matchedAdmin.name;
  }

  const canApprove = isRelatedAdminForManager(user, m);

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
    targetAdminRole,
    targetAdminName: resolvedTargetAdminName || 'Pending Admin Assignment',
    targetJurisdiction: m.targetJurisdiction || (resolvedPincode ? `PIN: ${resolvedPincode}` : resolvedDivision ? `${resolvedDivision} Division` : resolvedDistrict ? `${resolvedDistrict} District` : `${resolvedState || 'State'} Jurisdiction`),
    canApprove,
    kycStatus: m.kycStatus || (status === 'active' ? 'Verified' : 'pending_verification'),
    rejectionReason: m.rejectionReason || null,
    adminApprovedBy: m.adminApprovedBy || null,
    adminApprovedAt: m.adminApprovedAt || null,
    adminRejectedBy: m.adminRejectedBy || null,
    adminRejectedAt: m.adminRejectedAt || null,
    dob: m.dob || null,
    gender: m.gender || null,
    address: m.address || null,
    documents: m.documents || {},
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
      : resolvedState || 'Tamil Nadu',
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
    const allUsers = Array.from(db.users);
    const currentUserId = String(user.id || user._id);
    const rawRole = user.role || '';
    const roleLower = rawRole.toLowerCase().replace(/_/g, ' ');

    let rawPeers = [];
    let rawSubordinates = [];

    if (roleLower.includes('admin')) {
      // Caller is an Administrator: view all managers subordinate to this Admin
      rawSubordinates = allUsers.filter(u => canAdminManage(user, u));
    } else {
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
    const { level, status, search } = req.query;
    if (level) {
      const levelMap = {
        'state': 'state_manager',
        'district': 'district_manager',
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

    // Optional query parameter filtering: status (active, under_review, pending, rejected)
    if (status) {
      const statusLower = status.toLowerCase();
      rawSubordinates = rawSubordinates.filter(m => {
        const s = (m.status || 'active').toLowerCase();
        if (statusLower === 'pending' || statusLower === 'under_review') {
          return s === 'under_review' || s === 'pending' || s === 'pending_admin_approval';
        }
        return s === statusLower;
      });
      rawPeers = rawPeers.filter(m => (m.status || 'active').toLowerCase() === statusLower);
    }

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

    const pendingCount = subordinates.filter(m => m.status === 'under_review' || m.status === 'pending' || m.status === 'pending_admin_approval').length;
    const activeCount = subordinates.filter(m => m.status === 'active').length;

    res.json({
      success: true,
      count: all.length,
      data: subordinates,
      subordinates,
      peers,
      all,
      stats: {
        total: all.length,
        pendingApprovals: pendingCount,
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

// GET /api/managers/:id - Retrieve specific manager details
const getManagerById = async (req, res) => {
  try {
    const { id } = req.params;
    const allUsers = Array.from(db.users);
    const manager = allUsers.find(u => String(u._id || u.id) === String(id));

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
    const allUsers = Array.from(db.users);
    const manager = allUsers.find(u => String(u._id || u.id) === String(id));

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    // Verify admin jurisdiction
    if (!canAdminManage(req.user, manager)) {
      const targetRole = getRelatedAdminRole(manager.role);
      const targetPlace = manager.pincode ? `Pincode ${manager.pincode}` : manager.division ? `${manager.division} Division` : manager.district ? `${manager.district} District` : `${manager.state || 'State'} Jurisdiction`;
      return res.status(403).json({
        success: false,
        message: `You do not have administrative authority to approve ${manager.name} (${formatRoleTitle(manager.role)}). Registration requests for this jurisdiction must be approved by the designated ${targetRole} for ${targetPlace}.`
      });
    }

    // Update status to active, adminApprovalStatus to approved, and kycStatus to Verified (skip KYC for now)
    manager.status = 'active';
    manager.adminApprovalStatus = 'approved';
    manager.kycStatus = 'Verified';
    manager.adminApprovedBy = req.user.name || req.user.email;
    manager.adminApprovedById = req.user.id || req.user._id;
    manager.adminApprovedByRole = req.user.role;
    manager.adminApprovedAt = new Date().toISOString();
    manager.rejectionReason = null;
    manager.updatedAt = new Date().toISOString();

    await db.users.update(manager);

    // Audit log entry
    await db.auditLogs.insertOne({
      action: 'MANAGER_REGISTRATION_APPROVED_BY_ADMIN',
      adminId: req.user.id || req.user._id,
      adminName: req.user.name,
      adminRole: req.user.role,
      targetUserId: manager._id || manager.id,
      targetUserName: manager.name,
      targetUserRole: manager.role,
      details: `${manager.role.replace('_', ' ')} "${manager.name}" was approved by ${req.user.role} "${req.user.name}". Account is now active.`,
      ip: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    const populated = await populateManager(manager, 'subordinate', req.user);

    return res.json({
      success: true,
      message: `Registration for ${manager.name} (${formatRoleTitle(manager.role)}) has been accepted and approved by ${req.user.role}. Account is now Active and login is enabled.`,
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
    const allUsers = Array.from(db.users);
    const manager = allUsers.find(u => String(u._id || u.id) === String(id));

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    // Verify admin jurisdiction
    if (!canAdminManage(req.user, manager)) {
      const targetRole = getRelatedAdminRole(manager.role);
      const targetPlace = manager.pincode ? `Pincode ${manager.pincode}` : manager.division ? `${manager.division} Division` : manager.district ? `${manager.district} District` : `${manager.state || 'State'} Jurisdiction`;
      return res.status(403).json({
        success: false,
        message: `You do not have administrative authority to reject ${manager.name} (${formatRoleTitle(manager.role)}). Registration requests for this jurisdiction must be handled by the designated ${targetRole} for ${targetPlace}.`
      });
    }

    const rejectionReason = (reason || '').trim() || 'Registration credentials or KYC documents did not meet the required criteria.';

    // Update status to rejected
    manager.status = 'rejected';
    manager.adminApprovalStatus = 'rejected';
    manager.rejectionReason = rejectionReason;
    manager.adminRejectedBy = req.user.name || req.user.email;
    manager.adminRejectedById = req.user.id || req.user._id;
    manager.adminRejectedByRole = req.user.role;
    manager.adminRejectedAt = new Date().toISOString();
    manager.updatedAt = new Date().toISOString();

    await db.users.update(manager);

    // Audit log entry
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
    });

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

    const mgrName = (name || fullName || '').trim();
    const mgrEmail = (email || '').trim().toLowerCase();
    const mgrMobile = (mobile || phone || '').trim();
    const adminRoleLower = (req.user.role || '').toLowerCase().replace(/_/g, ' ');
    const isSuperAdmin = adminRoleLower === 'super admin' || adminRoleLower.includes('super');
    const isStateAdmin = adminRoleLower.includes('state') && !adminRoleLower.includes('manager');
    const isDistrictAdmin = adminRoleLower.includes('district') && !adminRoleLower.includes('manager');
    const isDivisionalAdmin = (adminRoleLower.includes('division') || adminRoleLower.includes('divisional')) && !adminRoleLower.includes('manager');
    const isPincodeAdmin = adminRoleLower.includes('pincode') && !adminRoleLower.includes('manager');

    // Role Authorization:
    // - Super Admin: can add any manager role
    // - State Admin: can add state_manager, district_manager, division_manager, pincode_manager within their assigned state
    // - District Admin: can add district_manager, division_manager, pincode_manager within their assigned district
    // - Divisional Admin: can add division_manager, pincode_manager within their assigned division
    // - Pincode Admin: can add pincode_manager within their assigned pincode
    const validRoles = ['state_manager', 'district_manager', 'division_manager', 'pincode_manager'];
    let mgrRole = role || 'state_manager';
    if (!validRoles.includes(mgrRole)) {
      mgrRole = 'state_manager';
    }

    if (isStateAdmin) {
      // State Admin can add any manager tier within their state
    } else if (isDistrictAdmin) {
      if (mgrRole === 'state_manager') {
        return res.status(403).json({ success: false, message: 'District Admin cannot add State Managers.' });
      }
    } else if (isDivisionalAdmin) {
      if (mgrRole === 'state_manager' || mgrRole === 'district_manager') {
        return res.status(403).json({ success: false, message: 'Division Admin can only add Division or Pincode Managers.' });
      }
    } else if (isPincodeAdmin) {
      if (mgrRole !== 'pincode_manager') {
        return res.status(403).json({ success: false, message: 'Pincode Admin can only add Pincode Managers.' });
      }
    } else if (!isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Only administrators can add managers.' });
    }

    if (!mgrName) return res.status(400).json({ success: false, message: 'Manager name is required.' });
    if (!mgrEmail) return res.status(400).json({ success: false, message: 'Email address is required.' });
    if (!mgrMobile) return res.status(400).json({ success: false, message: 'Mobile number is required.' });

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
    let state = (assignedState || homeState || req.user.state || 'Tamil Nadu').trim();
    let stateId = req.body.assignedStateId || req.body.stateId || null;
    let district = (assignedDistrict || homeDistrict || '').trim() || null;
    let districtId = req.body.assignedDistrictId || req.body.districtId || null;
    let division = (assignedDivision || '').trim() || null;
    let divisionId = req.body.assignedDivisionId || req.body.divisionId || null;
    let pincode = (assignedPincode || homePincode || '').trim() || null;
    let pincodeId = req.body.assignedPincodeId || req.body.pincodeId || null;

    if (isStateAdmin && req.user.state && req.user.state.toLowerCase() !== 'all india') {
      state = req.user.state;
      stateId = req.user.stateId || stateId;
    } else if (isDistrictAdmin) {
      state = req.user.state || state;
      stateId = req.user.stateId || stateId;
      district = req.user.district || district;
      districtId = req.user.districtId || districtId;
    } else if (isDivisionalAdmin) {
      state = req.user.state || state;
      stateId = req.user.stateId || stateId;
      district = req.user.district || district;
      districtId = req.user.districtId || districtId;
      division = req.user.division || division;
      divisionId = req.user.divisionId || divisionId;
    } else if (isPincodeAdmin) {
      state = req.user.state || state;
      stateId = req.user.stateId || stateId;
      district = req.user.district || district;
      districtId = req.user.districtId || districtId;
      division = req.user.division || division;
      divisionId = req.user.divisionId || divisionId;
      pincode = req.user.pincode || pincode;
      pincodeId = req.user.pincodeId || pincodeId;
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

    const newManager = {
      _id: newId,
      id: newId,
      name: mgrName,
      email: mgrEmail,
      mobile: mgrMobile,
      phone: mgrMobile,
      loginId: loginId || mgrEmail,
      passwordHash,
      role: mgrRole,
      level,
      status: 'active',
      registrationType: 'admin',
      adminApprovalStatus: 'approved',
      adminApprovedBy: req.user.name || req.user.email,
      adminApprovedById: req.user.id || req.user._id,
      adminApprovedByRole: req.user.role,
      adminApprovedAt: now,
      kycStatus: 'Verified',
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
      aadharNumber: aadharNumber || null,
      panNumber: panNumber || null,
      bankDetails: {
        accountHolderName: accountHolderName || mgrName,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        ifscCode: ifscCode || null,
        branchName: branchName || null
      },
      documents: {
        aadharNumber: aadharNumber || null,
        panNumber: panNumber || null
      },
      createdByAdmin: req.user.name || req.user.email,
      createdById: req.user.id || req.user._id,
      createdByRole: req.user.role,
      createdAt: now,
      updatedAt: now
    };

    await db.users.insertOne(newManager);

    // Audit log
    await db.auditLogs.insertOne({
      action: 'MANAGER_CREATED',
      adminId: req.user.id || req.user._id,
      adminName: req.user.name,
      adminRole: req.user.role,
      targetUserId: newManager._id,
      targetUserName: newManager.name,
      targetUserRole: newManager.role,
      details: `${formatRoleTitle(newManager.role)} "${newManager.name}" registered and activated by ${req.user.role} "${req.user.name}".`,
      ip: req.ip || '127.0.0.1',
      timestamp: now
    });

    const populated = await populateManager(newManager, 'subordinate', req.user);

    return res.json({
      success: true,
      message: `${formatRoleTitle(newManager.role)} "${newManager.name}" registered successfully. Account is active and login is enabled.`,
      manager: populated
    });
  } catch (err) {
    console.error('Add manager error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add manager', error: err.message });
  }
};

module.exports = {
  getLowerLevelManagers,
  getManagerById,
  approveManager,
  rejectManager,
  addManager
};
