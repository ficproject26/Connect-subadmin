const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, filterByLocation, syncHierarchyFromDatabase } = require('../config/db');
const {
  getDistrictsForState,
  getDivisionsForDistrict,
  getPincodesForDivision,
  ALL_INDIAN_STATES
} = require('../data/indiaPostalData');

// Explicit Sub-Admin capacity limits per jurisdiction
const SUB_ADMIN_LIMITS = {
  'State Admin': 4,       // Exactly/up to 4 State Sub-Admins per state
  'District Admin': 1,    // Exactly 1 District Sub-Admin per district
  'Divisional Admin': 1,  // Exactly 1 Division Sub-Admin per division
  'Division Admin': 1,
  'Pincode Admin': 1      // Exactly 1 Pincode Sub-Admin per PIN code
};

function syncHierarchyWithUsers() {
  if (typeof syncHierarchyFromDatabase === 'function') {
    syncHierarchyFromDatabase();
  }
}

function getHierarchy(req, res) {
  try {
    syncHierarchyWithUsers();
    const { role, state, district, division, pincode } = req.user;
    let fullHierarchy = db.hierarchy.states;

    if (role === 'State Admin') {
      fullHierarchy = fullHierarchy.filter(s => s.name.toLowerCase() === (state || '').toLowerCase());
    } else if (role === 'District Admin') {
      fullHierarchy = fullHierarchy
        .filter(s => s.name.toLowerCase() === (state || '').toLowerCase())
        .map(s => ({
          ...s,
          districts: s.districts.filter(d => d.name.toLowerCase() === (district || '').toLowerCase())
        }));
    } else if (role === 'Divisional Admin' || role === 'Division Admin') {
      fullHierarchy = fullHierarchy
        .filter(s => s.name.toLowerCase() === (state || '').toLowerCase())
        .map(s => ({
          ...s,
          districts: s.districts
            .filter(d => d.name.toLowerCase() === (district || '').toLowerCase())
            .map(d => ({
              ...d,
              divisions: d.divisions.filter(div => div.name.toLowerCase() === (division || '').toLowerCase())
            }))
        }));
    } else if (role === 'Pincode Admin') {
      fullHierarchy = fullHierarchy
        .filter(s => s.name.toLowerCase() === (state || '').toLowerCase())
        .map(s => ({
          ...s,
          districts: s.districts
            .filter(d => d.name.toLowerCase() === (district || '').toLowerCase())
            .map(d => ({
              ...d,
              divisions: d.divisions
                .filter(div => div.name.toLowerCase() === (division || '').toLowerCase())
                .map(div => ({
                  ...div,
                  pincodes: div.pincodes.filter(pin => pin === pincode)
                }))
            }))
        }));
    }

    return res.json({ success: true, hierarchy: fullHierarchy });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch hierarchy', error: error.message });
  }
}

function getSubordinateAdmins(req, res) {
  try {
    const scopedAdmins = filterByLocation(db.admins, req.user);
    return res.json({ success: true, admins: scopedAdmins });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admins', error: error.message });
  }
}

function getStates(req, res) {
  try {
    syncHierarchyWithUsers();
    const allUsers = Array.from(db.users);
    const stateMap = new Map();

    (db.hierarchy.states || []).forEach(s => {
      if (s.name !== 'All India') {
        stateMap.set(s.name.trim().toLowerCase(), {
          id: s.id || `ST-${s.name.trim().slice(0, 3).toUpperCase()}`,
          name: s.name.trim(),
          code: s.code || s.name.trim().slice(0, 2).toUpperCase(),
          districts: s.districts || [],
          status: s.status || 'Active'
        });
      }
    });

    let states = Array.from(stateMap.values());

    if (req.user.role === 'State Admin') {
      states = states.filter(s => s.name.toLowerCase() === (req.user.state || '').toLowerCase());
    }

    const maxLimit = SUB_ADMIN_LIMITS['State Admin'] || 4;

    const enrichedStates = states.map(s => {
      const stateAdmins = allUsers.filter(u =>
        u.state?.trim().toLowerCase() === s.name.toLowerCase() &&
        (u.role === 'State Admin' || (u.role || '').toLowerCase().includes('state admin'))
      );

      stateAdmins.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      const primaryAdmin = stateAdmins[0] || null;
      const adminCount = stateAdmins.length;
      const isFull = adminCount >= maxLimit;

      const districtsCount = s.districts?.length || 0;
      const divisionsCount = s.districts?.reduce((sum, d) => sum + (d.divisions?.length || 0), 0) || 0;
      const pincodesCount = s.districts?.reduce((sum, d) => sum + (d.divisions?.reduce((pSum, div) => pSum + (div.pincodes?.length || 0), 0) || 0), 0) || 0;

      return {
        ...s,
        adminCount,
        limit: maxLimit,
        isFull,
        remainingSlots: Math.max(0, maxLimit - adminCount),
        admins: stateAdmins.map(a => ({
          id: a._id || a.id,
          name: (a.name || '').replace(/\s*\(.*?\)\s*/g, '').trim(),
          email: a.email,
          phone: a.phone || a.mobile,
          status: a.status === 'inactive' ? 'Inactive' : 'Active',
          loginId: a.loginId,
          dob: a.dob,
          avatarUrl: a.avatarUrl || a.avatar,
          aadharNumber: a.aadharNumber,
          panNumber: a.panNumber,
          createdAt: a.createdAt
        })),
        adminId: primaryAdmin?._id || primaryAdmin?.id || null,
        adminName: primaryAdmin ? (primaryAdmin.name || '').replace(/\s*\(.*?\)\s*/g, '').trim() : (adminCount > 0 ? `${adminCount} Admins` : 'Unassigned'),
        adminEmail: primaryAdmin?.email || null,
        adminPhone: primaryAdmin?.phone || primaryAdmin?.mobile || null,
        districtsCount,
        divisionsCount,
        pincodesCount
      };
    });

    return res.json({ success: true, states: enrichedStates });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch states', error: error.message });
  }
}

