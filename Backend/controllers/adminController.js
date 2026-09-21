const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, filterByLocation } = require('../config/db');
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
  db.hierarchy.states = [];
  const allUsers = Array.from(db.users);

  allUsers.forEach(u => {
    if (!u.state || u.state === 'All India') return;
    const stateName = u.state.trim();

    let stateObj = db.hierarchy.states.find(s => s.name?.toLowerCase() === stateName.toLowerCase());
    if (!stateObj) {
      stateObj = {
        id: u.stateId || (stateName === 'Tamil Nadu' ? 'state_tn' : `ST-${stateName.slice(0, 3).toUpperCase()}`),
        name: stateName,
        code: stateName.slice(0, 2).toUpperCase(),
        status: 'Active',
        districts: []
      };
      db.hierarchy.states.push(stateObj);
    }

    if (u.district) {
      const dName = u.district.trim();
      let dist = stateObj.districts.find(d => d.name?.toLowerCase() === dName.toLowerCase());
      if (!dist) {
        dist = {
          id: u.districtId || (dName.toLowerCase() === 'salem' ? 'dist_salem' : `DST-${dName.replace(/\s+/g, '-').toUpperCase()}`),
          name: dName,
          code: dName.slice(0, 3).toUpperCase(),
          status: u.status === 'inactive' ? 'Inactive' : 'Active',
          divisions: []
        };
        stateObj.districts.push(dist);
      }

      if (u.division) {
        const divName = u.division.trim();
        let div = dist.divisions.find(d => d.name?.toLowerCase() === divName.toLowerCase());
        if (!div) {
          div = {
            id: u.divisionId || `DIV-${divName.replace(/\s+/g, '-').toUpperCase()}`,
            name: divName,
            code: divName.slice(0, 3).toUpperCase(),
            pincodes: []
          };
          dist.divisions.push(div);
        }

        if (u.role === 'Pincode Admin' && u.pincode && !div.pincodes.includes(u.pincode)) {
          div.pincodes.push(u.pincode);
        }
      }
    }
  });
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

    allUsers.forEach(u => {
      if (u.state && u.state !== 'All India') {
        const sName = u.state.trim();
        const sKey = sName.toLowerCase();
        if (!stateMap.has(sKey)) {
          const newState = {
            id: u.stateId || `ST-${sName.slice(0, 3).toUpperCase()}`,
            name: sName,
            code: sName.slice(0, 2).toUpperCase(),
            districts: [],
            status: 'Active'
          };
          stateMap.set(sKey, newState);
          db.hierarchy.states.push(newState);
        }
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
    const userState = req.user.state || 'Tamil Nadu';

    let stateObj = db.hierarchy.states.find(s => s.name?.toLowerCase() === userState.toLowerCase());
    if (!stateObj) {
      stateObj = {
        id: `ST-${userState.slice(0, 3).toUpperCase()}`,
        name: userState,
        code: userState.slice(0, 2).toUpperCase(),
        districts: []
      };
      db.hierarchy.states.push(stateObj);
    }

    const districtMap = new Map();
    (stateObj.districts || []).forEach(d => {
      districtMap.set(d.name.trim().toLowerCase(), {
        id: d.id || `DST-${d.name.trim().replace(/\s+/g, '-').toUpperCase()}`,
        name: d.name.trim(),
        code: d.code || d.name.trim().slice(0, 3).toUpperCase(),
        status: d.status || 'Active',
        divisions: d.divisions || []
      });
    });

    allUsers.forEach(u => {
      if (u.district && (u.state || 'Tamil Nadu').toLowerCase() === userState.toLowerCase()) {
        const dName = u.district.trim();
        const dKey = dName.toLowerCase();
        if (!districtMap.has(dKey)) {
          const newDist = {
            id: u.districtId || `DST-${dName.replace(/\s+/g, '-').toUpperCase()}`,
            name: dName,
            code: dName.slice(0, 3).toUpperCase(),
            status: u.status === 'inactive' ? 'Inactive' : 'Active',
            divisions: []
          };
          districtMap.set(dKey, newDist);
          stateObj.districts.push(newDist);
        }
      }
    });

    let districts = Array.from(districtMap.values());

    if (req.user.role === 'District Admin' || req.user.role === 'Divisional Admin' || req.user.role === 'Pincode Admin') {
      districts = districts.filter(d => d.name.toLowerCase() === (req.user.district || '').toLowerCase());
    }

    const maxLimit = SUB_ADMIN_LIMITS['District Admin'] || 1;

    const enrichedDistricts = districts.map(d => {
      const distAdmins = allUsers.filter(u =>
        u.state?.trim().toLowerCase() === userState.toLowerCase() &&
        u.district?.trim().toLowerCase() === d.name.toLowerCase() &&
        (u.role === 'District Admin' || (u.role || '').toLowerCase().includes('district admin'))
      );

      const distDivAdmins = allUsers.filter(u =>
        u.state?.trim().toLowerCase() === userState.toLowerCase() &&
        u.district?.trim().toLowerCase() === d.name.toLowerCase() &&
        (u.role === 'Division Admin' || u.role === 'Divisional Admin')
      );

      const distPinAdmins = allUsers.filter(u =>
        u.state?.trim().toLowerCase() === userState.toLowerCase() &&
        u.district?.trim().toLowerCase() === d.name.toLowerCase() &&
        u.role === 'Pincode Admin'
      );

      const distManagers = allUsers.filter(u =>
        (u.district?.trim().toLowerCase() === d.name.toLowerCase() || (u.districtId && String(u.districtId).toLowerCase() === String(d.id).toLowerCase())) &&
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

      const distAgents = (db.agents || []).filter(a =>
        a.district?.trim().toLowerCase() === d.name.toLowerCase()
      );
      const distVendors = (db.vendors || []).filter(v =>
        v.district?.trim().toLowerCase() === d.name.toLowerCase()
      );
      const distOrders = (db.orders || []).filter(o =>
        o.district?.trim().toLowerCase() === d.name.toLowerCase()
      );
      const distBookings = (db.bookings || []).filter(b =>
        b.district?.trim().toLowerCase() === d.name.toLowerCase()
      );
      const distJobs = (db.jobs || []).filter(j =>
        j.district?.trim().toLowerCase() === d.name.toLowerCase()
      );
      const distTechnicians = (db.technicians || []).filter(t =>
        t.district?.trim().toLowerCase() === d.name.toLowerCase()
      );
      const distExecutives = (db.executives || []).filter(e =>
        e.district?.trim().toLowerCase() === d.name.toLowerCase()
      );
      const distKYC = (db.kycRecords || []).filter(k =>
        k.district?.trim().toLowerCase() === d.name.toLowerCase() && k.status === 'Pending'
      );
      const distCustomers = (db.customers || []).filter(c =>
        c.district?.trim().toLowerCase() === d.name.toLowerCase()
      );

      const assigned = distAdmins[0] || null;
      const status = d.status || (assigned?.status === 'inactive' ? 'Inactive' : 'Active');

      return {
        ...d,
        divisionsCount: (d.divisions && d.divisions.length > 0) ? d.divisions.length : distDivAdmins.length,
        pincodesCount: distPinAdmins.length,
        status,
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
        adminId: assigned?._id || assigned?.id || null,
        adminName: assigned ? (assigned.name || '').replace(/\s*\(.*?\)\s*/g, '').trim() : 'Unassigned',
        adminEmail: assigned?.email || null,
        adminPhone: assigned?.phone || assigned?.mobile || null,
        adminDob: assigned?.dob || null,
        adminAvatarUrl: assigned?.avatarUrl || null,
        adminAddress: assigned?.address || null,
        adminCity: assigned?.city || null,
        adminPincode: assigned?.pincode || null,
        adminAadharNumber: assigned?.aadharNumber || null,
        adminPanNumber: assigned?.panNumber || null,
        adminAccountHolder: assigned?.accountHolderName || null,
        adminBankName: assigned?.bankName || null,
        adminAccountNumber: assigned?.accountNumber || null,
        adminIfsc: assigned?.ifscCode || null,
        adminBranch: assigned?.branchName || null,
        adminLoginId: assigned?.loginId || null,
        adminCreatedAt: assigned?.createdAt || null,
      };
    });

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
      stateObj = {
        id: `ST-${stateName.slice(0, 3).toUpperCase()}`,
        name: stateName,
        code: stateName.slice(0, 2).toUpperCase(),
        districts: []
      };
      db.hierarchy.states.push(stateObj);
    }

    let dist = stateObj.districts.find(d => d.name?.toLowerCase() === districtName.trim().toLowerCase());
    if (!dist) {
      dist = {
        id: `DST-${districtName.trim().replace(/\s+/g, '-').toUpperCase()}`,
        name: districtName.trim(),
        code: districtName.trim().slice(0, 3).toUpperCase(),
        status: status || 'Active',
        divisions: []
      };
      stateObj.districts.push(dist);
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
    const stateObj = db.hierarchy.states.find(s => s.name === req.user.state);
    if (!stateObj) return res.json({ success: true, divisions: [] });

    let divisions = [];
    stateObj.districts.forEach(d => {
      if (!req.user.district || d.name === req.user.district) {
        d.divisions.forEach(div => {
          if (!req.user.division || div.name === req.user.division) {
            const assigned = allUsers.find(a =>
              a.division?.toLowerCase() === div.name.toLowerCase() &&
              (a.role === 'Divisional Admin' || a.role === 'Division Admin' || (a.role || '').toLowerCase().includes('division'))
            );
            const adminName = assigned ? assigned.name.replace(/\s*\(.*?\)\s*/g, '').trim() : 'Unassigned';
            const adminEmail = assigned ? assigned.email : '-';
            const status = div.status || (assigned?.status === 'inactive' ? 'Inactive' : 'Active');

            const divPinAdmins = allUsers.filter(u =>
              (u.role === 'Pincode Admin' || (u.role || '').toLowerCase().includes('pincode admin')) &&
              u.division?.toLowerCase() === div.name.toLowerCase() &&
              (u.state || 'Tamil Nadu').toLowerCase() === (stateObj.name || 'Tamil Nadu').toLowerCase()
            );

            const activePincodes = Array.from(new Set([
              ...(div.pincodes || []),
              ...divPinAdmins.map(p => String(p.pincode).trim()).filter(Boolean)
            ]));

            divisions.push({
              ...div,
              pincodes: activePincodes,
              pincodesCount: activePincodes.length,
              registeredPincodeAdminsCount: divPinAdmins.length,
              districtName: d.name,
              stateName: stateObj.name,
              adminName,
              adminEmail,
              adminPhone: assigned?.phone || assigned?.mobile || null,
              adminAadharNumber: assigned?.aadharNumber || null,
              adminPanNumber: assigned?.panNumber || null,
              status
            });
          }
        });
      }
    });

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

    const allUsers = Array.from(db.users);
    const stateName = assignedState || req.user.state || 'Tamil Nadu';
    const districtName = assignedDistrict || req.user.district || 'Salem';

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
      stateObj = {
        id: `ST-${stateName.slice(0, 3).toUpperCase()}`,
        name: stateName,
        code: stateName.slice(0, 2).toUpperCase(),
        districts: []
      };
      db.hierarchy.states.push(stateObj);
    }

    let dist = stateObj.districts.find(d => d.name?.toLowerCase() === districtName.trim().toLowerCase());
    if (!dist) {
      dist = {
        id: `DST-${districtName.trim().replace(/\s+/g, '-').toUpperCase()}`,
        name: districtName.trim(),
        code: districtName.trim().slice(0, 3).toUpperCase(),
        status: 'Active',
        divisions: []
      };
      stateObj.districts.push(dist);
    }

    let div = dist.divisions?.find(dv => dv.name?.toLowerCase() === divisionName.trim().toLowerCase());
    if (!div) {
      div = {
        id: `DIV-${divisionName.trim().replace(/\s+/g, '-').toUpperCase()}`,
        name: divisionName.trim(),
        code: divisionName.trim().slice(0, 3).toUpperCase(),
        pincodes: []
      };
      if (!dist.divisions) dist.divisions = [];
      dist.divisions.push(div);
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
    const userRole = req.user.role;
    const isSuperAdmin = userRole === 'Super Admin' || req.user.state === 'All India';

    const queryState = req.query.state;
    const queryDistrict = req.query.district;
    const queryDivision = req.query.division;

    const targetState = queryState || (!isSuperAdmin ? req.user.state : null);
    const targetDistrict = queryDistrict || req.user.district;
    const targetDivision = queryDivision || req.user.division;

    const clean = (s) => (s || '').toLowerCase().replace(/tth/g, 'tt').replace(/\s+division/g, '').replace(/^div-/, '').replace(/^dst-/, '').trim();
    const targetStateClean = clean(targetState);
    const targetDistClean = clean(targetDistrict);
    const targetDivClean = clean(targetDivision);

    // 1. Fetch registered Pincode Admins
    const pincodeAdmins = allUsers.filter(u => {
      const isPinAdmin = u.role === 'Pincode Admin' || (u.role || '').toLowerCase().includes('pincode admin');
      if (!isPinAdmin) return false;
      if (targetState && targetState !== 'All India') {
        const uState = clean(u.state || 'Tamil Nadu');
        if (uState !== targetStateClean && !uState.includes(targetStateClean) && !targetStateClean.includes(uState)) return false;
      }
      if (targetDistrict) {
        const uDist = clean(u.district);
        if (uDist !== targetDistClean && !uDist.includes(targetDistClean) && !targetDistClean.includes(uDist)) return false;
      }
      if (targetDivision) {
        const uDiv = clean(u.division);
        if (uDiv !== targetDivClean && !uDiv.includes(targetDivClean) && !targetDivClean.includes(uDiv)) return false;
      }
      return true;
    });

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

    pincodeAdmins.forEach(admin => {
      const pin = String(admin.pincode || '').trim();
      if (pin) {
        const pinVendors = allVendors.filter(v => String(v.pincode || '').trim() === pin).length;
        const pinOrders = allOrders.filter(o => String(o.pincode || '').trim() === pin).length;
        const pinBookings = allBookings.filter(b => String(b.pincode || '').trim() === pin).length;
        const pinCustomers = allCustomers.filter(c => String(c.pincode || '').trim() === pin).length;
        const pinManagers = allUsers.filter(u => String(u.pincode || '').trim() === pin && (u.role || '').toLowerCase().includes('manager')).length;
        const pinAgents = allAgents.filter(a => String(a.pincode || '').trim() === pin).length;
        const pinTechnicians = allTechnicians.filter(t => String(t.pincode || '').trim() === pin).length;
        const pinExecutives = allExecutives.filter(e => String(e.pincode || '').trim() === pin).length;
        const pinKYC = allKYC.filter(k => String(k.pincode || '').trim() === pin && k.status === 'Pending').length;
        const pinJobs = allJobs.filter(j => String(j.pincode || '').trim() === pin).length;

        pincodesMap.set(pin, {
          id: admin.pincodeId || `pin_${pin}`,
          pincode: pin,
          areaName: admin.area || `${admin.division || targetDivision || 'Zone'} Hub`,
          division: admin.division || targetDivision || '-',
          divisionName: admin.division || targetDivision || '-',
          district: admin.district || targetDistrict || '-',
          districtName: admin.district || targetDistrict || '-',
          state: admin.state || targetState || 'Tamil Nadu',
          adminId: admin._id || admin.id,
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
      }
    });

    // 2. Add postal circle coverage only if explicitly requested
    if (req.query.includeUnassigned === 'true') {
      const statesToScan = db.hierarchy.states.filter(s => {
        if (!targetState || targetState === 'All India') return true;
        const sClean = clean(s.name);
        return sClean === targetStateClean || sClean.includes(targetStateClean) || targetStateClean.includes(sClean);
      });

      statesToScan.forEach(stateObj => {
        const sName = stateObj.name || 'Tamil Nadu';
        (stateObj.districts || []).forEach(d => {
          const dClean = clean(d.name);
          if (!targetDistrict || dClean === targetDistClean || dClean.includes(targetDistClean) || targetDistClean.includes(dClean)) {
            (d.divisions || []).forEach(div => {
              const divClean = clean(div.name);
              if (!targetDivision || divClean === targetDivClean || divClean.includes(targetDivClean) || targetDivClean.includes(divClean)) {
                const stdPins = getPincodesForDivision(sName, d.name, div.name);
                stdPins.forEach(pin => {
                  const pinStr = String(pin).trim();
                  if (!pincodesMap.has(pinStr)) {
                    pincodesMap.set(pinStr, {
                      id: `PIN-${pinStr}`,
                      pincode: pinStr,
                      areaName: `${div.name} Hub (${pinStr})`,
                      division: div.name,
                      divisionName: div.name,
                      district: d.name,
                      districtName: d.name,
                      state: sName,
                      adminId: null,
                      adminName: 'Unassigned',
                      adminEmail: '-',
                      adminPhone: '-',
                      status: 'Active',
                      customerCount: 0
                    });
                  }
                });

                (div.pincodes || []).forEach(pin => {
                  const pinStr = String(pin).trim();
                  if (!pincodesMap.has(pinStr)) {
                    pincodesMap.set(pinStr, {
                      id: `PIN-${pinStr}`,
                      pincode: pinStr,
                      areaName: `${div.name} Hub (${pinStr})`,
                      division: div.name,
                      divisionName: div.name,
                      district: d.name,
                      districtName: d.name,
                      state: sName,
                      adminId: null,
                      adminName: 'Unassigned',
                      adminEmail: '-',
                      adminPhone: '-',
                      status: 'Active',
                      customerCount: 0
                    });
                  }
                });
              }
            });
          }
        });
      });
    }

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
    const districtName = assignedDistrict || req.user.district || 'Salem';
    const divisionName = assignedDivision || req.user.division || 'Attur';
    const pincode = assignedPincode || addrPincode;

    if (!adminName || !email || !pincode) {
      return res.status(400).json({ success: false, message: 'Admin name, Email, and Assigned Pincode are required.' });
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
      stateObj = {
        id: `ST-${stateName.slice(0, 3).toUpperCase()}`,
        name: stateName,
        code: stateName.slice(0, 2).toUpperCase(),
        districts: []
      };
      db.hierarchy.states.push(stateObj);
    }

    let dist = stateObj.districts.find(d => d.name?.toLowerCase() === districtName.trim().toLowerCase());
    if (!dist) {
      dist = {
        id: `DST-${districtName.trim().replace(/\s+/g, '-').toUpperCase()}`,
        name: districtName.trim(),
        code: districtName.trim().slice(0, 3).toUpperCase(),
        status: 'Active',
        divisions: []
      };
      stateObj.districts.push(dist);
    }

    let div = dist.divisions?.find(dv => dv.name?.toLowerCase() === divisionName.trim().toLowerCase());
    if (!div) {
      div = {
        id: `DIV-${divisionName.trim().replace(/\s+/g, '-').toUpperCase()}`,
        name: divisionName.trim(),
        code: divisionName.trim().slice(0, 3).toUpperCase(),
        pincodes: []
      };
      if (!dist.divisions) dist.divisions = [];
      dist.divisions.push(div);
    }

    if (!div.pincodes.includes(String(pincode).trim())) {
      div.pincodes.push(String(pincode).trim());
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
      pincode: String(pincode).trim(),
      stateId: stateObj.id,
      districtId: dist.id,
      divisionId: div.id,
      pincodeId: `pin_${String(pincode).trim()}`,
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
      message: `Pincode Admin '${adminName}' successfully registered and assigned to PIN '${pincode}'.`,
      pincode: pincode
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
