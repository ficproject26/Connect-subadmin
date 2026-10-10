const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../config/db');
const { generateToken, JWT_SECRET } = require('../utils/jwt');
const { getMongoDb } = require('../config/mongo');
const { getAssignedPermissions } = require('../utils/permissions');

const ROLE_LIMITS = {
  state_manager: 8,      // 8 managers per State
  district_manager: 2,   // 2 managers per District
  division_manager: 2,   // 2 managers per Division
  pincode_manager: 10    // 10 managers per PIN Code
};

const ROLE_LEVELS = {
  'Super Admin': 0,
  'State Admin': 1,
  'District Admin': 2,
  'Divisional Admin': 3,
  'Division Admin': 3,
  'Pincode Admin': 4
};

// Authoritative role resolution: strictly maps only valid Sub-Admin management roles.
// Non-admin roles (Manager, Agent, Vendor, Customer, Staff) are strictly rejected (isAdmin: false).
const resolveAdminRole = (user) => {
  if (!user) return { role: '', level: 4, isAdmin: false };

  const rawRole = String(user.role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const adminRole = String(user.adminRole || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const adminLevel = String(user.adminLevel || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const levelStr = typeof user.level === 'string' ? user.level.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim() : '';

  // Explicitly deny non-admin roles
  if (
    rawRole.includes('manager') ||
    rawRole.includes('agent') ||
    rawRole.includes('vendor') ||
    rawRole.includes('customer') ||
    rawRole === 'member' ||
    adminRole === 'staff'
  ) {
    return { role: user.role, level: 4, isAdmin: false };
  }

  // 1. Super Admin / Main Admin
  if (
    rawRole === 'super admin' || rawRole === 'main admin' || rawRole === 'superadmin' ||
    adminRole === 'super admin' || adminRole === 'main admin' ||
    adminLevel === 'super' || adminLevel === 'main' ||
    (rawRole === 'admin' && (adminRole === 'super admin' || (!adminRole && !user.assignedState && !user.state)))
  ) {
    return { role: 'Super Admin', level: 0, isAdmin: true };
  }

  // 2. State Admin (Must check State BEFORE Pincode/Division/District to prevent schema default corruption)
  if (
    rawRole === 'state admin' ||
    adminRole === 'state admin' ||
    adminLevel === 'state' ||
    levelStr === 'state' ||
    (rawRole === 'admin' && (adminRole === 'state admin' || (!adminRole && (user.assignedState || user.state) && !user.assignedDistrict && !user.district && !user.assignedDivision && !user.division && !user.assignedPincode && !user.pincode)))
  ) {
    return { role: 'State Admin', level: 1, isAdmin: true };
  }

  // 3. District Admin
  if (
    rawRole === 'district admin' ||
    adminRole === 'district admin' ||
    adminLevel === 'district' ||
    levelStr === 'district' ||
    (rawRole === 'admin' && (adminRole === 'district admin' || (!adminRole && (user.assignedDistrict || user.district) && !user.assignedDivision && !user.division && !user.assignedPincode && !user.pincode)))
  ) {
    return { role: 'District Admin', level: 2, isAdmin: true };
  }

  // 4. Divisional / Division Admin
  if (
    rawRole === 'divisional admin' || rawRole === 'division admin' ||
    adminRole === 'divisional admin' || adminRole === 'division admin' ||
    adminLevel === 'division' || adminLevel === 'divisional' ||
    levelStr === 'division' || levelStr === 'divisional' ||
    (rawRole === 'admin' && (adminRole.includes('divis') || adminLevel.includes('divis'))) ||
    (rawRole === 'admin' && (!adminRole && (user.assignedDivision || user.division) && !user.assignedPincode && !user.pincode))
  ) {
    return { role: 'Divisional Admin', level: 3, isAdmin: true };
  }

  // 5. Pincode Admin
  if (
    rawRole === 'pincode admin' ||
    adminRole === 'pincode admin' ||
    adminLevel === 'pincode' ||
    (rawRole === 'admin' && (adminRole === 'pincode admin' || user.assignedPincode || user.pincode))
  ) {
    return { role: 'Pincode Admin', level: 4, isAdmin: true };
  }

  // Fallback for generic 'admin' role
  if (rawRole === 'admin') {
    if (adminRole.includes('state') || adminLevel === 'state') return { role: 'State Admin', level: 1, isAdmin: true };
    if (adminRole.includes('dist') || adminLevel === 'district') return { role: 'District Admin', level: 2, isAdmin: true };
    if (adminRole.includes('divis') || adminLevel === 'division') return { role: 'Divisional Admin', level: 3, isAdmin: true };
    if (adminRole.includes('pincode') || adminLevel === 'pincode') return { role: 'Pincode Admin', level: 4, isAdmin: true };
    if (user.assignedState || user.state) return { role: 'State Admin', level: 1, isAdmin: true };
    return { role: 'Super Admin', level: 0, isAdmin: true };
  }

  return { role: user.role, level: 4, isAdmin: false };
};


// Calculate occupancy for a location and role
const getOccupancy = async (role, { stateId, districtId, divisionId, pincodeId }) => {
  const users = await db.users.find();
  const occupiedUsers = users.filter(u => u.status === 'active' || u.status === 'under_review' || u.status === 'kyc_pending');
  const limit = ROLE_LIMITS[role] || 2;

  if (role === 'state_manager') {
    if (!stateId) return { count: 0, limit, isFull: false, remaining: limit };
    const matches = occupiedUsers.filter(u => u.role === 'state_manager' && u.stateId === stateId);
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  if (role === 'district_manager') {
    if (!districtId) return { count: 0, limit, isFull: false, remaining: limit };
    const matches = occupiedUsers.filter(u => u.role === 'district_manager' && u.districtId === districtId);
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  if (role === 'division_manager') {
    if (!divisionId) return { count: 0, limit, isFull: false, remaining: limit };
    const matches = occupiedUsers.filter(u => u.role === 'division_manager' && u.divisionId === divisionId);
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  if (role === 'pincode_manager') {
    if (!pincodeId) return { count: 0, limit, isFull: false, remaining: limit };
    const matches = occupiedUsers.filter(u => u.role === 'pincode_manager' && u.pincodeId === pincodeId);
    return { count: matches.length, limit, isFull: matches.length >= limit, remaining: Math.max(0, limit - matches.length) };
  }

  return { count: 0, limit, isFull: false, remaining: limit };
};

// Helper: build normalized user profile matching both portals
const buildUserProfile = async (user) => {
  const [regionObj, state, district, division, pincode] = await Promise.all([
    (user.regionId || user.stateId) ? db.states.findById(user.regionId || user.stateId) : null,
    user.stateId ? db.states.findById(user.stateId) : null,
    user.districtId ? db.districts.findById(user.districtId) : null,
    user.divisionId ? db.divisions.findById(user.divisionId) : null,
    user.pincodeId ? db.pincodes.findById(user.pincodeId) : null
  ]);

  const stateName = user.state || user.assignedState || state?.name || null;
  const districtName = user.district || user.assignedDistrict || district?.name || null;
  const divisionName = user.division || user.assignedDivision || division?.name || null;
  const pincodeCode = user.pincode || user.assignedPincode || pincode?.code || null;
  const avatar = user.avatar || user.avatarUrl || null;
  const mobile = user.mobile || user.phone || null;
  const phone = user.phone || user.mobile || null;
  const status = user.status || 'active';

  return {
    id: user._id || user.id,
    _id: user._id || user.id,
    name: user.name,
    email: user.email,
    mobile,
    phone,
    role: user.role,
    level: user.level || ROLE_LEVELS[user.role] || 1,
    permissions: user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0
      ? user.permissions
      : getAssignedPermissions(user.role),
    status,
    adminApprovalStatus: user.adminApprovalStatus || (status === 'kyc_pending' ? 'approved' : 'pending'),
    kycStatus: user.kycStatus || (status === 'active' ? 'Verified' : 'pending_verification'),
    dob: user.dob || null,
    gender: user.gender || null,
    address: user.address || null,
    documents: user.documents || {},
    avatar,
    avatarUrl: avatar,
    state: stateName,
    district: districtName,
    division: divisionName,
    pincode: pincodeCode,
    stateId: user.stateId || (state ? state._id : null),
    districtId: user.districtId || (district ? district._id : null),
    divisionId: user.divisionId || (division ? division._id : null),
    pincodeId: user.pincodeId || (pincode ? pincode._id : null),
    regionId: user.regionId || user.stateId,
    scope: {
      regionId: user.regionId || user.stateId,
      regionName: regionObj?.name || stateName,
      stateId: user.stateId || (state ? state._id : null),
      stateName,
      districtId: user.districtId || (district ? district._id : null),
      districtName,
      divisionId: user.divisionId || (division ? division._id : null),
      divisionName,
      pincodeId: user.pincodeId || (pincode ? pincode._id : null),
      pincodeCode,
      pincodeArea: pincode?.areaName || null
    }
  };
};

// Universal Login: accepts email or mobile / identifier / loginId
const login = async (req, res) => {
  try {
    const { email, identifier, loginId: rawLoginId, username, password } = req.body;
    const rawId = (identifier || email || rawLoginId || username || '').trim();
    const loginId = rawId.toLowerCase();

    if (!rawId || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email or mobile number, and password.' });
    }

    let user = null;
    const phoneDigits = rawId.replace(/[^0-9]/g, '');
    const isPhone = phoneDigits.length >= 10;

    // 1. Primary lookup: Check MongoDB Atlas users collection
    try {
      const mdb = await getMongoDb();
      if (mdb) {
        const safeRegex = new RegExp("^" + loginId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
        const queryConditions = [
          { email: loginId },
          { email: safeRegex },
          { loginId: rawId },
          { loginId: loginId },
          { registrationId: rawId },
          { registrationId: loginId },
          { username: loginId },
          { username: rawId }
        ];
        if (isPhone) {
          queryConditions.push({ phone: rawId });
          queryConditions.push({ phone: phoneDigits.slice(-10) });
          queryConditions.push({ mobile: rawId });
          queryConditions.push({ mobile: phoneDigits.slice(-10) });
        }
        const matchedUsers = await mdb.collection("users").find({ $or: queryConditions }).toArray();
        if (matchedUsers.length > 0) {
          // If multiple accounts share an identifier (e.g. agent and admin, or customer and admin),
          // prioritize authorized Admin accounts over non-admin accounts
          const adminUser = matchedUsers.find(u => resolveAdminRole(u).isAdmin);
          user = adminUser ? { ...adminUser } : { ...matchedUsers[0] };
        }
      }
    } catch (mErr) {
      console.warn("MongoDB lookup in login warning:", mErr.message);
    }

    // 2. Fallback lookup: Check local db.users (data/users.json)
    if (!user) {
      const allUsers = Array.from(db.users);
      const matches = allUsers.filter(u => 
        (u.email && u.email.toLowerCase() === loginId) ||
        (u.loginId && (u.loginId.toLowerCase() === loginId || u.loginId === rawId)) ||
        (u.registrationId && (u.registrationId.toLowerCase() === loginId || u.registrationId === rawId)) ||
        (isPhone && u.mobile && u.mobile.replace(/[^0-9]/g, '').slice(-10) === phoneDigits.slice(-10)) ||
        (isPhone && u.phone && u.phone.replace(/[^0-9]/g, '').slice(-10) === phoneDigits.slice(-10)) ||
        (u.id && String(u.id).toLowerCase() === loginId) ||
        (u._id && String(u._id).toLowerCase() === loginId)
      );
      if (matches.length > 0) {
        const adminUser = matches.find(u => resolveAdminRole(u).isAdmin);
        user = adminUser ? { ...adminUser } : { ...matches[0] };
      }
    }

    if (!user) {
      console.warn(`[AUTH] Failed login: User identifier '${loginId}' not found in database or local users.`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 1. Authoritative Role & Hierarchy Evaluation
    const roleInfo = resolveAdminRole(user);

    // Strictly enforce authorized Sub-Admin management portal access
    // Non-admin roles (Managers, Agents, Vendors, Customers) are denied access
    if (!roleInfo.isAdmin) {
      console.warn(`[AUTH] Access denied: User '${user.email || loginId}' has role '${user.role}' which is not permitted for the Sub-Admin Portal.`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // 2. Authoritative Password Verification
    let isMatch = false;
    const userHash = String(user.passwordHash || user.hash || user.hashedPassword || '').trim();
    if (userHash) {
      try {
        isMatch = bcrypt.compareSync(password, userHash) || (typeof password === 'string' && bcrypt.compareSync(password.trim(), userHash));
      } catch (e) {}
    }

    const rawPassword = user.password || user.tempPassword || user.plainPassword || user.pass;
    if (!isMatch && rawPassword) {
      const cleanRaw = typeof rawPassword === 'string' ? rawPassword.trim() : rawPassword;
      if (typeof cleanRaw === 'string' && (cleanRaw.startsWith('$2a$') || cleanRaw.startsWith('$2b$') || cleanRaw.startsWith('$2y$'))) {
        try {
          isMatch = bcrypt.compareSync(password, cleanRaw) || (typeof password === 'string' && bcrypt.compareSync(password.trim(), cleanRaw));
        } catch (e) {}
      } else if (rawPassword === password || rawPassword === password.trim() || cleanRaw === password || cleanRaw === password.trim()) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      console.warn(`[AUTH] Failed login: Incorrect password for user '${user.email || loginId}'.`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 3. Status Evaluation
    let currentStatus = (user.status || 'active').toLowerCase().trim();
    if (currentStatus === 'approved' || currentStatus === 'active') {
      currentStatus = 'active';
    }

    if (currentStatus === 'suspended' || currentStatus === 'revoked' || currentStatus === 'inactive' || currentStatus === 'blocked') {
      console.warn(`[AUTH] Access denied: User '${user.email || loginId}' account status is '${currentStatus}'.`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (currentStatus === 'rejected') {
      console.warn(`[AUTH] Access denied: User '${user.email || loginId}' application was rejected.`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (currentStatus !== 'active') {
      console.warn(`[AUTH] Access denied: User '${user.email || loginId}' account status is '${user.status || 'inactive'}'.`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Ensure active administrator is consistently marked active in database
    if (user.isActive === false || user.status !== 'approved') {
      user.isActive = true;
      user.status = 'approved';
      try {
        const mdb = await getMongoDb();
        if (mdb && user._id) {
          await mdb.collection('users').updateOne(
            { _id: user._id },
            { $set: { status: 'approved', isActive: true, kycStatus: 'Verified', adminApprovalStatus: 'approved' } }
          );
        }
      } catch (syncErr) {
        console.warn('Admin status sync warning:', syncErr.message);
      }
    }

    // 4. Territory Synchronization & User Mapping
    const finalState = user.state || user.assignedState || '';
    const finalDistrict = user.district || user.assignedDistrict || '';
    const finalDivision = user.division || user.assignedDivision || '';
    const finalPincode = user.pincode || user.assignedPincode || '';

    const mappedUser = {
      ...user,
      _id: user._id || user.id,
      id: user._id || user.id,
      role: roleInfo.role,
      level: roleInfo.level,
      status: 'active',
      isActive: true,
      state: finalState,
      assignedState: finalState,
      district: finalDistrict,
      assignedDistrict: finalDistrict,
      division: finalDivision,
      assignedDivision: finalDivision,
      pincode: finalPincode,
      assignedPincode: finalPincode,
      mobile: user.mobile || user.phone || '',
      phone: user.phone || user.mobile || ''
    };

    const token = generateToken(mappedUser);
    const userProfile = await buildUserProfile(mappedUser);

    return res.json({
      success: true,
      message: 'Welcome ' + (mappedUser.name || 'Admin') + '. Logged in successfully.',
      token,
      user: userProfile
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed', error: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    let user = null;

    try {
      const mdb = await getMongoDb();
      if (mdb) {
        const { ObjectId } = require('mongodb');
        try {
          user = await mdb.collection('users').findOne({ _id: new ObjectId(userId) });
        } catch (e) {
          user = await mdb.collection('users').findOne({ _id: String(userId) });
        }
      }
    } catch (mErr) {
      console.warn('MongoDB getMe lookup warning:', mErr.message);
    }

    if (!user) {
      const allUsers = Array.from(db.users);
      user = allUsers.find(u => String(u._id || u.id) === String(userId));
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Role check
    const roleInfo = resolveAdminRole(user);
    if (!roleInfo.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Your account does not have permission to access this application.'
      });
    }

    // Status check
    const currentStatus = (user.status || 'active').toLowerCase().trim();
    if (currentStatus === 'suspended' || currentStatus === 'revoked' || currentStatus === 'inactive' || currentStatus === 'blocked') {
      return res.status(403).json({
        success: false,
        status: currentStatus,
        message: 'Your account is currently ' + currentStatus.replace(/_/g, ' ') + '. Access is disabled.'
      });
    }

    const finalState = user.state || user.assignedState || '';
    const finalDistrict = user.district || user.assignedDistrict || '';
    const finalDivision = user.division || user.assignedDivision || '';
    const finalPincode = user.pincode || user.assignedPincode || '';

    const mappedUser = {
      ...user,
      _id: user._id || user.id,
      id: user._id || user.id,
      role: roleInfo.role,
      level: roleInfo.level,
      status: 'active',
      isActive: true,
      state: finalState,
      assignedState: finalState,
      district: finalDistrict,
      assignedDistrict: finalDistrict,
      division: finalDivision,
      assignedDivision: finalDivision,
      pincode: finalPincode,
      assignedPincode: finalPincode,
      mobile: user.mobile || user.phone || '',
      phone: user.phone || user.mobile || ''
    };

    const profile = await buildUserProfile(mappedUser);
    return res.json({ success: true, user: profile });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile', error: err.message });
  }
};

const getDemoAdmins = (req, res) => {
  const demoList = db.admins.map(a => ({
    id: a.id || a._id,
    name: a.name,
    email: a.email,
    role: a.role,
    state: a.state,
    district: a.district,
    division: a.division,
    pincode: a.pincode,
    avatar: a.avatar || a.avatarUrl
  }));

  return res.json({ success: true, admins: demoList });
};

const register = async (req, res) => {
  try {
    let {
      name,
      fullName,
      email,
      mobile,
      phone,
      password,
      role,
      dob,
      gender,
      address,
      documents,
      declarationAccepted,
      stateId,
      zone,
      districtId,
      divisionId,
      pincodeId,
      state,
      district,
      division,
      pincode,
      avatarUrl
    } = req.body;

    name = (name || fullName || '').trim();
    mobile = (mobile || phone || '').trim();

    if (!stateId && (state || zone)) {
      const stName = (state || zone || '').toLowerCase();
      const sObj = Array.from(db.states).find(s => s.name?.toLowerCase() === stName);
      if (sObj) stateId = sObj._id || sObj.id;
    }
    if (!districtId && district) {
      const distName = district.toLowerCase();
      const dObj = Array.from(db.districts).find(d => d.name?.toLowerCase() === distName);
      if (dObj) districtId = dObj._id || dObj.id;
    }
    if (!divisionId && division) {
      const divName = division.toLowerCase();
      const divObj = Array.from(db.divisions).find(d => d.name?.toLowerCase() === divName);
      if (divObj) divisionId = divObj._id || divObj.id;
    }
    if (!pincodeId && pincode) {
      const pObj = Array.from(db.pincodes).find(p => String(p.code) === String(pincode));
      if (pObj) pincodeId = pObj._id || pObj.id;
    }

    if (!name || !email || !mobile || !password || !role) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields: Full Name, Email, Mobile, Password, and Role.' });
    }

    const kycErr = validateKycDocuments(req.body);
    if (kycErr) {
      return res.status(400).json({ success: false, message: kycErr });
    }

    if (!['state_manager', 'district_manager', 'division_manager', 'pincode_manager'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid manager role selected.' });
    }

    if (role === 'state_manager' && !stateId && !state) {
      return res.status(400).json({ success: false, message: 'State selection is required for State Manager.' });
    }
    if (role === 'district_manager' && (!stateId && !state || !districtId && !district)) {
      return res.status(400).json({ success: false, message: 'State and District selections are required for District Manager.' });
    }
    if (role === 'division_manager' && (!stateId && !state || !districtId && !district || !divisionId && !division)) {
      return res.status(400).json({ success: false, message: 'State, District, and Division selections are required for Division Manager.' });
    }
    if (role === 'pincode_manager' && (!stateId && !state || !districtId && !district || !divisionId && !division || !pincodeId && !pincode)) {
      return res.status(400).json({ success: false, message: 'State, District, Division, and PIN Code selections are required for PIN Code Manager.' });
    }

    const existingEmail = await db.users.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'An account with this email address already exists. Please sign in or use another email.' });
    }

    const existingMobile = await db.users.findOne({ mobile: mobile.trim() });
    if (existingMobile) {
      return res.status(400).json({ success: false, message: 'An account with this mobile number already exists. Please sign in or use another mobile number.' });
    }

    const occupancy = await getOccupancy(role, { stateId, districtId, divisionId, pincodeId });
    if (occupancy.isFull) {
      return res.status(400).json({
        success: false,
        limitReached: true,
        message: `This place has reached its maximum manager capacity (${occupancy.count}/${occupancy.limit}). Registration not allowed for this location.`
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const level = ROLE_LEVELS[role] || 1;

    const [selectedState, selectedDistrict, selectedDivision, selectedPincode] = await Promise.all([
      stateId ? db.states.findById(stateId) : null,
      districtId ? db.districts.findById(districtId) : null,
      divisionId ? db.divisions.findById(divisionId) : null,
      pincodeId ? db.pincodes.findById(pincodeId) : null
    ]);

    const stateName = selectedState?.name || req.body.state || null;
    const districtName = selectedDistrict?.name || req.body.district || null;
    const divisionName = selectedDivision?.name || req.body.division || null;
    const pincodeCode = selectedPincode?.code || req.body.pincode || null;

    // Resolve the related administrator for this manager's role and jurisdiction
    let targetAdminRole = null;
    let targetJurisdiction = null;
    let relatedAdmin = null;

    const allAdmins = Array.from(db.users).filter(u => (u.role || '').toLowerCase().includes('admin'));

    if (role === 'state_manager') {
      targetAdminRole = 'State Admin';
      targetJurisdiction = `State: ${stateName || stateId}`;
      relatedAdmin = allAdmins.find(a => 
        (a.role === 'State Admin' || (a.role || '').toLowerCase().includes('state')) &&
        ((a.stateId && stateId && String(a.stateId).toLowerCase() === String(stateId).toLowerCase()) ||
         (a.state && stateName && a.state.trim().toLowerCase() === stateName.trim().toLowerCase()))
      );
    } else if (role === 'district_manager') {
      targetAdminRole = 'District Admin';
      targetJurisdiction = `District: ${districtName || districtId}, ${stateName || stateId}`;
      relatedAdmin = allAdmins.find(a => 
        (a.role === 'District Admin' || (a.role || '').toLowerCase().includes('district')) &&
        ((a.districtId && districtId && String(a.districtId).toLowerCase() === String(districtId).toLowerCase()) ||
         (a.district && districtName && a.district.trim().toLowerCase() === districtName.trim().toLowerCase()) ||
         ((a.district === 'Salem' || a.districtId === 'dist_salem') && (districtId === 'dist_salem' || districtName === 'Salem')))
      );
    } else if (role === 'division_manager') {
      targetAdminRole = 'Divisional Admin';
      targetJurisdiction = `Division: ${divisionName || divisionId}, ${districtName || districtId}`;
      relatedAdmin = allAdmins.find(a => 
        (a.role === 'Divisional Admin' || a.role === 'Division Admin' || (a.role || '').toLowerCase().includes('division')) &&
        ((a.divisionId && divisionId && String(a.divisionId).toLowerCase() === String(divisionId).toLowerCase()) ||
         (a.division && divisionName && a.division.trim().toLowerCase() === divisionName.trim().toLowerCase()) ||
         ((a.division === 'Salem North' || a.divisionId === 'div_dist_salem_urban') && (divisionId === 'div_dist_salem_urban' || divisionName === 'Salem North')))
      );
    } else if (role === 'pincode_manager') {
      targetAdminRole = 'Pincode Admin';
      targetJurisdiction = `PIN: ${pincodeCode || pincodeId}`;
      relatedAdmin = allAdmins.find(a => 
        (a.role === 'Pincode Admin' || (a.role || '').toLowerCase().includes('pincode')) &&
        ((a.pincodeId && pincodeId && String(a.pincodeId).toLowerCase() === String(pincodeId).toLowerCase()) ||
         (a.pincode && pincodeCode && String(a.pincode).trim() === String(pincodeCode).trim()) ||
         (a.pincode && pincodeId && pincodeId === `pin_${String(a.pincode).trim()}`))
      );
    }

    const newUser = await db.users.insertOne({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      phone: mobile.trim(),
      passwordHash,
      role,
      level,
      status: 'pending_admin_approval',
      adminApprovalStatus: 'pending',
      registrationType: 'direct',
      targetAdminRole,
      targetAdminId: relatedAdmin ? (relatedAdmin._id || relatedAdmin.id) : null,
      targetAdminName: relatedAdmin ? relatedAdmin.name : null,
      targetJurisdiction,
      assignedAdminId: relatedAdmin ? (relatedAdmin._id || relatedAdmin.id) : null,
      dob: dob || null,
      gender: gender || null,
      address: address ? address.trim() : null,
      aadharNumber: (req.body.aadharNumber || '').toString().trim().replace(/\s+/g, '') || null,
      panNumber: (req.body.panNumber || '').toString().trim().toUpperCase() || null,
      aadharPhoto: req.body.aadharUrl || req.body.aadharPhoto || req.body.documents?.aadharUrl || null,
      panPhoto: req.body.panUrl || req.body.panPhoto || req.body.documents?.panUrl || null,
      documents: {
        aadharNumber: (req.body.aadharNumber || '').toString().trim().replace(/\s+/g, '') || null,
        panNumber: (req.body.panNumber || '').toString().trim().toUpperCase() || null,
        aadharUrl: req.body.aadharUrl || req.body.aadharPhoto || req.body.documents?.aadharUrl || null,
        aadharFileName: req.body.aadharFileName || 'Aadhaar_Document',
        panUrl: req.body.panUrl || req.body.panPhoto || req.body.documents?.panUrl || null,
        panFileName: req.body.panFileName || 'PAN_Document',
        bankUrl: req.body.bankUrl || req.body.bankPhoto || req.body.documents?.bankUrl || null,
        bankFileName: req.body.bankFileName || 'Bank_Passbook',
        signatureUrl: req.body.signatureUrl || req.body.signaturePhoto || req.body.documents?.signatureUrl || null,
        signatureFileName: req.body.signatureFileName || 'Specimen_Signature',
        passportUrl: req.body.passportUrl || req.body.documents?.passportUrl || null,
        passportFileName: req.body.passportFileName || 'Passport_Document'
      },
      kycDocs: {
        aadhaarFront: { url: req.body.aadharUrl || req.body.aadharPhoto || null, name: req.body.aadharFileName || 'Aadhaar_Document' },
        panCard: { url: req.body.panUrl || req.body.panPhoto || null, name: req.body.panFileName || 'PAN_Document' },
        bankPassbook: { url: req.body.bankUrl || req.body.bankPhoto || null, name: req.body.bankFileName || 'Bank_Passbook' },
        signature: { url: req.body.signatureUrl || req.body.signaturePhoto || null, name: req.body.signatureFileName || 'Specimen_Signature' },
        passport: { url: req.body.passportUrl || null, name: req.body.passportFileName || 'Passport_Document' }
      },
      declarationAccepted: !!declarationAccepted,
      kycStatus: 'pending_verification',
      state: stateName,
      district: districtName,
      division: divisionName,
      pincode: pincodeCode,
      stateId: stateId || null,
      zone: zone || null,
      districtId: districtId || null,
      divisionId: divisionId || null,
      pincodeId: pincodeId || null,
      regionId: stateId || null,
      avatarUrl: avatarUrl || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.auditLogs.insertOne({
      action: 'MANAGER_DIRECT_REGISTERED_PENDING_ADMIN',
      userId: newUser._id,
      userName: newUser.name,
      userRole: newUser.role,
      targetAdminRole,
      targetAdminId: relatedAdmin ? (relatedAdmin._id || relatedAdmin.id) : null,
      targetAdminName: relatedAdmin ? relatedAdmin.name : null,
      details: `New ${role.replace('_', ' ')} direct registration submitted. Routed to ${targetAdminRole} (${relatedAdmin ? relatedAdmin.name : 'Pending admin assignment'}) for jurisdiction: ${targetJurisdiction}. Status: pending_admin_approval.`,
      ip: req.ip || '127.0.0.1'
    });

    const userProfile = await buildUserProfile(newUser);

    res.status(201).json({
      success: true,
      status: 'pending_admin_approval',
      message: `Manager registration submitted successfully. Your request has been routed to your designated ${targetAdminRole} (${targetJurisdiction}) for review and approval. Once approved, your account will be activated for login.`,
      user: userProfile
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during registration' });
  }
};

const checkCapacity = async (req, res) => {
  try {
    const { role, stateId, districtId, divisionId, pincodeId } = req.query;
    if (!role) {
      return res.status(400).json({ success: false, message: 'Role parameter is required.' });
    }

    const occupancy = await getOccupancy(role, { stateId, districtId, divisionId, pincodeId });
    res.json({
      success: true,
      role,
      limit: occupancy.limit,
      currentCount: occupancy.count,
      remaining: occupancy.remaining,
      isFull: occupancy.isFull,
      isAllowed: !occupancy.isFull
    });
  } catch (err) {
    console.error('Check capacity error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify location capacity' });
  }
};

const simulateApproval = async (req, res) => {
  try {
    const { userId } = req.body;
    const targetId = userId || req.user?.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'User ID is required to simulate approval.' });
    }

    const user = await db.users.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await db.users.findByIdAndUpdate(user._id, { 
      status: 'active',
      adminApprovalStatus: 'approved',
      adminApprovedAt: new Date().toISOString(),
      kycStatus: 'Verified'
    });
    const updatedUser = await db.users.findById(user._id);

    // Sync to KYC queue for compliance team
    if (db.kycRecords) {
      let existingKyc = db.kycRecords.find(k => String(k.managerId) === String(user._id) || k.id === `KYC-MGR-${user._id}`);
      if (!existingKyc) {
        await db.kycRecords.insertOne({
          id: `KYC-MGR-${user._id}`,
          type: 'Manager',
          managerId: String(user._id),
          name: user.name,
          vendorName: user.name,
          category: 'Operations Management',
          role: user.role,
          phone: user.mobile || user.phone,
          email: user.email,
          state: user.state,
          district: user.district,
          division: user.division,
          pincode: user.pincode,
          stateId: user.stateId,
          districtId: user.districtId,
          divisionId: user.divisionId,
          pincodeId: user.pincodeId,
          status: 'Pending',
          kycStatus: 'Pending Verification',
          submittedDate: new Date().toISOString().split('T')[0],
          documents: user.documents || {},
          notes: `Direct registration approved by ${user.targetAdminRole || 'Regional Admin'}. Forwarded to KYC Team.`
        });
      } else {
        await db.kycRecords.findByIdAndUpdate(existingKyc._id || existingKyc.id, {
          status: 'Pending',
          kycStatus: 'Pending Verification'
        });
      }
    }

    await db.auditLogs.insertOne({
      action: 'ADMIN_APPROVAL_SIMULATED',
      userId: updatedUser._id,
      userName: updatedUser.name,
      userRole: updatedUser.role,
      details: `Regional administrator approved application for ${updatedUser.name} (${updatedUser.role}). Next requirement: KYC document verification.`,
      ip: req.ip || '127.0.0.1'
    });

    const profile = await buildUserProfile(updatedUser);
    res.json({
      success: true,
      status: 'active',
      message: 'Admin approval granted! Manager account is now Active and login is enabled.',
      user: profile
    });
  } catch (err) {
    console.error('Simulate approval error:', err);
    res.status(500).json({ success: false, message: 'Failed to simulate approval' });
  }
};

const simulateKyc = async (req, res) => {
  try {
    const { userId } = req.body;
    const targetId = userId || req.user?.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'User ID is required to simulate KYC verification.' });
    }

    const user = await db.users.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await db.users.findByIdAndUpdate(user._id, {
      status: 'active',
      kycStatus: 'Verified',
      kycVerifiedAt: new Date().toISOString()
    });
    const updatedUser = await db.users.findById(user._id);

    // Sync KYC record to Verified
    if (db.kycRecords) {
      let existingKyc = db.kycRecords.find(k => String(k.managerId) === String(user._id) || k.id === `KYC-MGR-${user._id}`);
      if (existingKyc) {
        await db.kycRecords.findByIdAndUpdate(existingKyc._id || existingKyc.id, {
          status: 'Approved',
          kycStatus: 'Verified',
          verifiedBy: 'KYC Compliance Officer',
          verifiedDate: new Date().toISOString().split('T')[0]
        });
      }
    }

    await db.auditLogs.insertOne({
      action: 'KYC_VERIFICATION_SIMULATED',
      userId: updatedUser._id,
      userName: updatedUser.name,
      userRole: updatedUser.role,
      details: `KYC verification completed for ${updatedUser.name}. Account status transitioned to active with full portal access.`,
      ip: req.ip || '127.0.0.1'
    });

    const profile = await buildUserProfile(updatedUser);
    res.json({
      success: true,
      status: 'active',
      message: 'KYC verified successfully! Your account is now active.',
      user: profile
    });
  } catch (err) {
    console.error('Simulate KYC error:', err);
    res.status(500).json({ success: false, message: 'Failed to simulate KYC' });
  }
};

const getRegistrationLocations = async (req, res) => {
  try {
    const states = await db.states.find();
    const allDistricts = await db.districts.find();
    const allDivisions = await db.divisions.find();
    const allPincodes = await db.pincodes.find();

    const users = await db.users.find();
    const activeOrPending = users.filter(u => u.status === 'active' || u.status === 'under_review' || u.status === 'kyc_pending');

    // Show all districts for registration
    const districts = allDistricts;
    const divisions = allDivisions;
    const pincodes = allPincodes;

    const enrichedStates = states.map(s => {
      const count = activeOrPending.filter(u => u.role === 'state_manager' && u.stateId === s._id).length;
      return { ...s, managerCount: count, limit: ROLE_LIMITS.state_manager, isFull: count >= ROLE_LIMITS.state_manager };
    });

    const enrichedDistricts = districts.map(d => {
      const count = activeOrPending.filter(u => u.role === 'district_manager' && u.districtId === d._id).length;
      return { ...d, managerCount: count, limit: ROLE_LIMITS.district_manager, isFull: count >= ROLE_LIMITS.district_manager };
    });

    const enrichedDivisions = divisions.map(v => {
      const count = activeOrPending.filter(u => u.role === 'division_manager' && u.divisionId === v._id).length;
      return { ...v, managerCount: count, limit: ROLE_LIMITS.division_manager, isFull: count >= ROLE_LIMITS.division_manager };
    });

    const enrichedPincodes = pincodes.map(p => {
      const count = activeOrPending.filter(u => u.role === 'pincode_manager' && u.pincodeId === p._id).length;
      return { ...p, managerCount: count, limit: ROLE_LIMITS.pincode_manager, isFull: count >= ROLE_LIMITS.pincode_manager };
    });

    res.json({
      success: true,
      states: enrichedStates,
      districts: enrichedDistricts,
      divisions: enrichedDivisions,
      pincodes: enrichedPincodes,
      roleLimits: ROLE_LIMITS
    });
  } catch (err) {
    console.error('Get registration locations error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve location data' });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      avatarUrl: fileUrl,
      file: {
        name: req.file.originalname,
        filename: req.file.filename,
        url: fileUrl,
        size: req.file.size
      }
    });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ success: false, message: 'Avatar upload failed' });
  }
};

const uploadDocument = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file uploaded.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      file: {
        name: req.file.originalname,
        filename: req.file.filename,
        url: fileUrl,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ success: false, message: 'Document upload failed' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const userId = req.user.id || req.user._id;
    let user = null;

    try {
      const mdb = await getMongoDb();
      if (mdb) {
        const { ObjectId } = require('mongodb');
        let queryId = userId;
        try {
          if (typeof userId === 'string' && ObjectId.isValid(userId)) {
            queryId = new ObjectId(userId);
          }
        } catch (e) {}
        user = await mdb.collection('users').findOne({
          $or: [{ _id: queryId }, { _id: String(userId) }, { id: String(userId) }]
        });
      }
    } catch (mErr) {
      console.warn('MongoDB changePassword lookup warning:', mErr.message);
    }

    if (!user) {
      user = await db.users.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userHash = user.passwordHash || user.password;
    const isMatch = userHash ? (bcrypt.compareSync(currentPassword, userHash) || bcrypt.compareSync(currentPassword.trim(), userHash)) : false;
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);

    // Update in MongoDB Atlas
    try {
      const mdb = await getMongoDb();
      if (mdb && user._id) {
        const { ObjectId } = require('mongodb');
        let queryId = user._id;
        try {
          if (typeof user._id === 'string' && ObjectId.isValid(user._id)) {
            queryId = new ObjectId(user._id);
          }
        } catch (e) {}
        await mdb.collection('users').updateOne(
          { $or: [{ _id: queryId }, { _id: String(user._id) }] },
          {
            $set: {
              passwordHash,
              password: passwordHash,
              passwordChangedAt: new Date().toISOString()
            }
          }
        );
      }
    } catch (updateErr) {
      console.warn('MongoDB change password update warning:', updateErr.message);
    }

    // Also update in local db.users
    try {
      await db.users.findByIdAndUpdate(user._id || user.id, { passwordHash, password: passwordHash });
    } catch (e) {}

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = null;

    // Check MongoDB Atlas
    try {
      const mdb = await getMongoDb();
      if (mdb) {
        user = await mdb.collection('users').findOne({
          $or: [
            { email: cleanEmail },
            { email: new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
          ]
        });
      }
    } catch (mErr) {
      console.warn('MongoDB forgotPassword lookup warning:', mErr.message);
    }

    if (!user) {
      user = await db.users.findOne({ email: cleanEmail });
    }

    if (!user) {
      // Generic success to prevent user enumeration
      return res.json({
        success: true,
        message: 'If the email exists in our system, a password reset link has been dispatched.'
      });
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000).toISOString();

    // Update in MongoDB Atlas
    try {
      const mdb = await getMongoDb();
      if (mdb && user._id) {
        const { ObjectId } = require('mongodb');
        let queryId = user._id;
        try {
          if (typeof user._id === 'string' && ObjectId.isValid(user._id)) {
            queryId = new ObjectId(user._id);
          }
        } catch (e) {}
        await mdb.collection('users').updateOne(
          { $or: [{ _id: queryId }, { _id: String(user._id) }, { email: cleanEmail }] },
          { $set: { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires } }
        );
      }
    } catch (updateErr) {
      console.warn('MongoDB reset token update warning:', updateErr.message);
    }

    // Also update in local db.users
    try {
      await db.users.findByIdAndUpdate(user._id || user.id, {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires
      });
    } catch (e) {}

    res.json({
      success: true,
      message: 'Password reset link generated.',
      demoResetToken: resetToken
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Failed to process forgot password request' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    let user = null;
    try {
      const mdb = await getMongoDb();
      if (mdb) {
        user = await mdb.collection('users').findOne({ resetPasswordToken: token });
      }
    } catch (mErr) {
      console.warn('MongoDB resetPassword lookup warning:', mErr.message);
    }

    if (!user) {
      user = await db.users.findOne({ resetPasswordToken: token });
    }

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    if (new Date(user.resetPasswordExpires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token has expired' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);

    // Update in MongoDB Atlas
    try {
      const mdb = await getMongoDb();
      if (mdb && user._id) {
        const { ObjectId } = require('mongodb');
        let queryId = user._id;
        try {
          if (typeof user._id === 'string' && ObjectId.isValid(user._id)) {
            queryId = new ObjectId(user._id);
          }
        } catch (e) {}
        await mdb.collection('users').updateOne(
          { $or: [{ _id: queryId }, { _id: String(user._id) }] },
          {
            $set: {
              passwordHash,
              password: passwordHash,
              resetPasswordToken: null,
              resetPasswordExpires: null,
              passwordChangedAt: new Date().toISOString()
            }
          }
        );
      }
    } catch (updateErr) {
      console.warn('MongoDB reset password update warning:', updateErr.message);
    }

    // Also update in local db.users
    try {
      await db.users.findByIdAndUpdate(user._id || user.id, {
        passwordHash,
        password: passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null
      });
    } catch (e) {}

    res.json({ success: true, message: 'Password reset successful. You may now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};

module.exports = {
  login,
  getMe,
  getDemoAdmins,
  register,
  checkCapacity,
  simulateApproval,
  simulateKyc,
  getRegistrationLocations,
  uploadAvatar,
  uploadDocument,
  changePassword,
  forgotPassword,
  resetPassword,
  ROLE_LIMITS
};