async function addStateAdmin(req, res) {
  try {
    const {
      adminName, email, phone, dob,
      address, city, districtAddr, state: addrState, pincode: addrPincode,
      aadharNumber, panNumber,
      accountHolderName, bankName, accountNumber, ifscCode, branchName,
      assignedState, status,
      loginId, password
    } = req.body;

    const stateName = assignedState || addrState;

    if (!adminName || !email || !stateName) {
      return res.status(400).json({ success: false, message: 'Admin name, Email, and Assigned State are required.' });
    }

    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, message: 'Phone number must be a 10-digit number starting with 6, 7, 8, or 9.' });
    }

    if (dob) {
      const dobDate = new Date(dob);
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - 18);
      maxDate.setHours(23, 59, 59, 999);
      if (isNaN(dobDate.getTime()) || dobDate > maxDate) {
        return res.status(400).json({ success: false, message: 'Admin must be at least 18 years of age (18+ only).' });
      }
    }

    const allUsers = Array.from(db.users);

    const existingStateAdmins = allUsers.filter(u =>
      u.state?.trim().toLowerCase() === stateName.trim().toLowerCase() &&
      (u.role === 'State Admin' || (u.role || '').toLowerCase().includes('state admin')) &&
      u.email?.toLowerCase() !== email.trim().toLowerCase()
    );

    const maxLimit = SUB_ADMIN_LIMITS['State Admin'] || 4;
    if (existingStateAdmins.length >= maxLimit) {
      return res.status(400).json({
        success: false,
        message: `State '${stateName}' already has the maximum allowed limit of ${maxLimit} State Admins.`
      });
    }

    if (loginId) {
      const loginExists = allUsers.find(u =>
        (u.loginId === loginId.trim() || u.email?.toLowerCase() === loginId.trim().toLowerCase()) &&
        u.email?.toLowerCase() !== email.trim().toLowerCase()
      );
      if (loginExists) {
        return res.status(400).json({ success: false, message: `Login ID '${loginId}' is already taken.` });
      }
    }

    let stateObj = db.hierarchy.states.find(s => s.name?.toLowerCase() === stateName.trim().toLowerCase());
    if (!stateObj) {
      stateObj = {
        id: `ST-${stateName.trim().slice(0, 3).toUpperCase()}`,
        name: stateName.trim(),
        code: stateName.trim().slice(0, 2).toUpperCase(),
        status: status || 'Active',
        districts: []
      };
      db.hierarchy.states.push(stateObj);
    }

    const DEFAULT_HASH = bcrypt.hashSync(password || 'admin123', 10);
    const adminId = `ADM-ST-${uuidv4().slice(0, 6).toUpperCase()}`;
    const existingUser = allUsers.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());

    const docPayload = {
      name: adminName.trim(),
      email: email.trim().toLowerCase(),
      loginId: loginId?.trim() || email.trim().toLowerCase(),
      mobile: (phone || '').replace(/[^0-9]/g, '').slice(-10),
      phone: phone || '',
      passwordHash: DEFAULT_HASH,
      role: 'State Admin',
      level: 1,
      state: stateObj.name,
      district: null,
      division: null,
      pincode: addrPincode || null,
      stateId: stateObj.id,
      districtId: null,
      divisionId: null,
      pincodeId: null,
      regionId: stateObj.id,
      status: (status || 'Active').toLowerCase() === 'active' ? 'active' : 'inactive',
      dob: dob || null,
      address: address || null,
      city: city || null,
      aadharNumber: aadharNumber || null,
      panNumber: panNumber || null,
      accountHolderName: accountHolderName || null,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      ifscCode: ifscCode || null,
      branchName: branchName || null,
      updatedAt: new Date().toISOString()
    };

    if (existingUser) {
      await db.users.update({ ...existingUser, ...docPayload });
    } else {
      await db.users.insertOne({
        _id: adminId,
        id: adminId,
        ...docPayload,
        createdAt: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      message: `State Admin '${adminName}' successfully provisioned for state '${stateObj.name}'.`,
      state: stateObj
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to add state admin', error: error.message });
  }
}

function updateStateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    let updated = null;

    db.hierarchy.states.forEach(s => {
      if (s.id === id || s.name === id || s.code === id) {
        s.status = status;
        updated = s;
      }
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'State not found' });
    }

    return res.json({ success: true, message: `State status updated to ${status}`, state: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update state status', error: error.message });
  }
}

