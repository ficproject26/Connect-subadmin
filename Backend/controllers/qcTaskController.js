const { db, filterByLocation } = require('../config/db');
const notificationService = require('../services/notificationService');
const fs = require('fs');
const path = require('path');

const ISSUES_FILE = path.join(__dirname, '../data/qc_issues.json');
const TASKS_FILE = path.join(__dirname, '../data/qc_tasks.json');

function persistIssues(issues) {
  fs.writeFileSync(ISSUES_FILE, JSON.stringify(Array.from(db.qcIssues), null, 2), 'utf-8');
}
function persistTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(Array.from(db.qcTasks), null, 2), 'utf-8');
}

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

// Check if a manager is within an admin's hierarchy scope
function isManagerInScope(admin, manager) {
  const ar = (admin.role || '').toLowerCase();
  const mn = manager;

  if (ar.includes('super') || ar === 'admin') return true;

  // State Admin: manager must be in same state
  if (ar.includes('state') && !ar.includes('district') && !ar.includes('division') && !ar.includes('pincode')) {
    return (admin.state && mn.state === admin.state) || (admin.stateId && mn.stateId === admin.stateId);
  }
  // District Admin: manager must be in same district
  if (ar.includes('district')) {
    return (admin.district && mn.district === admin.district) || (admin.districtId && mn.districtId === admin.districtId);
  }
  // Division Admin: manager must be in same division
  if (ar.includes('division') || ar.includes('divisional')) {
    return (admin.division && mn.division === admin.division) || (admin.divisionId && mn.divisionId === admin.divisionId);
  }
  // Pincode Admin: manager must be in same pincode
  if (ar.includes('pincode')) {
    return (admin.pincode && String(mn.pincode) === String(admin.pincode)) ||
           (admin.pincodeId && mn.pincodeId === admin.pincodeId);
  }
  return false;
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

    db.qcIssues.push(issue);
    persistIssues();

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
      // Admin: filter by hierarchy scope
      const rawRole = (user.role || '').toLowerCase();
      if (!rawRole.includes('super') && rawRole !== 'admin') {
        allIssues = allIssues.filter(issue => {
          if (rawRole.includes('state')) {
            return !user.state || issue.state === user.state;
          }
          if (rawRole.includes('district')) {
            return (!user.district || issue.district === user.district) && (!user.state || issue.state === user.state);
          }
          if (rawRole.includes('division') || rawRole.includes('divisional')) {
            return (!user.division || issue.division === user.division) && (!user.district || issue.district === user.district);
          }
          if (rawRole.includes('pincode')) {
            return String(issue.pincode || '') === String(user.pincode || user.pincodeCode || '');
          }
          return false;
        });
      }
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

    // Verify manager exists and is in scope
    const allUsers = Array.from(db.users || []);
    const manager = allUsers.find(u => (u._id || u.id) === assignedManagerId);
    if (!manager) {
      return res.status(404).json({ success: false, message: 'Assigned manager not found.' });
    }
    if (!isManagerInScope(user, manager)) {
      return res.status(403).json({ success: false, message: 'Manager is outside your authorized hierarchy.' });
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
      state: state || user.state || manager.state || '',
      district: district || user.district || manager.district || '',
      division: division || user.division || manager.division || '',
      pincode: pincode || user.pincode || manager.pincode || '',
      location: location || '',
      qcIssueId: qcIssueId || null,
      assignedManagerId,
      assignedManagerName: manager.name || manager.username,
      assignedManagerRole: manager.role,
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
          notes: `Assigned to ${manager.name}. Priority: ${priority || 'Medium'}.`
        }
      ]
    };

    db.qcTasks.push(task);
    persistTasks();

    // If linked to a QC Issue, update the issue's taskId and status
    if (qcIssueId) {
      const issueIdx = db.qcIssues.findIndex(i => i._id === qcIssueId || i.id === qcIssueId);
      if (issueIdx !== -1) {
        db.qcIssues[issueIdx] = {
          ...db.qcIssues[issueIdx],
          taskId: task._id,
          status: 'Assigned',
          updatedAt: new Date().toISOString()
        };
        persistIssues();
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

// GET /api/qc-tasks/tasks — RBAC-scoped task list
const getTasks = async (req, res) => {
  try {
    const user = req.user;
    const { status, priority, category, search, issueId } = req.query;
    let allTasks = Array.from(db.qcTasks || []);

    if (isManager(user)) {
      // Manager sees only their own tasks (match by _id, id, or manager name)
      const mId1 = String(user._id || '');
      const mId2 = String(user.id || '');
      const mName = (user.name || '').trim().toLowerCase();
      allTasks = allTasks.filter(t => {
        const aid = String(t.assignedManagerId || '');
        const aname = (t.assignedManagerName || '').trim().toLowerCase();
        return (mId1 && aid === mId1) || (mId2 && aid === mId2) || (mName && aname === mName);
      });
    } else if (isAdmin(user)) {
      // Admin sees tasks in their hierarchy scope
      const rawRole = (user.role || '').toLowerCase();
      if (!rawRole.includes('super') && rawRole !== 'admin') {
        allTasks = allTasks.filter(task => {
          if (rawRole.includes('state') && !rawRole.includes('district') && !rawRole.includes('division') && !rawRole.includes('pincode')) {
            return !user.state || task.state === user.state;
          }
          if (rawRole.includes('district')) {
            return (!user.district || task.district === user.district);
          }
          if (rawRole.includes('division') || rawRole.includes('divisional')) {
            return (!user.division || task.division === user.division);
          }
          if (rawRole.includes('pincode')) {
            return String(task.pincode || '') === String(user.pincode || user.pincodeCode || '');
          }
          return false;
        });
      }
    } else if (isQCTeam(user)) {
      // QC Team sees tasks linked to their issues
      allTasks = allTasks.filter(t => {
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
        const issueIdx = db.qcIssues.findIndex(i => (i._id || i.id) === task.qcIssueId);
        if (issueIdx !== -1) {
          db.qcIssues[issueIdx] = { ...db.qcIssues[issueIdx], status: 'Resolved', updatedAt: new Date().toISOString() };
          persistIssues();
        }
      }
    }

    db.qcTasks[idx] = updatedTask;
    persistTasks();

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
    const idx = allTasks.findIndex(t => t._id === req.params.id || t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Task not found.' });

    const task = allTasks[idx];
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

    db.qcTasks[idx] = updatedTask;
    persistTasks();

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
    const idx = allTasks.findIndex(t => t._id === req.params.id || t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Task not found.' });

    const task = allTasks[idx];
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

    db.qcTasks[idx] = updatedTask;
    persistTasks();

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

// GET /api/qc-tasks/managers — Returns managers scoped to admin's hierarchy
const getManagersForScope = async (req, res) => {
  try {
    const user = req.user;
    if (!isAdmin(user)) {
      return res.status(403).json({ success: false, message: 'Only Admins can retrieve scoped managers.' });
    }

    const allUsers = Array.from(db.users || []);
    const managers = allUsers.filter(u => {
      const r = (u.role || '').toLowerCase();
      return r.includes('manager');
    });

    const scoped = managers.filter(m => isManagerInScope(user, m));

    return res.json({
      success: true,
      data: scoped.map(m => ({
        id: m._id || m.id,
        name: m.name || m.username,
        role: m.role,
        email: m.email,
        state: m.state,
        district: m.district,
        division: m.division,
        pincode: m.pincode
      })),
      count: scoped.length
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
    const idx = allTasks.findIndex(t => t._id === req.params.id || t.id === req.params.id || t.taskNumber === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Task not found.' });

    const task = allTasks[idx];
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

    db.qcTasks[idx] = updatedTask;
    persistTasks();

    // If linked to an issue, update issue status as well
    if (task.qcIssueId) {
      const issueIdx = db.qcIssues.findIndex(i => (i._id || i.id) === task.qcIssueId);
      if (issueIdx !== -1) {
        const issue = db.qcIssues[issueIdx];
        db.qcIssues[issueIdx] = {
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
        persistIssues();
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
    const idx = allIssues.findIndex(i => i._id === req.params.id || i.id === req.params.id || i.issueNumber === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Issue not found.' });

    const issue = allIssues[idx];
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

    db.qcIssues[idx] = updatedIssue;
    persistIssues();

    // If linked to a task, update task as well
    const taskId = issue.taskId;
    const taskIdx = db.qcTasks.findIndex(t => (taskId && (t._id === taskId || t.id === taskId)) || t.qcIssueId === issue._id || t.qcIssueId === issue.id);
    if (taskIdx !== -1) {
      const task = db.qcTasks[taskIdx];
      db.qcTasks[taskIdx] = {
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
      persistTasks();
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
  reviewIssueResolution
};
