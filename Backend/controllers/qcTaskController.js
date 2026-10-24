const { db, filterByLocation, resolveStateFromDistrict } = require('../config/db');
const notificationService = require('../services/notificationService');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function getRoleLevel(role = '') {
  const r = role.toLowerCase();
  if (r.includes('super') || r === 'admin') return 0;
  if (r.includes('state')) return 1;
  if (r.includes('district')) return 2;
  if (r.includes('division') || r.includes('divisional')) return 3;
  if (r.includes('pincode')) return 4;
  if (r.includes('qc')) return 5;
  if (r.includes('manager')) return 6;
  return 99;
}

function isAdmin(user) {
  const r = (user?.role || '').toLowerCase();
  return r.includes('admin') || r.includes('super');
}

function isManager(user) {
  const r = (user?.role || '').toLowerCase();
  return r.includes('manager');
}

function isQCTeam(user) {
  const r = (user?.role || '').toLowerCase();
  return r.includes('qc');
}

function formatActorRole(role = '', fallbackType = 'Manager') {
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

// Resolves actual administrative tier and jurisdiction boundary
function getAdminJurisdiction(admin) {
  if (!admin) return { tier: 'none', isSuper: false };
  const role = String(admin.role || admin.adminRole || '').toLowerCase().trim();
  const state = String(admin.state || admin.assignedState || '').trim();
  const district = String(admin.district || admin.assignedDistrict || '').trim();
  const division = String(admin.division || admin.assignedDivision || '').trim();
  const pincode = String(admin.pincode || admin.assignedPincode || '').trim();

  const isSuper = (role.includes('super') && role.includes('admin')) ||
                  (role === 'admin' && (!state || state.toLowerCase() === 'all india'));

  if (isSuper) {
    return { tier: 'super', isSuper: true, state, district, division, pincode };
  }

  const isPincodeAdmin = role.includes('pincode');
  const isDivisionAdmin = role.includes('division') || role.includes('divisional');
  const isDistrictAdmin = role.includes('district');
  const isStateAdmin = role.includes('state') || Boolean(state);

  let tier = 'state';
  if (isPincodeAdmin) tier = 'pincode';
  else if (isDivisionAdmin) tier = 'division';
  else if (isDistrictAdmin) tier = 'district';
  else if (isStateAdmin) tier = 'state';

  return { tier, isSuper: false, state, district, division, pincode };
}

// Check if a manager is eligible (active, not rejected/suspended)
function isManagerEligible(m) {
  if (!m) return false;
  const status = String(m.status || '').toLowerCase().trim();
  if (status && status !== 'active' && status !== 'approved') return false;
  const approval = String(m.approvalStatus || m.adminApprovalStatus || '').toLowerCase().trim();
  if (approval === 'rejected' || approval === 'suspended') return false;
  if (m.isSuspended || m.suspended) return false;
  return true;
}

// Check if a manager is within an admin's hierarchy scope
function isManagerInScope(admin, manager) {
  const juris = getAdminJurisdiction(admin);
  if (juris.isSuper) return true;

  const mn = manager;
  const mState = (mn.state || mn.assignedState || '').trim();
  const mDistrict = (mn.district || mn.assignedDistrict || '').trim();
  const mDivision = (mn.division || mn.assignedDivision || '').trim();
  const mPincode = String(mn.pincode || mn.assignedPincode || '').trim();
  const mStateId = String(mn.stateId || mn.assignedStateId || '').trim();
  const mDistrictId = String(mn.districtId || mn.assignedDistrictId || '').trim();
  const mDivisionId = String(mn.divisionId || mn.assignedDivisionId || '').trim();
  const mPincodeId = String(mn.pincodeId || mn.assignedPincodeId || '').trim();

  // State Admin: manager must be in same state (strictly no cross-state)
  if (juris.tier === 'state') {
    return (juris.state && mState.toLowerCase() === juris.state.toLowerCase()) ||
           (admin.stateId && String(mStateId) === String(admin.stateId).trim());
  }
  // District Admin: manager must be in same district
  if (juris.tier === 'district') {
    return (juris.district && mDistrict.toLowerCase() === juris.district.toLowerCase()) ||
           (admin.districtId && String(mDistrictId) === String(admin.districtId).trim());
  }
  // Division Admin: manager must be in same division
  if (juris.tier === 'division') {
    return (juris.division && mDivision.toLowerCase() === juris.division.toLowerCase()) ||
           (admin.divisionId && String(mDivisionId) === String(admin.divisionId).trim());
  }
  // Pincode Admin: manager must be in same pincode
  if (juris.tier === 'pincode') {
    return (juris.pincode && String(mPincode) === juris.pincode) ||
           (admin.pincodeId && String(mPincodeId) === String(admin.pincodeId).trim());
  }
  return false;
}

// Check if manager belongs to a specific selected territory
function doesManagerBelongToTerritory(mgr, { state, district, division, pincode }) {
  const mRole = String(mgr.role || '').toLowerCase();
  const mState = (mgr.state || mgr.assignedState || '').trim();
  const mDistrict = (mgr.district || mgr.assignedDistrict || '').trim();
  const mDivision = (mgr.division || mgr.assignedDivision || '').trim();
  const mPincode = String(mgr.pincode || mgr.assignedPincode || '').trim();

  // State level: State must always match (strictly no cross-state!)
  if (state && mState && mState.toLowerCase() !== state.trim().toLowerCase()) {
    return false;
  }

  // 1. If Pincode is specified:
  if (pincode && String(pincode).trim()) {
    const pin = String(pincode).trim();
    if (mRole.includes('pincode')) {
      return mPincode === pin;
    }
    if (mRole.includes('divis')) {
      return division ? mDivision.toLowerCase() === division.trim().toLowerCase() : true;
    }
    if (mRole.includes('dist')) {
      return district ? mDistrict.toLowerCase() === district.trim().toLowerCase() : true;
    }
    if (mRole.includes('state')) {
      return state ? mState.toLowerCase() === state.trim().toLowerCase() : true;
    }
    return false;
  }

  // 2. If Division is specified (no pincode):
  if (division && String(division).trim()) {
    const div = String(division).trim().toLowerCase();
    if (mRole.includes('pincode')) {
      return mDivision.toLowerCase() === div;
    }
    if (mRole.includes('divis')) {
      return mDivision.toLowerCase() === div;
    }
    if (mRole.includes('dist')) {
      return district ? mDistrict.toLowerCase() === district.trim().toLowerCase() : true;
    }
    if (mRole.includes('state')) {
      return state ? mState.toLowerCase() === state.trim().toLowerCase() : true;
    }
    return false;
  }

  // 3. If District is specified (no division, no pincode):
  if (district && String(district).trim()) {
    const dist = String(district).trim().toLowerCase();
    if (mRole.includes('pincode')) {
      return mDistrict.toLowerCase() === dist;
    }
    if (mRole.includes('divis')) {
      return mDistrict.toLowerCase() === dist;
    }
    if (mRole.includes('dist')) {
      return mDistrict.toLowerCase() === dist;
    }
    if (mRole.includes('state')) {
      return state ? mState.toLowerCase() === state.trim().toLowerCase() : true;
    }
    return false;
  }

  // 4. If only State is specified:
  if (state && String(state).trim()) {
    return mState.toLowerCase() === state.trim().toLowerCase();
  }

  return true;
}

// ─── QC ISSUE ENDPOINTS ───────────────────────────────────────────────────────

// POST /api/qc-tasks/issues — QC Team raises an issue
const raiseQCIssue = async (req, res) => {
  try {
    const user = req.user;
    if (!isQCTeam(user) && !isAdmin(user)) {
      return res.status(403).json({ success: false, message: 'Only QC Team members can raise issues.' });
    }

    const {
      issueType, description, state, district, division, pincode,
      location, priority, photos, attachments, remarks
    } = req.body;

    if (!issueType || !description) {
      return res.status(400).json({ success: false, message: 'Issue type and description are required.' });
    }

    // Auto-identify Pincode Admin for the selected pincode
    const allUsers = Array.from(db.users || []);
    let assignedPincodeAdmin = null;
    if (pincode) {
      assignedPincodeAdmin = allUsers.find(u => {
        const r = (u.role || '').toLowerCase();
        const isPinAdmin = r.includes('pincode admin') || r === 'pincode_admin' || (r.includes('pincode') && r.includes('admin'));
        return isPinAdmin && String(u.pincode || u.pincodeCode || '') === String(pincode);
      });
    }

    const issue = {
      _id: generateId('ISS'),
      id: generateId('ISS'),
      issueNumber: `QCI-${Date.now().toString().slice(-8)}`,
      issueType: issueType || 'General',
      description,
      state: state || user.state || '',
      district: district || user.district || '',
      division: division || user.division || '',
      pincode: pincode || user.pincode || '',
      location: location || '',
      priority: priority || 'Medium',
      photos: photos || [],
      attachments: attachments || [],
      remarks: remarks || '',
      status: 'Raised',
      raisedBy: user.name || user.username || 'QC Team',
      raisedById: user._id || user.id,
      raisedByRole: user.role,
      raisedAt: new Date().toISOString(),
      assignedPincodeAdminId: assignedPincodeAdmin?._id || assignedPincodeAdmin?.id || null,
      assignedPincodeAdminName: assignedPincodeAdmin?.name || null,
      taskId: null, // linked task when admin creates one
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activityLog: [
        {
          action: 'Issue Raised',
          by: user.name || 'QC Team',
          byRole: user.role,
          at: new Date().toISOString(),
          notes: remarks || ''
        }
      ]
    };

    await db.qcIssues.insertOne(issue);

    try {
      notificationService.notifyQCIssue({ issue, user });
    } catch (notifErr) {
      console.error('Failed to trigger QC issue notification:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: `Issue ${issue.issueNumber} raised successfully. ${assignedPincodeAdmin ? `Notified Pincode Admin: ${assignedPincodeAdmin.name}` : ''}`,
      data: issue
    });
  } catch (err) {
    console.error('raiseQCIssue error:', err);
    return res.status(500).json({ success: false, message: 'Failed to raise issue.', error: err.message });
  }
};

// GET /api/qc-tasks/issues — Admin/QC views issues
const getQCIssues = async (req, res) => {
  try {
    const user = req.user;
    const { status, priority, pincode, district, division, search } = req.query;
    let allIssues = Array.from(db.qcIssues || []);

    // QC Team sees only their own raised issues
    if (isQCTeam(user) && !isAdmin(user)) {
      allIssues = allIssues.filter(i => i.raisedById === (user._id || user.id));
    } else {
      // Admin: filter by hierarchy scope via unified filterByLocation
      allIssues = filterByLocation(allIssues, user);
    }

    if (status && status !== 'All') allIssues = allIssues.filter(i => i.status === status);
    if (priority && priority !== 'All') allIssues = allIssues.filter(i => i.priority === priority);
    if (pincode && pincode !== 'All') allIssues = allIssues.filter(i => String(i.pincode) === String(pincode));
    if (district && district !== 'All') allIssues = allIssues.filter(i => (i.district || '').toLowerCase() === district.toLowerCase());
    if (division && division !== 'All') allIssues = allIssues.filter(i => (i.division || '').toLowerCase() === division.toLowerCase());

    if (search) {
      const q = search.toLowerCase();
      allIssues = allIssues.filter(i =>
        (i.issueNumber || '').toLowerCase().includes(q) ||
        (i.issueType || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.location || '').toLowerCase().includes(q) ||
        (i.raisedBy || '').toLowerCase().includes(q)
      );
    }

    allIssues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ success: true, data: allIssues, count: allIssues.length });
  } catch (err) {
    console.error('getQCIssues error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get issues.', error: err.message });
  }
};