function getDistricts(req, res) {
  try {
    syncHierarchyWithUsers();
    const allUsers = Array.from(db.users);
    const userRole = (req.user?.role || '').toLowerCase();
    const isSuperAdmin = userRole.includes('super admin') || req.user?.state === 'All India';

    // Security Scoping: State Admin cannot access other states
    let targetState = null;
    if (isSuperAdmin) {
      targetState = req.query.state || null;
    } else {
      targetState = req.user?.state || 'Tamil Nadu';
    }
    const targetStateClean = (targetState || '').trim().toLowerCase();

    // Direct database query: find all District Admins actually assigned in target state
    const assignedDistrictAdmins = allUsers.filter(u => {
      const r = (u.role || '').toLowerCase();
      const isDistAdmin = r === 'district admin' || r.includes('district admin');
      if (!isDistAdmin) return false;
      if (targetStateClean && targetStateClean !== 'all india' && (u.state || '').trim().toLowerCase() !== targetStateClean) return false;
      if (userRole.includes('district') || userRole.includes('divisional') || userRole.includes('pincode')) {
        if (req.user?.district && (u.district || '').trim().toLowerCase() !== (req.user.district || '').trim().toLowerCase()) return false;
      }
      return Boolean(u.district && u.district.trim());
    });

    // If no assigned District Admins exist, return empty array immediately (no master geo data fallback)
    if (assignedDistrictAdmins.length === 0) {
      return res.json({ success: true, districts: [] });
    }

    const maxLimit = SUB_ADMIN_LIMITS['District Admin'] || 1;
    const allVendors = Array.from(db.vendors || []);
    const allOrders = Array.from(db.orders || []);
    const allBookings = Array.from(db.bookings || []);
    const allJobs = Array.from(db.jobs || []);
    const allTechnicians = Array.from(db.technicians || []);
    const allExecutives = Array.from(db.executives || []);
    const allKYC = Array.from(db.kycRecords || []);
    const allCustomers = Array.from(db.customers || []);
    const allAgents = Array.from(db.agents || []);

    // Build unique assigned district map
    const assignedDistrictsMap = new Map();

    assignedDistrictAdmins.forEach(assigned => {
      const distName = assigned.district.trim();
      const distKey = distName.toLowerCase();

      if (!assignedDistrictsMap.has(distKey)) {
        // Find existing meta in db.hierarchy if present
        let distMeta = null;
        (db.hierarchy.states || []).forEach(s => {
          if (!targetStateClean || targetStateClean === 'all india' || s.name.toLowerCase() === targetStateClean) {
            (s.districts || []).forEach(d => {
              if (d.name.trim().toLowerCase() === distKey) {
                distMeta = d;
              }
            });
          }
        });

        const stateName = assigned.state || distMeta?.stateName || targetState || 'Tamil Nadu';

        const distAdmins = assignedDistrictAdmins.filter(u =>
          u.district.trim().toLowerCase() === distKey &&
          (u.state || '').trim().toLowerCase() === stateName.trim().toLowerCase()
        );

        const distDivAdmins = allUsers.filter(u =>
          (u.state || '').trim().toLowerCase() === stateName.trim().toLowerCase() &&
          (u.district || '').trim().toLowerCase() === distKey &&
          (u.role === 'Division Admin' || u.role === 'Divisional Admin')
        );

        const distPinAdmins = allUsers.filter(u =>
          (u.state || '').trim().toLowerCase() === stateName.trim().toLowerCase() &&
          (u.district || '').trim().toLowerCase() === distKey &&
          u.role === 'Pincode Admin'
        );

        const distManagers = allUsers.filter(u =>
          ((u.district || '').trim().toLowerCase() === distKey || (u.districtId && String(u.districtId).toLowerCase() === String(distMeta?.id || assigned.districtId).toLowerCase())) &&
          ((u.role || '').toLowerCase().includes('manager') && !(u.role || '').toLowerCase().includes('admin'))
        );

        const managerList = distManagers.map(m => ({
          id: m.id || m._id,
          name: m.name,
          email: m.email,
          mobile: m.mobile || m.phone,
          role: m.role,
          roleTitle: m.role === 'district_manager' ? 'District Manager' : m.role === 'division_manager' ? 'Division Manager' : m.role === 'pincode_manager' ? 'Pincode Manager' : 'State Manager',
          status: m.status,
          adminApprovalStatus: m.adminApprovalStatus || (m.status === 'active' ? 'approved' : 'pending'),
          kycStatus: m.kycStatus || (m.status === 'active' ? 'Verified' : 'pending_verification'),
          division: m.division || '-',
          pincode: m.pincode || '-',
          joinedDate: m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'
        }));

        const distAgents = allAgents.filter(a => (a.district || '').trim().toLowerCase() === distKey);
        const distVendors = allVendors.filter(v => (v.district || '').trim().toLowerCase() === distKey);
        const distOrders = allOrders.filter(o => (o.district || '').trim().toLowerCase() === distKey);
        const distBookings = allBookings.filter(b => (b.district || '').trim().toLowerCase() === distKey);
        const distJobs = allJobs.filter(j => (j.district || '').trim().toLowerCase() === distKey);
        const distTechnicians = allTechnicians.filter(t => (t.district || '').trim().toLowerCase() === distKey);
        const distExecutives = allExecutives.filter(e => (e.district || '').trim().toLowerCase() === distKey);
        const distKYC = allKYC.filter(k => (k.district || '').trim().toLowerCase() === distKey && k.status === 'Pending');
        const distCustomers = allCustomers.filter(c => (c.district || '').trim().toLowerCase() === distKey);

        const primaryAdmin = distAdmins[0] || assigned;
        const status = primaryAdmin.status === 'inactive' ? 'Inactive' : (distMeta?.status || 'Active');

        assignedDistrictsMap.set(distKey, {
          id: assigned.districtId || distMeta?.id || `DST-${distName.replace(/\s+/g, '-').toUpperCase()}`,
          name: distName,
          code: distMeta?.code || distName.slice(0, 3).toUpperCase(),
          status,
          state: stateName,
          stateName: stateName,
          divisions: distMeta?.divisions || [],
          divisionsCount: distDivAdmins.length,
          pincodesCount: distPinAdmins.length,
          adminCount: distAdmins.length,
          limit: maxLimit,
          isFull: distAdmins.length >= maxLimit,
          totalManagers: distManagers.length,
          managers: managerList,
          totalAgents: distAgents.length,
          totalVendors: distVendors.length,
          totalOrders: distOrders.length,
          totalBookings: distBookings.length,
          totalJobApplied: distJobs.length,
          technician: distTechnicians.length,
          executive: distExecutives.length,
          pendingKYC: distKYC.length,
          totalCustomers: distCustomers.length,
          totalMembershipCards: distCustomers.length,
          adminId: primaryAdmin._id || primaryAdmin.id || null,
          adminName: (primaryAdmin.name || '').replace(/\s*\(.*?\)\s*/g, '').trim(),
          adminEmail: primaryAdmin.email || null,
          adminPhone: primaryAdmin.phone || primaryAdmin.mobile || null,
          adminDob: primaryAdmin.dob || null,
          adminAvatarUrl: primaryAdmin.avatarUrl || null,
          adminAddress: primaryAdmin.address || null,
          adminCity: primaryAdmin.city || null,
          adminPincode: primaryAdmin.pincode || null,
          adminAadharNumber: primaryAdmin.aadharNumber || null,
          adminPanNumber: primaryAdmin.panNumber || null,
          adminAccountHolder: primaryAdmin.accountHolderName || null,
          adminBankName: primaryAdmin.bankName || null,
          adminAccountNumber: primaryAdmin.accountNumber || null,
          adminIfsc: primaryAdmin.ifscCode || null,
          adminBranch: primaryAdmin.branchName || null,
          adminLoginId: primaryAdmin.loginId || null,
          adminCreatedAt: primaryAdmin.createdAt || null,
        });
      }
    });

    const enrichedDistricts = Array.from(assignedDistrictsMap.values());
    return res.json({ success: true, districts: enrichedDistricts });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch districts', error: error.message });
  }
}

async function addDistrictAdmin(req, res) {
  try {
    const {
      adminName, email, phone, dob,
      address, city, districtAddr, state: addrState, pincode: addrPincode,
      aadharNumber, panNumber,
      accountHolderName, bankName, accountNumber, ifscCode, branchName,
      assignedState, assignedDistrict, status,
      loginId, password,
      districtName: legacyDistrictName
    } = req.body;

    const districtName = assignedDistrict || legacyDistrictName;

    if (!adminName || !email || !districtName) {
      return res.status(400).json({ success: false, message: 'Admin name, Email, and Assigned District are required.' });
    }

    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, message: 'Phone number must be a 10-digit number starting with 6, 7, 8, or 9.' });
    }

    if (dob) {
      const dobDate = new Date(dob);
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - 18);
      maxDate.setHours(23, 59, 59, 999);
      if (isNaN(dobDate.getTime()) || dobDate > maxDate) {
        return res.status(400).json({ success: false, message: 'Admin must be at least 18 years of age (18+ only).' });
      }
    }

    const allUsers = Array.from(db.users);
    const stateName = assignedState || req.user.state || 'Tamil Nadu';

    const existingDistAdmins = allUsers.filter(u =>
      u.state?.trim().toLowerCase() === stateName.trim().toLowerCase() &&
      u.district?.trim().toLowerCase() === districtName.trim().toLowerCase() &&
      (u.role === 'District Admin' || (u.role || '').toLowerCase().includes('district admin')) &&
      u.email?.toLowerCase() !== email.trim().toLowerCase()
    );

    const maxLimit = SUB_ADMIN_LIMITS['District Admin'] || 1;
    if (existingDistAdmins.length >= maxLimit) {
      return res.status(400).json({
        success: false,
        message: `District '${districtName}' already has the maximum allowed limit of ${maxLimit} District Admin.`
      });
    }

    if (loginId) {
      const loginExists = allUsers.find(u =>
        (u.loginId === loginId.trim() || u.email?.toLowerCase() === loginId.trim().toLowerCase()) &&
        u.email?.toLowerCase() !== email.trim().toLowerCase()
      );
      if (loginExists) {
        return res.status(400).json({ success: false, message: `Login ID '${loginId}' is already taken.` });
      }
    }

    let stateObj = db.hierarchy.states.find(s => s.name?.toLowerCase() === stateName.toLowerCase());
    if (!stateObj) {
      return res.status(400).json({ success: false, message: `State '${stateName}' is not registered or active in Admin Territory Management.` });
    }

    let dist = stateObj.districts.find(d => d.name?.toLowerCase() === districtName.trim().toLowerCase());
    if (!dist) {
      return res.status(400).json({ success: false, message: `District '${districtName}' is not configured under State '${stateName}' in Admin Territory Management.` });
    }

    const DEFAULT_HASH = bcrypt.hashSync(password || 'admin123', 10);
    const adminId = `ADM-${uuidv4().slice(0, 8).toUpperCase()}`;
    const existingUser = allUsers.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());

    const docPayload = {
      name: adminName.trim(),
      email: email.trim().toLowerCase(),
      loginId: loginId?.trim() || email.trim().toLowerCase(),
      mobile: (phone || '').replace(/[^0-9]/g, '').slice(-10),
      phone: phone || '',
      passwordHash: DEFAULT_HASH,
      role: 'District Admin',
      level: 2,
      state: stateName,
      district: dist.name,
      stateId: stateObj.id,
      districtId: dist.id,
      division: null,
      pincode: addrPincode || null,
      status: (status || 'Active').toLowerCase() === 'active' ? 'active' : 'inactive',
      dob: dob || null,
      address: address || null,
      city: city || null,
      aadharNumber: aadharNumber || null,
      panNumber: panNumber || null,
      accountHolderName: accountHolderName || null,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      ifscCode: ifscCode || null,
      branchName: branchName || null,
      updatedAt: new Date().toISOString()
    };

    if (existingUser) {
      await db.users.update({ ...existingUser, ...docPayload });
    } else {
      await db.users.insertOne({
        _id: adminId,
        id: adminId,
        ...docPayload,
        createdAt: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      message: `District Admin '${adminName}' successfully registered and assigned to '${dist.name}'.`,
      district: dist
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to add district admin', error: error.message });
  }
}

function updateDistrictStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    let updated = null;

    db.hierarchy.states.forEach(s => {
      s.districts.forEach(d => {
        if (d.id === id || d.name === id || d.code === id) {
          d.status = status;
          updated = d;
        }
      });
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'District not found' });
    }

    return res.json({ success: true, message: `District status updated to ${status}`, district: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update district status', error: error.message });
  }
}