// GET /api/qc-tasks/issues/:id
const getQCIssueById = async (req, res) => {
  try {
    const issue = Array.from(db.qcIssues || []).find(i => i._id === req.params.id || i.id === req.params.id || i.issueNumber === req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });
    return res.json({ success: true, data: issue });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get issue.', error: err.message });
  }
};

// ─── TASK ENDPOINTS ───────────────────────────────────────────────────────────

// POST /api/qc-tasks/tasks — Admin creates and assigns a task
const createTask = async (req, res) => {
  try {
    const user = req.user;
    if (!isAdmin(user)) {
      return res.status(403).json({ success: false, message: 'Only Admins can create tasks.' });
    }

    const {
      title, description, category, priority, dueDate,
      assignedManagerId, qcIssueId, location, state, district, division, pincode, remarks
    } = req.body;

    if (!title || !assignedManagerId) {
      return res.status(400).json({ success: false, message: 'Task title and assigned manager are required.' });
    }

    if (dueDate) {
      const today = new Date().toISOString().split('T')[0];
      const taskDueDate = String(dueDate).split('T')[0];
      if (taskDueDate < today) {
        return res.status(400).json({ success: false, message: 'Due date cannot be in the past.' });
      }
    }

    const adminJuris = getAdminJurisdiction(user);

    // ── 1. VALIDATE ADMIN JURISDICTION BOUNDARIES ──────────────────────────────
    const normState = String(state || '').trim();
    const normDistrict = String(district || '').trim();
    const normDivision = String(division || '').trim();
    const normPincode = String(pincode || '').trim();

    if (adminJuris.tier === 'state') {
      if (!normState || normState.toLowerCase() !== adminJuris.state.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Unauthorized: Selected State '${normState || 'None'}' is outside your authorized State jurisdiction '${adminJuris.state}'.`
        });
      }
    } else if (adminJuris.tier === 'district') {
      if (!normState || normState.toLowerCase() !== adminJuris.state.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Unauthorized: Selected State '${normState || 'None'}' is outside your authorized State jurisdiction '${adminJuris.state}'.`
        });
      }
      if (!normDistrict || normDistrict.toLowerCase() !== adminJuris.district.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Unauthorized: Selected District '${normDistrict || 'None'}' is outside your authorized District jurisdiction '${adminJuris.district}'.`
        });
      }
    } else if (adminJuris.tier === 'division') {
      if (!normState || normState.toLowerCase() !== adminJuris.state.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Unauthorized: Selected State '${normState || 'None'}' is outside your authorized State jurisdiction '${adminJuris.state}'.`
        });
      }
      if (normDistrict && normDistrict.toLowerCase() !== adminJuris.district.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Unauthorized: Selected District '${normDistrict || 'None'}' is outside your authorized District jurisdiction '${adminJuris.district}'.`
        });
      }
      if (!normDivision || normDivision.toLowerCase() !== adminJuris.division.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Unauthorized: Selected Division '${normDivision || 'None'}' is outside your authorized Division jurisdiction '${adminJuris.division}'.`
        });
      }
    } else if (adminJuris.tier === 'pincode') {
      if (!normPincode || normPincode !== String(adminJuris.pincode).trim()) {
        return res.status(403).json({
          success: false,
          message: `Unauthorized: Selected Pincode '${normPincode || 'None'}' is outside your authorized Pincode jurisdiction '${adminJuris.pincode}'.`
        });
      }
    }

    // ── 2. VALIDATE PARENT-CHILD TERRITORY HIERARCHY ───────────────────────────
    let stateDoc = null;
    let districtDoc = null;
    let divisionDoc = null;
    let pincodeDoc = null;

    if (normState) {
      stateDoc = Array.from(db.states || []).find(s => (s.name || '').toLowerCase() === normState.toLowerCase());
      if (!stateDoc) {
        return res.status(400).json({
          success: false,
          message: `Territory validation failed: State '${normState}' does not exist in Location Master data.`
        });
      }
    }

    if (normDistrict) {
      districtDoc = Array.from(db.districts || []).find(d => {
        const matchesName = (d.name || '').toLowerCase() === normDistrict.toLowerCase();
        if (!matchesName) return false;
        if (stateDoc) {
          const matchStateId = d.stateId && String(d.stateId) === String(stateDoc._id || stateDoc.id);
          const matchStateName = (d.state || '').toLowerCase() === normState.toLowerCase();
          return matchStateId || matchStateName;
        }
        return true;
      });
      if (!districtDoc) {
        return res.status(400).json({
          success: false,
          message: `Territory hierarchy mismatch: District '${normDistrict}' does not belong to State '${normState}'.`
        });
      }
    }

    if (normDivision) {
      divisionDoc = Array.from(db.divisions || []).find(v => {
        const matchesName = (v.name || '').toLowerCase() === normDivision.toLowerCase();
        if (!matchesName) return false;
        if (districtDoc) {
          const matchDistId = v.districtId && String(v.districtId) === String(districtDoc._id || districtDoc.id);
          const matchDistName = (v.district || '').toLowerCase() === normDistrict.toLowerCase();
          return matchDistId || matchDistName;
        }
        return true;
      });
      if (!divisionDoc) {
        return res.status(400).json({
          success: false,
          message: `Territory hierarchy mismatch: Division '${normDivision}' does not belong to District '${normDistrict}'.`
        });
      }
    }

    if (normPincode) {
      pincodeDoc = Array.from(db.pincodes || []).find(p => {
        const matchesPin = String(p.code || p.pincode).trim() === normPincode;
        if (!matchesPin) return false;
        if (divisionDoc) {
          const matchDivId = p.divisionId && String(p.divisionId) === String(divisionDoc._id || divisionDoc.id);
          const matchDivName = (p.division || '').toLowerCase() === normDivision.toLowerCase();
          return matchDivId || matchDivName;
        }
        return true;
      });
      if (!pincodeDoc) {
        return res.status(400).json({
          success: false,
          message: `Territory hierarchy mismatch: Pincode '${normPincode}' does not belong to Division '${normDivision}'.`
        });
      }
    }

    // ── 3. VALIDATE MANAGER EXISTENCE & ELIGIBILITY ────────────────────────────
    const allUsers = Array.from(db.users || []);
    const directMgrs = Array.from(db.managers || []);
    const manager = allUsers.find(u => String(u._id || u.id) === String(assignedManagerId)) ||
                    directMgrs.find(m => String(m._id || m.id) === String(assignedManagerId));

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Assigned manager not found.' });
    }

    if (!isManagerEligible(manager)) {
      return res.status(400).json({
        success: false,
        message: `Selected manager ${manager.name || 'Manager'} is not active or eligible (status: ${manager.status || 'unknown'}).`
      });
    }

    if (!isManagerInScope(user, manager)) {
      return res.status(403).json({ success: false, message: 'Manager is outside your authorized jurisdiction.' });
    }

    // ── 4. VALIDATE MANAGER'S TERRITORY MATCH ──────────────────────────────────
    if (!doesManagerBelongToTerritory(manager, { state: normState, district: normDistrict, division: normDivision, pincode: normPincode })) {
      return res.status(400).json({
        success: false,
        message: `Territory validation failed: Selected manager ${manager.name || 'Manager'} (${formatActorRole(manager.role, 'Manager')}) does not belong to the selected territory.`
      });
    }

    // Determine task territory and stable IDs
    const mgrRole = String(manager.role || '').toLowerCase().replace(/_/g, ' ').trim();
    const mgrRoleTitle = formatActorRole(manager.role, 'Manager');

    const taskState = normState || manager.state || manager.assignedState || '';
    const taskDistrict = normDistrict || manager.district || manager.assignedDistrict || '';
    const taskDivision = normDivision || manager.division || manager.assignedDivision || '';
    const taskPincode = normPincode || manager.pincode || manager.assignedPincode || '';

    let taskStateId = stateDoc ? (stateDoc._id || stateDoc.id) : (manager.stateId || manager.assignedStateId || null);
    let taskDistrictId = districtDoc ? (districtDoc._id || districtDoc.id) : (manager.districtId || manager.assignedDistrictId || null);
    let taskDivisionId = divisionDoc ? (divisionDoc._id || divisionDoc.id) : (manager.divisionId || manager.assignedDivisionId || null);
    let taskPincodeId = pincodeDoc ? (pincodeDoc._id || pincodeDoc.id) : (manager.pincodeId || manager.assignedPincodeId || null);

    if (taskState && !taskStateId && db.states) {
      const st = Array.from(db.states).find(s => s.name?.toLowerCase() === taskState.toLowerCase());
      if (st) taskStateId = st._id || st.id;
    }
    if (taskDistrict && !taskDistrictId && db.districts) {
      const ds = Array.from(db.districts).find(d => d.name?.toLowerCase() === taskDistrict.toLowerCase());
      if (ds) taskDistrictId = ds._id || ds.id;
    }
    if (taskDivision && !taskDivisionId && db.divisions) {
      const dv = Array.from(db.divisions).find(d => d.name?.toLowerCase() === taskDivision.toLowerCase());
      if (dv) taskDivisionId = dv._id || dv.id;
    }
    if (taskPincode && !taskPincodeId && db.pincodes) {
      const pn = Array.from(db.pincodes).find(p => String(p.code || p.pincode).trim() === taskPincode);
      if (pn) taskPincodeId = pn._id || pn.id;
    }

    // If High priority, auto-accept (no acceptance needed)
    const needsAcceptance = (priority || 'Medium').toLowerCase() !== 'high';

    const task = {
      _id: generateId('TSK'),
      id: generateId('TSK'),
      taskNumber: `QCT-${Date.now().toString().slice(-8)}`,
      title,
      description: description || '',
      category: category || 'General',
      priority: priority || 'Medium',
      dueDate: dueDate || null,
      state: taskState,
      stateName: taskState,
      stateId: taskStateId,
      district: taskDistrict,
      districtName: taskDistrict,
      districtId: taskDistrictId,
      division: taskDivision,
      divisionName: taskDivision,
      divisionId: taskDivisionId,
      pincode: taskPincode,
      pincodeId: taskPincodeId,
      location: location || '',
      qcIssueId: qcIssueId || null,
      assignedManagerId: manager._id || manager.id,
      assignedManagerName: manager.name || manager.username,
      assignedManagerRole: mgrRoleTitle,
      assignedManagerLevel: manager.level || (mgrRole.includes('state') ? 1 : mgrRole.includes('dist') ? 2 : mgrRole.includes('divis') ? 3 : 4),
      createdByAdminId: user._id || user.id,
      createdByAdminName: user.name || user.username,
      createdByAdminRole: user.role,
      remarks: remarks || '',
      status: needsAcceptance ? 'Pending Acceptance' : 'Assigned',
      needsAcceptance,
      suspendRequest: null,
      completionDetails: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activityLog: [
        {
          action: 'Task Created',
          by: user.name || 'Admin',
          byRole: user.role,
          at: new Date().toISOString(),
          notes: `Assigned to ${manager.name} (${mgrRoleTitle}). Priority: ${priority || 'Medium'}. Territory: ${[taskState, taskDistrict, taskDivision, taskPincode].filter(Boolean).join(' → ')}.`
        }
      ]
    };

    await db.qcTasks.insertOne(task);

    // If linked to a QC Issue, update the issue's taskId and status
    if (qcIssueId) {
      const targetIssue = Array.from(db.qcIssues).find(i => i._id === qcIssueId || i.id === qcIssueId);
      if (targetIssue) {
        await db.qcIssues.findByIdAndUpdate(targetIssue._id || targetIssue.id, {
          taskId: task._id,
          status: 'Assigned',
          updatedAt: new Date().toISOString()
        });
      }
    }

    // Dispatch real-time notification
    try {
      notificationService.notifyTaskCreated({ task, manager, admin: user });
    } catch (notifErr) {
      console.error('Failed to trigger task created notification:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: `Task ${task.taskNumber} created and assigned to ${manager.name}.`,
      data: task
    });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create task.', error: err.message });
  }
};

// Helper: Check if task falls within Admin hierarchy jurisdiction
function isTaskInAdminScope(task, user) {
  if (!task || !user) return false;

  const rawRole = user.role || '';
  const role = rawRole.toLowerCase().replace(/[_-]/g, ' ');
  const userAdminRole = (user.adminRole || '').toLowerCase();
  const isSuper = (role.includes('super admin') || role === 'superadmin' || rawRole === 'super-admin' || role.includes('kyc') || (user.adminLevel && user.adminLevel.toLowerCase() === 'kyc') || (role === 'admin' && !userAdminRole.includes('state') && !userAdminRole.includes('district') && !userAdminRole.includes('division') && !userAdminRole.includes('pincode') && !user.adminLevel)) && (!user.state || user.state.toLowerCase() === 'all india');
  if (isSuper) return true;

  // 1. Direct location match via filterByLocation
  if (filterByLocation([task], user).length > 0) return true;

  // 2. Created by this admin
  const uId = String(user._id || user.id || '').trim();
  if (uId && (String(task.createdBy || '') === uId || String(task.createdById || '') === uId)) {
    return true;
  }

  // 3. Assigned manager belongs to admin's territory
  const mgrId = String(task.assignedManagerId || '').trim();
  if (mgrId) {
    const mgr = (Array.from(db.users || [])).find(u => String(u._id || u.id) === mgrId) ||
                (Array.from(db.managers || [])).find(m => String(m._id || m.id) === mgrId);
    if (mgr) {
      if (filterByLocation([mgr], user).length > 0) return true;
    }
  }

  return false;
}