function getDivisions(req, res) {
  try {
    syncHierarchyWithUsers();
    const allUsers = Array.from(db.users);
    const userRole = (req.user?.role || '').toLowerCase();
    const isSuperAdmin = userRole.includes('super admin') || req.user?.state === 'All India';

    // Security Scoping: Prevent querying outside authorized jurisdiction
    let reqState = '';
    if (isSuperAdmin) {
      reqState = (req.query.state || '').trim().toLowerCase();
    } else {
      reqState = (req.user?.state || 'Tamil Nadu').trim().toLowerCase();
    }

    let reqDistrict = '';
    if (userRole.includes('district') || userRole.includes('divisional') || userRole.includes('pincode')) {
      reqDistrict = (req.user?.district || '').trim().toLowerCase();
    } else {
      reqDistrict = (req.query.district || '').trim().toLowerCase();
    }

    let reqDivision = '';
    if (userRole.includes('divisional') || userRole.includes('division') || userRole.includes('pincode')) {
      reqDivision = (req.user?.division || '').trim().toLowerCase();
    } else {
      reqDivision = (req.query.division || '').trim().toLowerCase();
    }

    // Direct database query: find all Division Admins actually assigned
    const assignedDivAdmins = allUsers.filter(u => {
      const r = (u.role || '').toLowerCase();
      const isDivAdmin = r === 'division admin' || r === 'divisional admin' || r.includes('division admin') || r.includes('divisional admin');
      if (!isDivAdmin) return false;
      if (reqState && reqState !== 'all india' && (u.state || '').trim().toLowerCase() !== reqState) return false;
      if (reqDistrict && (u.district || '').trim().toLowerCase() !== reqDistrict) return false;
      if (reqDivision && (u.division || '').trim().toLowerCase() !== reqDivision) return false;
      return Boolean(u.division && u.division.trim());
    });

    if (assignedDivAdmins.length === 0) {
      return res.json({ success: true, divisions: [] });
    }

    const assignedDivisionsMap = new Map();

    assignedDivAdmins.forEach(assigned => {
      const divName = assigned.division.trim();
      const divKey = `${(assigned.district || '').trim().toLowerCase()}_${divName.toLowerCase()}`;

      if (!assignedDivisionsMap.has(divKey)) {
        // Look up division meta if exists in hierarchy
        let divMeta = null;
        (db.hierarchy.states || []).forEach(stateObj => {
          if (!reqState || reqState === 'all india' || stateObj.name.toLowerCase() === reqState) {
            (stateObj.districts || []).forEach(d => {
              if (!reqDistrict || d.name.toLowerCase() === reqDistrict) {
                (d.divisions || []).forEach(div => {
                  if (div.name.toLowerCase() === divName.toLowerCase()) {
                    divMeta = { ...div, districtName: d.name, stateName: stateObj.name };
                  }
                });
              }
            });
          }
        });

        const distName = assigned.district || divMeta?.districtName || req.query.district || req.user?.district || '-';
        const stateName = assigned.state || divMeta?.stateName || req.user?.state || 'Tamil Nadu';

        const divPinAdmins = allUsers.filter(u =>
          (u.role === 'Pincode Admin' || (u.role || '').toLowerCase().includes('pincode admin')) &&
          (u.division || '').trim().toLowerCase() === divName.toLowerCase() &&
          (u.district || '').trim().toLowerCase() === distName.toLowerCase()
        );

        const activePincodes = Array.from(new Set(divMeta?.pincodes || []));
        const status = assigned.status === 'inactive' ? 'Inactive' : (divMeta?.status || 'Active');

        assignedDivisionsMap.set(divKey, {
          id: assigned.divisionId || divMeta?.id || `DIV-${divName.replace(/\s+/g, '-').toUpperCase()}`,
          name: divName,
          divisionName: divName,
          pincodes: activePincodes,
          pincodesCount: activePincodes.length,
          registeredPincodeAdminsCount: divPinAdmins.length,
          districtName: distName,
          stateName: stateName,
          state: stateName,
          district: distName,
          adminId: assigned._id || assigned.id || null,
          adminName: (assigned.name || '').replace(/\s*\(.*?\)\s*/g, '').trim(),
          adminEmail: assigned.email || '-',
          adminPhone: assigned.phone || assigned.mobile || null,
          adminAadharNumber: assigned.aadharNumber || null,
          adminPanNumber: assigned.panNumber || null,
          status
        });
      }
    });

    const divisions = Array.from(assignedDivisionsMap.values());
    return res.json({ success: true, divisions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch divisions', error: error.message });
  }
}

async function addDivisionAdmin(req, res) {
  try {
    const {
      adminName, email, phone, dob,
      address, city, state: addrState, pincode: addrPincode,
      aadharNumber, panNumber,
      accountHolderName, bankName, accountNumber, ifscCode, branchName,
      assignedState, assignedDistrict, divisionName, status,
      loginId, password
    } = req.body;

    if (!adminName || !email || !divisionName) {
      return res.status(400).json({ success: false, message: 'Admin name, Email, and Division Name are required.' });
    }

    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, message: 'Phone number must be a 10-digit number starting with 6, 7, 8, or 9.' });
    }

    if (dob) {
      const dobDate = new Date(dob);
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - 18);
      maxDate.setHours(23, 59, 59, 999);
      if (isNaN(dobDate.getTime()) || dobDate > maxDate) {
        return res.status(400).json({ success: false, message: 'Admin must be at least 18 years of age (18+ only).' });
      }
    }

    const allUsers = Array.from(db.users);
    const stateName = assignedState || req.user.state || 'Tamil Nadu';
    const districtName = assignedDistrict || req.user.district;

    if (!districtName) {
      return res.status(400).json({ success: false, message: 'Assigned District is required.' });
    }

    const callerRole = (req.user?.role || '').toLowerCase();
    if (callerRole.includes('district') && req.user?.district) {
      if (districtName.trim().toLowerCase() !== req.user.district.trim().toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Access Denied: You cannot assign or manage a Division outside your assigned district.' });
      }
    }
    if (callerRole.includes('state') && req.user?.state && req.user.state !== 'All India') {
      if (stateName.trim().toLowerCase() !== req.user.state.trim().toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Access Denied: You cannot assign or manage a Division outside your assigned state.' });
      }
    }

    const existingDivAdmins = allUsers.filter(u =>
      u.state?.trim().toLowerCase() === stateName.trim().toLowerCase() &&
      u.district?.trim().toLowerCase() === districtName.trim().toLowerCase() &&
      u.division?.trim().toLowerCase() === divisionName.trim().toLowerCase() &&
      (u.role === 'Division Admin' || u.role === 'Divisional Admin' || (u.role || '').toLowerCase().includes('division admin')) &&
      u.email?.toLowerCase() !== email.trim().toLowerCase()
    );

    const maxLimit = SUB_ADMIN_LIMITS['Division Admin'] || 1;
    if (existingDivAdmins.length >= maxLimit) {
      return res.status(400).json({
        success: false,
        message: `Division '${divisionName}' already has the maximum allowed limit of ${maxLimit} Division Admin.`
      });
    }

    if (loginId) {
      const loginExists = allUsers.find(u =>
        (u.loginId === loginId.trim() || u.email?.toLowerCase() === loginId.trim().toLowerCase()) &&
        u.email?.toLowerCase() !== email.trim().toLowerCase()
      );
      if (loginExists) {
        return res.status(400).json({ success: false, message: `Login ID '${loginId}' is already taken.` });
      }
    }

    let stateObj = db.hierarchy.states.find(s => s.name?.toLowerCase() === stateName.toLowerCase());
    if (!stateObj) {
      return res.status(400).json({ success: false, message: `State '${stateName}' is not configured in Admin Territory Management.` });
    }

    let dist = stateObj.districts?.find(d => d.name?.toLowerCase() === districtName.trim().toLowerCase());
    if (!dist) {
      return res.status(400).json({ success: false, message: `District '${districtName}' is not configured under State '${stateName}' in Admin Territory Management.` });
    }

    let div = dist.divisions?.find(dv => dv.name?.toLowerCase() === divisionName.trim().toLowerCase());
    if (!div) {
      return res.status(400).json({ success: false, message: `Division '${divisionName}' is not configured under District '${districtName}' in Admin Territory Management.` });
    }

    const DEFAULT_HASH = bcrypt.hashSync(password || 'admin123', 10);
    const adminId = `ADM-DIV-${uuidv4().slice(0, 6).toUpperCase()}`;
    const existingUser = allUsers.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());

    const docPayload = {
      name: adminName.trim(),
      email: email.trim().toLowerCase(),
      loginId: loginId?.trim() || email.trim().toLowerCase(),
      mobile: (phone || '').replace(/[^0-9]/g, '').slice(-10),
      phone: phone || '',
      passwordHash: DEFAULT_HASH,
      role: 'Division Admin',
      level: 3,
      state: stateName,
      district: dist.name,
      division: div.name,
      stateId: stateObj.id,
      districtId: dist.id,
      divisionId: div.id,
      pincode: addrPincode || null,
      status: (status || 'Active').toLowerCase() === 'active' ? 'active' : 'inactive',
      dob: dob || null,
      address: address || null,
      city: city || null,
      aadharNumber: aadharNumber || null,
      panNumber: panNumber || null,
      accountHolderName: accountHolderName || null,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      ifscCode: ifscCode || null,
      branchName: branchName || null,
      updatedAt: new Date().toISOString()
    };

    if (existingUser) {
      await db.users.update({ ...existingUser, ...docPayload });
    } else {
      await db.users.insertOne({
        _id: adminId,
        id: adminId,
        ...docPayload,
        createdAt: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      message: `Division Admin '${adminName}' successfully registered and assigned to '${div.name}'.`,
      division: div
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to add division admin', error: error.message });
  }
}

function updateDivisionStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    let updated = null;

    db.hierarchy.states.forEach(s => {
      s.districts.forEach(d => {
        d.divisions?.forEach(div => {
          if (div.id === id || div.name === id) {
            div.status = status;
            updated = div;
          }
        });
      });
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Division not found' });
    }

    return res.json({ success: true, message: `Division status updated to ${status}`, division: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update division status', error: error.message });
  }
}

function getPincodes(req, res) {
  try {
    syncHierarchyWithUsers();
    const allUsers = Array.from(db.users);
    const userRole = (req.user?.role || '').toLowerCase();
    const isSuperAdmin = userRole.includes('super admin') || req.user?.state === 'All India';

    // Security Scoping: Prevent querying outside authorized jurisdiction
    let targetState = null;
    if (isSuperAdmin) {
      targetState = req.query.state || null;
    } else {
      targetState = req.user?.state || 'Tamil Nadu';
    }

    let targetDistrict = null;
    if (userRole.includes('district') || userRole.includes('divisional') || userRole.includes('pincode')) {
      targetDistrict = req.user?.district || null;
    } else {
      targetDistrict = req.query.district || null;
    }

    let targetDivision = null;
    if (userRole.includes('divisional') || userRole.includes('division') || userRole.includes('pincode')) {
      targetDivision = req.user?.division || null;
    } else {
      targetDivision = req.query.division || null;
    }

    const targetPincode = (userRole.includes('pincode') ? req.user?.pincode : req.query.pincode) || null;

    const clean = (s) => (s || '').toLowerCase().replace(/tth/g, 'tt').replace(/\s+division/g, '').replace(/^div-/, '').replace(/^dst-/, '').trim();
    const targetStateClean = clean(targetState);
    const targetDistClean = clean(targetDistrict);
    const targetDivClean = clean(targetDivision);

    // Direct database query: find all assigned Pincode Admins
    const assignedPinAdmins = allUsers.filter(u => {
      const r = (u.role || '').toLowerCase();
      const isPinAdmin = r === 'pincode admin' || r.includes('pincode admin');
      if (!isPinAdmin) return false;
      if (targetStateClean && targetStateClean !== 'all india' && clean(u.state) !== targetStateClean) return false;
      if (targetDistClean && clean(u.district) !== targetDistClean) return false;
      if (targetDivClean && clean(u.division) !== targetDivClean) return false;
      if (targetPincode && String(u.pincode || '').trim() !== String(targetPincode).trim()) return false;
      return Boolean(u.pincode && String(u.pincode).trim());
    });

    if (assignedPinAdmins.length === 0) {
      return res.json({ success: true, pincodes: [] });
    }

    const pincodesMap = new Map();

    const allVendors = Array.from(db.vendors || []);
    const allOrders = Array.from(db.orders || []);
    const allBookings = Array.from(db.bookings || []);
    const allCustomers = Array.from(db.customers || []);
    const allAgents = Array.from(db.agents || []);
    const allTechnicians = Array.from(db.technicians || []);
    const allExecutives = Array.from(db.executives || []);
    const allJobs = Array.from(db.jobs || []);
    const allKYC = Array.from(db.kycRecords || []);

    assignedPinAdmins.forEach(admin => {
      const pinStr = String(admin.pincode).trim();
      const divName = admin.division || targetDivision || '-';
      const dName = admin.district || targetDistrict || '-';
      const sName = admin.state || targetState || 'Tamil Nadu';

      const pinVendors = allVendors.filter(v => String(v.pincode || '').trim() === pinStr).length;
      const pinOrders = allOrders.filter(o => String(o.pincode || '').trim() === pinStr).length;
      const pinBookings = allBookings.filter(b => String(b.pincode || '').trim() === pinStr).length;
      const pinCustomers = allCustomers.filter(c => String(c.pincode || '').trim() === pinStr).length;
      const pinManagers = allUsers.filter(u => String(u.pincode || '').trim() === pinStr && (u.role || '').toLowerCase().includes('manager')).length;
      const pinAgents = allAgents.filter(a => String(a.pincode || '').trim() === pinStr).length;
      const pinTechnicians = allTechnicians.filter(t => String(t.pincode || '').trim() === pinStr).length;
      const pinExecutives = allExecutives.filter(e => String(e.pincode || '').trim() === pinStr).length;
      const pinKYC = allKYC.filter(k => String(k.pincode || '').trim() === pinStr && k.status === 'Pending').length;
      const pinJobs = allJobs.filter(j => String(j.pincode || '').trim() === pinStr).length;

      pincodesMap.set(pinStr, {
        id: admin.pincodeId || `PIN-${pinStr}`,
        pincode: pinStr,
        areaName: admin.area || `${divName} Area (${pinStr})`,
        division: divName,
        divisionName: divName,
        district: dName,
        districtName: dName,
        state: sName,
        adminId: admin._id || admin.id || null,
        adminName: (admin.name || '').replace(/\s*\(.*?\)\s*/g, '').trim(),
        adminEmail: admin.email || '-',
        adminPhone: admin.phone || admin.mobile || '-',
        adminDob: admin.dob || null,
        adminAddress: admin.address || null,
        adminCity: admin.city || null,
        adminAadharNumber: admin.aadharNumber || null,
        adminPanNumber: admin.panNumber || null,
        adminAccountHolder: admin.accountHolderName || null,
        adminBankName: admin.bankName || null,
        adminAccountNumber: admin.accountNumber || null,
        adminIfsc: admin.ifscCode || null,
        adminBranch: admin.branchName || null,
        adminLoginId: admin.loginId || null,
        adminCreatedAt: admin.createdAt || null,
        status: admin.status === 'inactive' ? 'Inactive' : 'Active',
        customerCount: pinCustomers,
        totalCustomers: pinCustomers,
        customers: pinCustomers,
        totalVendors: pinVendors,
        vendors: pinVendors,
        totalOrders: pinOrders,
        orders: pinOrders,
        totalBookings: pinBookings,
        bookings: pinBookings,
        totalManagers: pinManagers,
        totalAgents: pinAgents,
        deliveryPartner: 0,
        technician: pinTechnicians,
        executive: pinExecutives,
        pendingKYC: pinKYC,
        totalJobApplied: pinJobs,
        totalMembershipCards: pinCustomers
      });
    });

    const pincodesList = Array.from(pincodesMap.values());
    return res.json({ success: true, pincodes: pincodesList });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pincodes', error: error.message });
  }
}

async function addPincodeAdmin(req, res) {
  try {
    const {
      adminName, email, phone, dob,
      address, city, state: addrState, pincode: addrPincode,
      aadharNumber, panNumber,
      accountHolderName, bankName, accountNumber, ifscCode, branchName,
      assignedState, assignedDistrict, assignedDivision, assignedPincode, status,
      loginId, password
    } = req.body;

    const stateName = assignedState || req.user.state || 'Tamil Nadu';
    const districtName = assignedDistrict || req.user.district;
    const divisionName = assignedDivision || req.user.division;
    const pincode = assignedPincode || addrPincode;

    if (!districtName) {
      return res.status(400).json({ success: false, message: 'Assigned District is required.' });
    }
    if (!divisionName) {
      return res.status(400).json({ success: false, message: 'Assigned Division is required.' });
    }
    if (!adminName || !email || !pincode) {
      return res.status(400).json({ success: false, message: 'Admin name, Email, and Assigned Pincode are required.' });
    }

    const callerRole = (req.user?.role || '').toLowerCase();
    if (callerRole.includes('division') && req.user?.division) {
      if (divisionName.trim().toLowerCase() !== req.user.division.trim().toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Access Denied: You cannot assign or manage a Pincode Admin outside your assigned division.' });
      }
    }
    if (callerRole.includes('district') && req.user?.district) {
      if (districtName.trim().toLowerCase() !== req.user.district.trim().toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Access Denied: You cannot assign or manage a Pincode Admin outside your assigned district.' });
      }
    }
    if (callerRole.includes('state') && req.user?.state && req.user.state !== 'All India') {
      if (stateName.trim().toLowerCase() !== req.user.state.trim().toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Access Denied: You cannot assign or manage a Pincode Admin outside your assigned state.' });
      }
    }

    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, message: 'Phone number must be a 10-digit number starting with 6, 7, 8, or 9.' });
    }

    if (dob) {
      const dobDate = new Date(dob);
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - 18);
      maxDate.setHours(23, 59, 59, 999);
      if (isNaN(dobDate.getTime()) || dobDate > maxDate) {
        return res.status(400).json({ success: false, message: 'Admin must be at least 18 years of age (18+ only).' });
      }
    }

    const allUsers = Array.from(db.users);

    const existingPinAdmins = allUsers.filter(u =>
      u.pincode?.trim() === String(pincode).trim() &&
      (u.role === 'Pincode Admin' || (u.role || '').toLowerCase().includes('pincode admin')) &&
      u.email?.toLowerCase() !== email.trim().toLowerCase()
    );

    const maxLimit = SUB_ADMIN_LIMITS['Pincode Admin'] || 1;
    if (existingPinAdmins.length >= maxLimit) {
      return res.status(400).json({
        success: false,
        message: `Pincode '${pincode}' already has the maximum allowed limit of ${maxLimit} Pincode Admin.`
      });
    }

    if (loginId) {
      const loginExists = allUsers.find(u =>
        (u.loginId === loginId.trim() || u.email?.toLowerCase() === loginId.trim().toLowerCase()) &&
        u.email?.toLowerCase() !== email.trim().toLowerCase()
      );
      if (loginExists) {
        return res.status(400).json({ success: false, message: `Login ID '${loginId}' is already taken.` });
      }
    }

    let stateObj = db.hierarchy.states.find(s => s.name?.toLowerCase() === stateName.toLowerCase());
    if (!stateObj) {
      return res.status(400).json({ success: false, message: `State '${stateName}' is not configured in Admin Territory Management.` });
    }

    let dist = stateObj.districts?.find(d => d.name?.toLowerCase() === districtName.trim().toLowerCase());
    if (!dist) {
      return res.status(400).json({ success: false, message: `District '${districtName}' is not configured under State '${stateName}' in Admin Territory Management.` });
    }

    let div = dist.divisions?.find(dv => dv.name?.toLowerCase() === divisionName.trim().toLowerCase());
    if (!div) {
      return res.status(400).json({ success: false, message: `Division '${divisionName}' is not configured under District '${districtName}' in Admin Territory Management.` });
    }

    const pinStr = String(pincode).trim();
    const pinExists = (div.pincodes || []).some(p => String(p).trim() === pinStr);
    if (!pinExists) {
      return res.status(400).json({ success: false, message: `Pincode '${pinStr}' is not configured under Division '${divisionName}' in Admin Territory Management.` });
    }

    const DEFAULT_HASH = bcrypt.hashSync(password || 'admin123', 10);
    const adminId = `ADM-PIN-${uuidv4().slice(0, 6).toUpperCase()}`;
    const existingUser = allUsers.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());

    const docPayload = {
      name: adminName.trim(),
      email: email.trim().toLowerCase(),
      loginId: loginId?.trim() || email.trim().toLowerCase(),
      mobile: (phone || '').replace(/[^0-9]/g, '').slice(-10),
      phone: phone || '',
      passwordHash: DEFAULT_HASH,
      role: 'Pincode Admin',
      level: 4,
      state: stateName,
      district: dist.name,
      division: div.name,
      pincode: pinStr,
      stateId: stateObj.id,
      districtId: dist.id,
      divisionId: div.id,
      pincodeId: `pin_${pinStr}`,
      status: (status || 'Active').toLowerCase() === 'active' ? 'active' : 'inactive',
      dob: dob || null,
      address: address || null,
      city: city || null,
      aadharNumber: aadharNumber || null,
      panNumber: panNumber || null,
      accountHolderName: accountHolderName || null,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      ifscCode: ifscCode || null,
      branchName: branchName || null,
      updatedAt: new Date().toISOString()
    };

    if (existingUser) {
      await db.users.update({ ...existingUser, ...docPayload });
    } else {
      await db.users.insertOne({
        _id: adminId,
        id: adminId,
        ...docPayload,
        createdAt: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      message: `Pincode Admin '${adminName}' successfully registered and assigned to PIN '${pinStr}'.`,
      pincode: pinStr
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to add pincode admin', error: error.message });
  }
}

function updatePincodeStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allUsers = Array.from(db.users);
    const user = allUsers.find(u => u.pincode === id && u.role === 'Pincode Admin');
    if (user) {
      user.status = status.toLowerCase();
      db.users.update(user);
    }

    return res.json({ success: true, message: `Pincode admin status updated to ${status}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update pincode status', error: error.message });
  }
}

module.exports = {
  getHierarchy,
  getSubordinateAdmins,
  getStates,
  addStateAdmin,
  updateStateStatus,
  getDistricts,
  addDistrictAdmin,
  updateDistrictStatus,
  getDivisions,
  addDivisionAdmin,
  updateDivisionStatus,
  getPincodes,
  addPincodeAdmin,
  updatePincodeStatus
};