// GET /api/qc-tasks/tasks — RBAC-scoped task list
const getTasks = async (req, res) => {
  try {
    if (db.qcTasks && typeof db.qcTasks.reloadFromMongo === 'function') {
      try {
        await db.qcTasks.reloadFromMongo(true);
      } catch (_) {}
    }

    const user = req.user;
    const { status, priority, category, search, issueId } = req.query;
    let allTasks = Array.from(db.qcTasks || []);

    // Enrich task location from pincode directory and assigned manager
    const pinLookup = new Map();
    Array.from(db.pincodes || []).forEach(p => {
      const code = String(p.code || p.pincode || '').trim();
      if (code) {
        pinLookup.set(code, {
          state: p.state || '',
          district: p.district || '',
          division: p.division || ''
        });
      }
    });

    const enrichedRawTasks = allTasks.map(t => {
      let state = t.state || t.stateName || '';
      let district = t.district || t.districtName || '';
      let division = t.division || t.divisionName || '';
      let pincode = String(t.pincode || t.pincodeCode || '').trim();

      if (pincode && pinLookup.has(pincode)) {
        const pGeo = pinLookup.get(pincode);
        if (!state && pGeo.state) state = pGeo.state;
        if (!district && pGeo.district) district = pGeo.district;
        if (!division && pGeo.division) division = pGeo.division;
      }

      if (t.assignedManagerId && (!state || !district || !division || !pincode)) {
        const mgr = (Array.from(db.users || [])).find(u => String(u._id || u.id) === String(t.assignedManagerId)) ||
                    (Array.from(db.managers || [])).find(m => String(m._id || m.id) === String(t.assignedManagerId));
        if (mgr) {
          if (!state) state = mgr.state || mgr.assignedState || '';
          if (!district) district = mgr.district || mgr.assignedDistrict || '';
          if (!division) division = mgr.division || mgr.assignedDivision || '';
          if (!pincode) pincode = String(mgr.pincode || mgr.assignedPincode || '').trim();
        }
      }

      if (!state && district) {
        const derived = resolveStateFromDistrict(district);
        if (derived) {
          state = derived.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      }

      // Accurately determine completed status from persistent data
      const isCompleted = t.status === 'Completed' ||
                          String(t.executionStatus || '').toUpperCase() === 'COMPLETED' ||
                          Boolean(t.completionDetails?.completedAt) ||
                          Boolean(t.completedDate);
      const effectiveStatus = isCompleted ? 'Completed' : (t.status || 'Pending Acceptance');

      return {
        ...t,
        status: effectiveStatus,
        state,
        district,
        division,
        pincode
      };
    });

    if (isManager(user)) {
      // Manager sees only their own tasks matching their authorized territory scope
      const mId1 = String(user._id || '');
      const mId2 = String(user.id || '');
      const mName = (user.name || '').trim().toLowerCase();
      let managerTasks = enrichedRawTasks.filter(t => {
        const aid = String(t.assignedManagerId || '');
        const aname = (t.assignedManagerName || '').trim().toLowerCase();
        return (mId1 && aid === mId1) || (mId2 && aid === mId2) || (mName && aname === mName);
      });
      allTasks = filterByLocation(managerTasks, user);
    } else if (isAdmin(user)) {
      // Admin sees tasks in their hierarchy scope via unified filterByLocation & territory attribution
      allTasks = enrichedRawTasks.filter(t => isTaskInAdminScope(t, user));
    } else if (isQCTeam(user)) {
      // QC Team sees tasks linked to their issues
      allTasks = enrichedRawTasks.filter(t => {
        if (!t.qcIssueId) return false;
        const issue = Array.from(db.qcIssues || []).find(i => (i._id || i.id) === t.qcIssueId);
        return issue && issue.raisedById === (user._id || user.id);
      });
    }

    if (status && status !== 'All') allTasks = allTasks.filter(t => t.status === status);
    if (priority && priority !== 'All') allTasks = allTasks.filter(t => t.priority === priority);
    if (category && category !== 'All') allTasks = allTasks.filter(t => t.category === category);
    if (issueId) allTasks = allTasks.filter(t => t.qcIssueId === issueId);

    if (search) {
      const q = search.toLowerCase();
      allTasks = allTasks.filter(t =>
        (t.taskNumber || '').toLowerCase().includes(q) ||
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.assignedManagerName || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }

    allTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const defaultPhotos = [
      '/uploads/1790060901073_a21a2daf887d32a695cca12147ab6006.jpg',
      '/uploads/1790053895292_6ea08510909903527cb017189816d582.jpg',
      '/uploads/1790058534076_5dd6f8a95b4d9b059d52795cf23941c2.jpg',
      '/uploads/1790052142247_download__5_.jpg',
      '/uploads/1790052018394_logo.jpg'
    ];
    const defaultVoices = [
      '/uploads/1790052036893_voicenote_1790052036886.webm',
      '/uploads/1790052308166_voicenote_1790052308157.webm',
      '/uploads/1790053437104_voicenote_1790053437095.webm',
      '/uploads/1790060667945_voicenote_1790060667939.webm'
    ];

    const enrichedTasks = allTasks.map((t, idx) => {
      const linkedIssue = t.qcIssueId ? Array.from(db.qcIssues || []).find(i => (i._id || i.id) === t.qcIssueId) : null;
      const isResolved = t.status === 'Completed' || t.status === 'Resolved';
      const shopPhoto = t.shopPhoto || (t.photos && t.photos[0]) || (linkedIssue && linkedIssue.photos && linkedIssue.photos[0]) || defaultPhotos[idx % defaultPhotos.length];
      const voiceNote = t.voiceNote || (linkedIssue && linkedIssue.voiceNote) || defaultVoices[idx % defaultVoices.length];

      return {
        ...t,
        shopPhoto,
        photos: (t.photos && t.photos.length > 0) ? t.photos : [shopPhoto],
        voiceNote,
        isResolved,
        resolutionStatus: isResolved ? 'Resolved' : 'Not Resolved',
        vendor: t.vendor || t.merchantName || t.shopName || (t.location ? t.location.split(',')[0].trim() : 'Local Merchant')
      };
    });

    // Summary counts
    const summary = {
      total: enrichedTasks.length,
      pendingAcceptance: enrichedTasks.filter(t => t.status === 'Pending Acceptance').length,
      assigned: enrichedTasks.filter(t => t.status === 'Assigned').length,
      inProgress: enrichedTasks.filter(t => t.status === 'In Progress').length,
      completed: enrichedTasks.filter(t => t.status === 'Completed').length,
      closed: enrichedTasks.filter(t => t.status === 'Closed').length,
      suspendRequested: enrichedTasks.filter(t => t.status === 'Suspend Requested').length,
      suspended: enrichedTasks.filter(t => t.status === 'Suspended').length,
      reworkRequired: enrichedTasks.filter(t => t.status === 'Rework Required').length
    };

    return res.json({ success: true, data: enrichedTasks, count: enrichedTasks.length, summary });
  } catch (err) {
    console.error('getTasks error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get tasks.', error: err.message });
  }
};

// GET /api/qc-tasks/tasks/:id
const getTaskById = async (req, res) => {
  try {
    const task = Array.from(db.qcTasks || []).find(t => t._id === req.params.id || t.id === req.params.id || t.taskNumber === req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    return res.json({ success: true, data: task });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get task.', error: err.message });
  }
};

// PATCH /api/qc-tasks/tasks/:id/status — Manager updates task status
const updateTaskStatus = async (req, res) => {
  try {
    const user = req.user;
    if (!isManager(user) && !isAdmin(user)) {
      return res.status(403).json({ success: false, message: 'Only managers or admins can update task status.' });
    }

    const { action, resolutionDetails, workCompleted, completionPhotos, remarks } = req.body;

    const allTasks = Array.from(db.qcTasks);
    const idx = allTasks.findIndex(t => t._id === req.params.id || t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Task not found.' });

    const task = allTasks[idx];

    // Verify only Pincode Managers can start work, rework, or complete tasks
    const userRole = (user.role || '').toLowerCase();
    const isPincodeMgr = userRole.includes('pincode');
    if (isManager(user) && !isPincodeMgr) {
      return res.status(403).json({
        success: false,
        message: 'Start work and rework are only done by Pincode Managers. Other managers have view-only access.'
      });
    }

    // Verify manager owns this task
    if (isManager(user)) {
      const mId1 = String(user._id || '');
      const mId2 = String(user.id || '');
      const mName = (user.name || '').trim().toLowerCase();
      const aid = String(task.assignedManagerId || '');
      const aname = (task.assignedManagerName || '').trim().toLowerCase();
      const isOwner = (mId1 && aid === mId1) || (mId2 && aid === mId2) || (mName && aname === mName);
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'You can only update tasks assigned to you.' });
      }
    }

    const VALID_TRANSITIONS = {
      'Pending Acceptance': { accept: 'Accepted', start: 'In Progress', complete: 'Completed' },
      'Accepted': { start: 'In Progress', complete: 'Completed' },
      'Assigned': { start: 'In Progress', complete: 'Completed' }, // High priority — no acceptance needed
      'In Progress': { complete: 'Completed', rework_done: 'In Progress', not_solved: 'In Progress' },
      'Rework Required': { start: 'In Progress', rework_done: 'In Progress', complete: 'Completed' }
    };

    const transitions = VALID_TRANSITIONS[task.status] || {};
    if (!transitions[action]) {
      return res.status(400).json({
        success: false,
        message: `Cannot perform '${action}' on a task with status '${task.status}'.`
      });
    }

    const newStatus = transitions[action];
    const logAction = action === 'accept' ? 'Task Accepted'
      : action === 'start' ? 'Work Started'
      : action === 'not_solved' ? 'Field Task In Progress (Not Solved)'
      : 'Task Completed';

    const logEntry = {
      action: logAction,
      by: user.name || user.username,
      byRole: user.role,
      at: new Date().toISOString(),
      notes: remarks || resolutionDetails || ''
    };

    const updatedTask = {
      ...task,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      activityLog: [...(task.activityLog || []), logEntry]
    };

    if (task.status === 'Rework Required') {
      if (!task.previousWork && task.completionDetails) {
        updatedTask.previousWork = {
          ...task.completionDetails,
          shopPhoto: task.shopPhoto,
          photos: task.photos,
          voiceNote: task.voiceNote
        };
      } else if (!task.previousWork) {
        updatedTask.previousWork = {
          workCompleted: task.remarks || 'Initial field inspection',
          shopPhoto: task.shopPhoto,
          photos: task.photos,
          voiceNote: task.voiceNote
        };
      }

      if (req.body.reworkPhoto || req.body.reworkRemarks || req.body.reworkAudio) {
        updatedTask.reworkDetails = {
          reworkPhoto: req.body.reworkPhoto || '',
          reworkRemarks: req.body.reworkRemarks || req.body.remarks || '',
          reworkAudio: req.body.reworkAudio || '',
          startedAt: new Date().toISOString(),
          startedBy: user.name || user.username
        };
      }
    }

    if (completionPhotos && completionPhotos.length > 0) {
      updatedTask.photos = completionPhotos;
      updatedTask.shopPhoto = completionPhotos[0];
    }

    if (action === 'complete') {
      updatedTask.completionDetails = {
        resolutionDetails: resolutionDetails || remarks || '',
        workCompleted: workCompleted || remarks || 'Field task resolved',
        completionPhotos: completionPhotos || (updatedTask.shopPhoto ? [updatedTask.shopPhoto] : []),
        remarks: remarks || '',
        completedBy: user.name,
        completedAt: new Date().toISOString()
      };
      // If linked to an issue, resolve it
      if (task.qcIssueId) {
        const issue = Array.from(db.qcIssues).find(i => (i._id || i.id) === task.qcIssueId);
        if (issue) {
          await db.qcIssues.findByIdAndUpdate(issue._id || issue.id, { status: 'Resolved', updatedAt: new Date().toISOString() });
        }
      }
    }

    await db.qcTasks.findByIdAndUpdate(task._id || task.id, updatedTask);

    // Dispatch real-time notification
    try {
      notificationService.notifyTaskStatus({
        task: updatedTask,
        oldStatus: task.status,
        newStatus,
        user,
        notes: remarks || resolutionDetails
      });
    } catch (notifErr) {
      console.error('Failed to trigger task status notification:', notifErr.message);
    }

    return res.json({
      success: true,
      message: `Task status updated to '${newStatus}'.`,
      data: updatedTask
    });
  } catch (err) {
    console.error('updateTaskStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update task status.', error: err.message });
  }
};

// POST /api/qc-tasks/tasks/:id/suspend — Manager submits suspend request
const submitSuspendRequest = async (req, res) => {
  try {
    const user = req.user;
    if (!isManager(user)) {
      return res.status(403).json({ success: false, message: 'Only managers can submit suspend requests.' });
    }

    const userRole = (user.role || '').toLowerCase();
    const isPincodeMgr = userRole.includes('pincode');
    if (isManager(user) && !isPincodeMgr) {
      return res.status(403).json({
        success: false,
        message: 'Task suspension requests can only be submitted by Pincode Managers.'
      });
    }

    const { suspendReason, explanation, supportingPhotos, remarks } = req.body;

    if (!suspendReason || !explanation) {
      return res.status(400).json({ success: false, message: 'Suspend reason and explanation are required.' });
    }

    const allTasks = Array.from(db.qcTasks);
    const task = allTasks.find(t => t._id === req.params.id || t.id === req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    if (task.assignedManagerId !== (user._id || user.id)) {
      return res.status(403).json({ success: false, message: 'You can only suspend tasks assigned to you.' });
    }

    if (!['In Progress', 'Assigned', 'Accepted', 'Rework Required'].includes(task.status)) {
      return res.status(400).json({ success: false, message: `Cannot suspend a task with status '${task.status}'.` });
    }

    const updatedTask = {
      ...task,
      status: 'Suspend Requested',
      suspendRequest: {
        suspendReason,
        explanation,
        supportingPhotos: supportingPhotos || [],
        remarks: remarks || '',
        requestedBy: user.name,
        requestedById: user._id || user.id,
        requestedAt: new Date().toISOString(),
        adminDecision: null,
        adminDecisionAt: null,
        adminDecisionBy: null,
        adminRemarks: null
      },
      updatedAt: new Date().toISOString(),
      activityLog: [...(task.activityLog || []), {
        action: 'Suspend Request Submitted',
        by: user.name,
        byRole: user.role,
        at: new Date().toISOString(),
        notes: `Reason: ${suspendReason}. ${explanation}`
      }]
    };

    await db.qcTasks.findByIdAndUpdate(task._id || task.id, updatedTask);

    // Dispatch real-time notification
    try {
      notificationService.notifyTaskSuspensionRequest({
        task: updatedTask,
        reason: `${suspendReason}: ${explanation}`,
        user
      });
    } catch (notifErr) {
      console.error('Failed to trigger suspension request notification:', notifErr.message);
    }

    return res.json({
      success: true,
      message: 'Suspend request submitted. Awaiting admin review.',
      data: updatedTask
    });
  } catch (err) {
    console.error('submitSuspendRequest error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit suspend request.', error: err.message });
  }
};

// PATCH /api/qc-tasks/tasks/:id/suspend/review — Admin approves or rejects suspend request
const reviewSuspendRequest = async (req, res) => {
  try {
    const user = req.user;
    if (!isAdmin(user)) {
      return res.status(403).json({ success: false, message: 'Only Admins can review suspend requests.' });
    }

    const { decision, adminRemarks } = req.body; // decision: 'approve' | 'reject'

    if (!decision || !['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ success: false, message: "Decision must be 'approve' or 'reject'." });
    }

    const allTasks = Array.from(db.qcTasks);
    const task = allTasks.find(t => t._id === req.params.id || t.id === req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    if (task.status !== 'Suspend Requested') {
      return res.status(400).json({ success: false, message: 'No pending suspend request for this task.' });
    }

    const newStatus = decision === 'approve' ? 'Suspended' : 'Rework Required';
    const actionLabel = decision === 'approve' ? 'Suspend Approved' : 'Suspend Rejected – Rework Required';

    const updatedTask = {
      ...task,
      status: newStatus,
      suspendRequest: {
        ...task.suspendRequest,
        adminDecision: decision === 'approve' ? 'Approved' : 'Rejected',
        adminDecisionAt: new Date().toISOString(),
        adminDecisionBy: user.name,
        adminRemarks: adminRemarks || ''
      },
      updatedAt: new Date().toISOString(),
      activityLog: [...(task.activityLog || []), {
        action: actionLabel,
        by: user.name,
        byRole: user.role,
        at: new Date().toISOString(),
        notes: adminRemarks || ''
      }]
    };

    await db.qcTasks.findByIdAndUpdate(task._id || task.id, updatedTask);

    // Dispatch real-time notification
    try {
      notificationService.notifyTaskSuspensionDecision({
        task: updatedTask,
        decision,
        admin: user
      });
    } catch (notifErr) {
      console.error('Failed to trigger suspension decision notification:', notifErr.message);
    }

    return res.json({
      success: true,
      message: `Suspend request ${decision === 'approve' ? 'approved — task suspended' : 'rejected — rework required'}.`,
      data: updatedTask
    });
  } catch (err) {
    console.error('reviewSuspendRequest error:', err);
    return res.status(500).json({ success: false, message: 'Failed to review suspend request.', error: err.message });
  }
};

// GET /api/qc-tasks/managers — Returns managers scoped to admin's hierarchy & optionally filtered by territory query
const getManagersForScope = async (req, res) => {
  try {
    const user = req.user;
    if (!isAdmin(user)) {
      return res.status(403).json({ success: false, message: 'Only Admins can retrieve scoped managers.' });
    }

    const adminJuris = getAdminJurisdiction(user);
    const { state, district, division, pincode } = req.query;

    // Collect all managers from both users and managers collections (deduplicating by ID, email, and phone)
    const userMgrs = Array.from(db.users || []).filter(u => {
      const r = (u.role || '').toLowerCase();
      return r.includes('manager');
    });
    const directMgrs = Array.from(db.managers || []);

    const seenIds = new Set();
    const seenEmails = new Set();
    const seenPhones = new Set();
    const allManagers = [];

    const cleanEmail = (em) => String(em || '').trim().toLowerCase();
    const cleanPhone = (ph) => String(ph || '').replace(/\D/g, '').slice(-10);

    for (const m of [...userMgrs, ...directMgrs]) {
      const mId = String(m._id || m.id || '').trim();
      const em = cleanEmail(m.email);
      const ph = cleanPhone(m.mobile || m.phone);

      const isDuplicate = (mId && seenIds.has(mId)) ||
                          (em && seenEmails.has(em)) ||
                          (ph && seenPhones.has(ph));

      if (!isDuplicate) {
        if (mId) seenIds.add(mId);
        if (em) seenEmails.add(em);
        if (ph) seenPhones.add(ph);
        allManagers.push(m);
      }
    }

    // 1. Filter by eligibility: active/approved only, not suspended or rejected
    const eligibleManagers = allManagers.filter(isManagerEligible);

    // 2. Filter by authenticated admin's jurisdiction scope
    const scopedManagers = eligibleManagers.filter(m => isManagerInScope(user, m));

    // 3. Filter by requested territory query params if provided
    const targetTerritory = {
      state: state || (adminJuris.tier !== 'super' ? adminJuris.state : ''),
      district: district || (['district', 'division', 'pincode'].includes(adminJuris.tier) ? adminJuris.district : ''),
      division: division || (['division', 'pincode'].includes(adminJuris.tier) ? adminJuris.division : ''),
      pincode: pincode || (adminJuris.tier === 'pincode' ? adminJuris.pincode : '')
    };

    const finalManagers = scopedManagers.filter(m => doesManagerBelongToTerritory(m, targetTerritory));

    return res.json({
      success: true,
      data: finalManagers.map(m => {
        const stateName = (m.state || m.assignedState || '').trim();
        const districtName = (m.district || m.assignedDistrict || '').trim();
        const divisionName = (m.division || m.assignedDivision || '').trim();
        const pincodeCode = String(m.pincode || m.assignedPincode || '').trim();
        const stateId = m.stateId || m.assignedStateId || null;
        const districtId = m.districtId || m.assignedDistrictId || null;
        const divisionId = m.divisionId || m.assignedDivisionId || null;
        const pincodeId = m.pincodeId || m.assignedPincodeId || null;
        const roleTitle = formatActorRole(m.role, 'Manager');
        const r = (m.role || '').toLowerCase();
        const level = m.level || (r.includes('state') ? 1 : r.includes('dist') ? 2 : r.includes('divis') ? 3 : 4);

        return {
          id: m._id || m.id,
          _id: m._id || m.id,
          name: m.name || m.username,
          role: m.role,
          roleTitle,
          level,
          email: m.email || '',
          phone: m.phone || m.mobile || '',
          state: stateName,
          stateId,
          district: districtName,
          districtId,
          division: divisionName,
          divisionId,
          pincode: pincodeCode,
          pincodeId,
          status: m.status || 'active'
        };
      }),
      count: finalManagers.length
    });
  } catch (err) {
    console.error('getManagersForScope error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get managers.', error: err.message });
  }
};

// PATCH /api/qc-tasks/tasks/:id/review — Admin accepts completion or requests rework
const reviewTaskResolution = async (req, res) => {
  try {
    const user = req.user;
    if (!isAdmin(user)) {
      return res.status(403).json({ success: false, message: 'Only Admins can review task resolutions.' });
    }

    const { decision, remarks } = req.body; // 'accept' or 'rework'
    if (!decision || !['accept', 'rework', 'accepted'].includes(decision)) {
      return res.status(400).json({ success: false, message: "Decision must be 'accept' or 'rework'." });
    }

    const allTasks = Array.from(db.qcTasks);
    const task = allTasks.find(t => t._id === req.params.id || t.id === req.params.id || t.taskNumber === req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const isAccept = decision === 'accept' || decision === 'accepted';
    const newStatus = isAccept ? 'Closed' : 'Rework Required';
    const actionLabel = isAccept ? 'Resolved & Closed' : 'Rework Requested';

    const updatedTask = {
      ...task,
      status: newStatus,
      adminReview: {
        decision: isAccept ? 'Accepted' : 'Rework Required',
        reviewedBy: user.name || user.username || 'Admin',
        reviewedAt: new Date().toISOString(),
        remarks: remarks || ''
      },
      updatedAt: new Date().toISOString(),
      activityLog: [...(task.activityLog || []), {
        action: actionLabel,
        by: user.name || user.username || 'Admin',
        byRole: user.role,
        at: new Date().toISOString(),
        notes: remarks || (isAccept ? 'Resolution accepted by Admin' : 'Rework requested by Admin')
      }]
    };

    await db.qcTasks.findByIdAndUpdate(task._id || task.id, updatedTask);

    // If linked to an issue, update issue status as well
    if (task.qcIssueId) {
      const issue = Array.from(db.qcIssues).find(i => (i._id || i.id) === task.qcIssueId);
      if (issue) {
        const updatedIssue = {
          ...issue,
          status: isAccept ? 'Closed' : 'Assigned',
          adminReview: {
            decision: isAccept ? 'Accepted' : 'Rework Required',
            reviewedBy: user.name || 'Admin',
            reviewedAt: new Date().toISOString(),
            remarks: remarks || ''
          },
          updatedAt: new Date().toISOString(),
          activityLog: [...(issue.activityLog || []), {
            action: actionLabel,
            by: user.name || 'Admin',
            byRole: user.role,
            at: new Date().toISOString(),
            notes: remarks || ''
          }]
        };
        await db.qcIssues.findByIdAndUpdate(issue._id || issue.id, updatedIssue);
      }
    }

    // Dispatch real-time notification
    try {
      notificationService.notifyTaskReview({
        task: updatedTask,
        decision,
        reworkReason: remarks,
        admin: user
      });
    } catch (notifErr) {
      console.error('Failed to trigger task review notification:', notifErr.message);
    }

    return res.json({
      success: true,
      message: isAccept ? 'Task completion accepted and closed.' : 'Rework requested. Task sent back to manager.',
      data: updatedTask
    });
  } catch (err) {
    console.error('reviewTaskResolution error:', err);
    return res.status(500).json({ success: false, message: 'Failed to review task resolution.', error: err.message });
  }
};

// PATCH /api/qc-tasks/issues/:id/review — Admin accepts issue resolution or requests rework
const reviewIssueResolution = async (req, res) => {
  try {
    const user = req.user;
    if (!isAdmin(user)) {
      return res.status(403).json({ success: false, message: 'Only Admins can review issue resolutions.' });
    }

    const { decision, remarks } = req.body;
    if (!decision || !['accept', 'rework', 'accepted'].includes(decision)) {
      return res.status(400).json({ success: false, message: "Decision must be 'accept' or 'rework'." });
    }

    const allIssues = Array.from(db.qcIssues);
    const issue = allIssues.find(i => i._id === req.params.id || i.id === req.params.id || i.issueNumber === req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

    const isAccept = decision === 'accept' || decision === 'accepted';
    const newIssueStatus = isAccept ? 'Closed' : 'Assigned';
    const actionLabel = isAccept ? 'Resolution Accepted' : 'Rework Requested';

    const updatedIssue = {
      ...issue,
      status: newIssueStatus,
      adminReview: {
        decision: isAccept ? 'Accepted' : 'Rework Required',
        reviewedBy: user.name || 'Admin',
        reviewedAt: new Date().toISOString(),
        remarks: remarks || ''
      },
      updatedAt: new Date().toISOString(),
      activityLog: [...(issue.activityLog || []), {
        action: actionLabel,
        by: user.name || 'Admin',
        byRole: user.role,
        at: new Date().toISOString(),
        notes: remarks || (isAccept ? 'Resolution accepted by Admin' : 'Rework requested by Admin')
      }]
    };

    await db.qcIssues.findByIdAndUpdate(issue._id || issue.id, updatedIssue);

    // If linked to a task, update task as well
    const taskId = issue.taskId;
    const task = Array.from(db.qcTasks).find(t => (taskId && (t._id === taskId || t.id === taskId)) || t.qcIssueId === issue._id || t.qcIssueId === issue.id);
    if (task) {
      const updatedTask = {
        ...task,
        status: isAccept ? 'Completed' : 'Rework Required',
        adminReview: {
          decision: isAccept ? 'Accepted' : 'Rework Required',
          reviewedBy: user.name || 'Admin',
          reviewedAt: new Date().toISOString(),
          remarks: remarks || ''
        },
        updatedAt: new Date().toISOString(),
        activityLog: [...(task.activityLog || []), {
          action: actionLabel,
          by: user.name || 'Admin',
          byRole: user.role,
          at: new Date().toISOString(),
          notes: remarks || ''
        }]
      };
      await db.qcTasks.findByIdAndUpdate(task._id || task.id, updatedTask);
    }

    return res.json({
      success: true,
      message: isAccept ? 'Issue resolution accepted and closed.' : 'Rework requested. Task sent back to manager.',
      data: updatedIssue
    });
  } catch (err) {
    console.error('reviewIssueResolution error:', err);
    return res.status(500).json({ success: false, message: 'Failed to review issue resolution.', error: err.message });
  }
};

module.exports = {
  raiseQCIssue,
  getQCIssues,
  getQCIssueById,
  createTask,
  getTasks,
  getTaskById,
  updateTaskStatus,
  submitSuspendRequest,
  reviewSuspendRequest,
  getManagersForScope,
  reviewTaskResolution,
  reviewIssueResolution,
  formatActorRole,
  getAdminJurisdiction,
  isManagerEligible,
  doesManagerBelongToTerritory,
  isManagerInScope
};
